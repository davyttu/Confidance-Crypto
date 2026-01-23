// controllers/liquidityController.js
const { createClient } = require('@supabase/supabase-js');
const aaveService = require('../services/aaveService');
const { 
  calculateLiquidityAmount, 
  calculateInterest,
  calculateHealthFactor 
} = require('../utils/liquidityCalculator');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * GET /api/liquidity/position/:address
 * Récupère la position active d'un utilisateur
 */
exports.getPosition = async (req, res) => {
  try {
    const { address } = req.params;

    // Vérifier l'adresse
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({ error: 'Adresse invalide' });
    }

    // Récupérer la position active depuis Supabase
    const { data: position, error } = await supabase
      .from('liquidity_positions')
      .select('*')
      .eq('user_address', address.toLowerCase())
      .eq('status', 'active')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Pas de position trouvée
        return res.status(404).json({ 
          error: 'No active position',
          message: 'Aucune position de liquidité active trouvée' 
        });
      }
      throw error;
    }

    // Récupérer le health factor en temps réel depuis Aave
    const healthFactor = await aaveService.getHealthFactor(position.aave_position_id);
    
    // Récupérer les événements
    const { data: events } = await supabase
      .from('liquidity_events')
      .select('*')
      .eq('position_id', position.id)
      .order('created_at', { ascending: false });

    // Calculer les intérêts accumulés
    const daysElapsed = Math.floor(
      (Date.now() - new Date(position.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    const accumulatedInterest = calculateInterest(
      parseFloat(position.borrowed_amount),
      0.06,
      daysElapsed / 30 // en mois
    );

    // Déterminer le statut
    let status = 'healthy';
    let healthPercentage = 100;
    
    if (healthFactor < 1.5) {
      status = 'warning';
      healthPercentage = 65;
    }
    if (healthFactor < 1.2) {
      status = 'critical';
      healthPercentage = 45;
    }

    // Construire la réponse
    const response = {
      id: position.id,
      depositedETH: position.deposited_eth,
      depositedEuro: (parseFloat(position.deposited_eth) * position.eth_price_at_creation).toFixed(2),
      receivedAmount: position.borrowed_amount,
      token: position.token,
      status,
      healthPercentage,
      healthFactor: healthFactor.toFixed(2),
      totalDebt: (parseFloat(position.borrowed_amount) + accumulatedInterest).toFixed(2),
      accumulatedInterest: accumulatedInterest.toFixed(2),
      totalInterest: accumulatedInterest.toFixed(2),
      daysElapsed,
      createdAt: position.created_at,
      
      // Recommandations si warning
      ...(status === 'warning' && {
        recommendedETHToAdd: '0.15',
        recommendedToRepay: '200'
      }),
      
      // Infos liquidation si critical
      ...(status === 'critical' && position.liquidated_eth && {
        liquidatedETH: position.liquidated_eth,
        remainingETH: (parseFloat(position.deposited_eth) - parseFloat(position.liquidated_eth)).toFixed(4)
      }),
      
      // Timeline
      events: (events || []).map(e => ({
        icon: e.icon,
        bgColor: e.bg_color,
        title: e.title,
        date: new Date(e.created_at).toLocaleDateString('fr-FR'),
        description: e.description,
        details: e.details
      }))
    };

    res.json(response);

  } catch (error) {
    console.error('Error getting position:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: error.message 
    });
  }
};

/**
 * POST /api/liquidity/create
 * Crée une nouvelle position de liquidité
 */
exports.createPosition = async (req, res) => {
  try {
    const { ethAmount, token, ltvPercentage } = req.body;
    const userAddress = req.user.address; // Depuis le middleware auth

    // Validations
    if (!ethAmount || parseFloat(ethAmount) <= 0) {
      return res.status(400).json({ error: 'Montant ETH invalide' });
    }

    if (!['USDC', 'USDT'].includes(token)) {
      return res.status(400).json({ error: 'Token invalide' });
    }

    if (!ltvPercentage || ltvPercentage < 10 || ltvPercentage > 60) {
      return res.status(400).json({ error: 'LTV invalide (10-60%)' });
    }

    // Prix ETH actuel (à récupérer via Chainlink ou API)
    const ethPrice = await aaveService.getETHPrice();

    // Calculer le montant de liquidité
    const liquidityAmount = calculateLiquidityAmount(
      parseFloat(ethAmount),
      ethPrice,
      ltvPercentage
    );

    // Créer la position sur Aave
    const aavePositionId = await aaveService.createPosition({
      ethAmount,
      token,
      borrowAmount: liquidityAmount.toString()
    });

    // Enregistrer dans Supabase
    const { data: position, error } = await supabase
      .from('liquidity_positions')
      .insert({
        user_address: userAddress.toLowerCase(),
        deposited_eth: ethAmount,
        borrowed_amount: liquidityAmount.toString(),
        token,
        ltv_percentage: ltvPercentage,
        eth_price_at_creation: ethPrice,
        aave_position_id: aavePositionId,
        status: 'active',
        network: 'base_mainnet'
      })
      .select()
      .single();

    if (error) throw error;

    // Créer l'événement initial
    await supabase.from('liquidity_events').insert({
      position_id: position.id,
      type: 'created',
      icon: '🎉',
      bg_color: 'bg-blue-100',
      title: 'Liquidité ouverte',
      description: `Vous avez déposé ${ethAmount} ETH et reçu ${liquidityAmount.toFixed(2)} ${token}`
    });

    res.status(201).json({
      success: true,
      message: 'Position créée avec succès',
      position: {
        id: position.id,
        depositedETH: ethAmount,
        receivedAmount: liquidityAmount.toFixed(2),
        token,
        aavePositionId
      }
    });

  } catch (error) {
    console.error('Error creating position:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: error.message 
    });
  }
};

/**
 * POST /api/liquidity/repay
 * Rembourse la dette
 */
exports.repay = async (req, res) => {
  try {
    const { positionId, amount } = req.body;
    const userAddress = req.user.address;

    // Vérifier la position
    const { data: position, error } = await supabase
      .from('liquidity_positions')
      .select('*')
      .eq('id', positionId)
      .eq('user_address', userAddress.toLowerCase())
      .eq('status', 'active')
      .single();

    if (error || !position) {
      return res.status(404).json({ error: 'Position non trouvée' });
    }

    const amountFloat = parseFloat(amount);
    const borrowedFloat = parseFloat(position.borrowed_amount);

    if (amountFloat <= 0 || amountFloat > borrowedFloat) {
      return res.status(400).json({ error: 'Montant invalide' });
    }

    // Rembourser sur Aave
    await aaveService.repay({
      positionId: position.aave_position_id,
      token: position.token,
      amount: amount
    });

    // Calculer l'ETH récupéré proportionnellement
    const recoveredETH = (amountFloat / borrowedFloat) * parseFloat(position.deposited_eth);
    const newBorrowedAmount = borrowedFloat - amountFloat;
    const newDepositedETH = parseFloat(position.deposited_eth) - recoveredETH;

    // Mettre à jour la position
    await supabase
      .from('liquidity_positions')
      .update({
        borrowed_amount: newBorrowedAmount.toString(),
        deposited_eth: newDepositedETH.toString()
      })
      .eq('id', positionId);

    // Créer l'événement
    await supabase.from('liquidity_events').insert({
      position_id: positionId,
      type: 'repayment',
      icon: '🔁',
      bg_color: 'bg-green-100',
      title: 'Remboursement effectué',
      description: `Vous avez remboursé ${amountFloat.toFixed(2)} ${position.token}`,
      details: `ETH récupéré : ${recoveredETH.toFixed(4)} ETH`
    });

    res.json({
      success: true,
      message: 'Remboursement effectué',
      recoveredETH: recoveredETH.toFixed(4),
      remainingDebt: newBorrowedAmount.toFixed(2)
    });

  } catch (error) {
    console.error('Error repaying:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: error.message 
    });
  }
};

/**
 * POST /api/liquidity/add-collateral
 * Ajoute de l'ETH comme collatéral
 */
exports.addCollateral = async (req, res) => {
  try {
    const { positionId, ethAmount } = req.body;
    const userAddress = req.user.address;

    // Vérifier la position
    const { data: position, error } = await supabase
      .from('liquidity_positions')
      .select('*')
      .eq('id', positionId)
      .eq('user_address', userAddress.toLowerCase())
      .eq('status', 'active')
      .single();

    if (error || !position) {
      return res.status(404).json({ error: 'Position non trouvée' });
    }

    const ethFloat = parseFloat(ethAmount);

    if (ethFloat <= 0) {
      return res.status(400).json({ error: 'Montant ETH invalide' });
    }

    // Ajouter le collatéral sur Aave
    await aaveService.addCollateral({
      positionId: position.aave_position_id,
      ethAmount: ethAmount
    });

    // Mettre à jour la position
    const newDepositedETH = parseFloat(position.deposited_eth) + ethFloat;

    await supabase
      .from('liquidity_positions')
      .update({
        deposited_eth: newDepositedETH.toString()
      })
      .eq('id', positionId);

    // Créer l'événement
    await supabase.from('liquidity_events').insert({
      position_id: positionId,
      type: 'collateral_added',
      icon: '➕',
      bg_color: 'bg-green-100',
      title: 'Collatéral ajouté',
      description: `Vous avez ajouté ${ethFloat.toFixed(4)} ETH`,
      details: `ETH total : ${newDepositedETH.toFixed(4)} ETH`
    });

    res.json({
      success: true,
      message: 'Collatéral ajouté',
      totalETH: newDepositedETH.toFixed(4)
    });

  } catch (error) {
    console.error('Error adding collateral:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: error.message 
    });
  }
};

/**
 * POST /api/liquidity/close
 * Clôture complète de la position
 */
exports.closePosition = async (req, res) => {
  try {
    const { positionId } = req.body;
    const userAddress = req.user.address;

    // Vérifier la position
    const { data: position, error } = await supabase
      .from('liquidity_positions')
      .select('*')
      .eq('id', positionId)
      .eq('user_address', userAddress.toLowerCase())
      .eq('status', 'active')
      .single();

    if (error || !position) {
      return res.status(404).json({ error: 'Position non trouvée' });
    }

    // Clôturer sur Aave (rembourse tout + récupère ETH)
    await aaveService.closePosition({
      positionId: position.aave_position_id,
      token: position.token
    });

    // Mettre à jour le statut
    await supabase
      .from('liquidity_positions')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString()
      })
      .eq('id', positionId);

    // Créer l'événement final
    await supabase.from('liquidity_events').insert({
      position_id: positionId,
      type: 'closed',
      icon: '✅',
      bg_color: 'bg-gray-100',
      title: 'Position clôturée',
      description: `Vous avez récupéré ${position.deposited_eth} ETH`,
      details: `Dette remboursée : ${position.borrowed_amount} ${position.token}`
    });

    res.json({
      success: true,
      message: 'Position clôturée avec succès',
      recoveredETH: position.deposited_eth
    });

  } catch (error) {
    console.error('Error closing position:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: error.message 
    });
  }
};

/**
 * GET /api/liquidity/events/:positionId
 * Récupère l'historique des événements
 */
exports.getEvents = async (req, res) => {
  try {
    const { positionId } = req.params;

    const { data: events, error } = await supabase
      .from('liquidity_events')
      .select('*')
      .eq('position_id', positionId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      events: events.map(e => ({
        icon: e.icon,
        bgColor: e.bg_color,
        title: e.title,
        date: new Date(e.created_at).toLocaleDateString('fr-FR'),
        description: e.description,
        details: e.details
      }))
    });

  } catch (error) {
    console.error('Error getting events:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: error.message 
    });
  }
};

/**
 * GET /api/liquidity/health/:positionId
 * Récupère le health factor en temps réel
 */
exports.getHealthFactor = async (req, res) => {
  try {
    const { positionId } = req.params;

    const { data: position, error } = await supabase
      .from('liquidity_positions')
      .select('aave_position_id')
      .eq('id', positionId)
      .single();

    if (error || !position) {
      return res.status(404).json({ error: 'Position non trouvée' });
    }

    const healthFactor = await aaveService.getHealthFactor(position.aave_position_id);

    res.json({
      healthFactor: healthFactor.toFixed(2),
      status: healthFactor >= 1.5 ? 'healthy' : healthFactor >= 1.2 ? 'warning' : 'critical'
    });

  } catch (error) {
    console.error('Error getting health factor:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: error.message 
    });
  }
};

/**
 * GET /api/liquidity/calculate
 * Calcule les montants avant création
 */
exports.calculateAmounts = async (req, res) => {
  try {
    const { ethAmount, ltv } = req.query;

    if (!ethAmount || !ltv) {
      return res.status(400).json({ error: 'Paramètres manquants' });
    }

    const ethFloat = parseFloat(ethAmount);
    const ltvFloat = parseFloat(ltv);

    if (ethFloat <= 0 || ltvFloat < 10 || ltvFloat > 60) {
      return res.status(400).json({ error: 'Valeurs invalides' });
    }

    // Prix ETH actuel
    const ethPrice = await aaveService.getETHPrice();

    // Montant de liquidité
    const liquidityAmount = calculateLiquidityAmount(ethFloat, ethPrice, ltvFloat);

    // Coût sur 6 mois
    const sixMonthsCost = calculateInterest(liquidityAmount, 0.06, 6);

    res.json({
      ethAmount: ethFloat,
      ethPrice,
      ltvPercentage: ltvFloat,
      receivedAmount: liquidityAmount.toFixed(2),
      estimatedCost6Months: sixMonthsCost.toFixed(2),
      annualRate: 0.06
    });

  } catch (error) {
    console.error('Error calculating amounts:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: error.message 
    });
  }
};
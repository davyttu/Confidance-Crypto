// services/keeperService.js
const { createClient } = require('@supabase/supabase-js');
const aaveService = require('./aaveService');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Seuils simples V1 (tu peux les mettre en env si tu veux)
const HF_WARNING = Number(process.env.HF_WARNING || 1.5);
const HF_CRITICAL = Number(process.env.HF_CRITICAL || 1.2);

// Anti-spam alertes (heures)
const ALERT_COOLDOWN_HOURS = Number(process.env.ALERT_COOLDOWN_HOURS || 24);

// --- Helpers ---

function toIso(dt) {
  return dt.toISOString();
}

function hoursAgo(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function safeNumber(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

/**
 * Insert event (compatible avec ta table liquidity_events)
 */
async function insertEvent({ positionId, type, icon, bgColor, title, description, details }) {
  const { error } = await supabase
    .from('liquidity_events')
    .insert({
      position_id: positionId,
      type,
      icon,
      bg_color: bgColor,
      title,
      description,
      details: details || null
    });

  if (error) throw error;
}

/**
 * Récupère un event récent (anti-spam)
 */
async function hasRecentEvent(positionId, type, sinceDate) {
  const { data, error } = await supabase
    .from('liquidity_events')
    .select('id')
    .eq('position_id', positionId)
    .eq('type', type)
    .gte('created_at', toIso(sinceDate))
    .limit(1);

  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
}

/**
 * Met à jour une position sans toucher aux montants financiers (non-custodial)
 */
async function updatePositionStatus(positionId, patch) {
  const { error } = await supabase
    .from('liquidity_positions')
    .update(patch)
    .eq('id', positionId);

  if (error) throw error;
}

/**
 * Surveille toutes les positions actives
 * À exécuter toutes les 5 minutes via un cron job
 */
exports.monitorAllPositions = async () => {
  try {
    console.log('🔍 Monitoring liquidity positions...');

    const { data: positions, error } = await supabase
      .from('liquidity_positions')
      .select('*')
      .eq('status', 'active');

    if (error) throw error;

    console.log(`Found ${positions.length} active positions`);

    for (const position of positions) {
      await monitorPosition(position);
    }

    console.log('✅ Monitoring complete');
  } catch (error) {
    console.error('Error monitoring positions:', error);
  }
};

/**
 * Surveille une position individuelle
 * Non-custodial: on observe Aave, on log, on alerte.
 */
async function monitorPosition(position) {
  try {
    // Health factor depuis Aave (ton service doit savoir mapper aave_position_id -> user address / market)
    const healthFactorRaw = await aaveService.getHealthFactor(position.aave_position_id, {
      network: position.network,
      userAddress: position.user_address
    });

    const hf = safeNumber(healthFactorRaw);
    if (hf === null) {
      console.warn(`Position ${position.id}: invalid health factor`, healthFactorRaw);
      return;
    }

    console.log(`Position ${position.id}: Health Factor = ${hf.toFixed(3)}`);

    // 🟢 Healthy
    if (hf >= HF_WARNING) {
      // Optionnel : si tu veux log uniquement quand ça revient à la normale après warning
      // Ici on ne spam pas, juste silence.
      return;
    }

    // 🟡 Warning
    if (hf < HF_WARNING && hf >= HF_CRITICAL) {
      await handleWarningState(position, hf);
      return;
    }

    // 🔴 Critical
    if (hf < HF_CRITICAL) {
      await handleCriticalState(position, hf);
      return;
    }
  } catch (error) {
    console.error(`Error monitoring position ${position.id}:`, error);
  }
}

/**
 * 🟡 Warning state
 * - On n'essaie PAS de liquider.
 * - On évite de spammer: 1 alerte / 24h (configurable)
 */
async function handleWarningState(position, healthFactor) {
  const since = hoursAgo(ALERT_COOLDOWN_HOURS);

  // Evite d'envoyer/insérer une alerte chaque run
  const already = await hasRecentEvent(position.id, 'alert', since);
  if (already) {
    console.log(`⚠️ Alert already sent recently for position ${position.id}`);
    return;
  }

  console.log(`🟡 WARNING: Position ${position.id} - HF: ${healthFactor.toFixed(3)}`);

  // TODO: intégrer ton système email/push ici (appel service interne)
  // await notificationService.sendLiquidityWarning({ userAddress: position.user_address, positionId: position.id, healthFactor })

  await insertEvent({
    positionId: position.id,
    type: 'alert',
    icon: '⚠️',
    bgColor: 'bg-yellow-100',
    title: 'Position à surveiller',
    description: "Le prix de l’ETH a baissé. Vous pouvez ajouter du collatéral ou rembourser une partie pour rester serein.",
    details: `Health Factor : ${healthFactor.toFixed(3)}`
  });
}

/**
 * 🔴 Critical state (non-custodial)
 * IMPORTANT :
 * - Aave gère les liquidations via liquidators externes.
 * - Ici on ne vend rien. On log juste un état critique et on informe.
 *
 * Dans ta DB V1 tu n'as pas de status 'protected', seulement active|closed.
 * Donc on ne change pas le status, on enregistre un event 'liquidation'
 * (utilisé comme "Protection activée / situation critique").
 *
 * Option bonus :
 * - si aaveService peut détecter une liquidation réelle (LiquidationCall), on l'utilise.
 */
async function handleCriticalState(position, healthFactor) {
  console.log(`🔴 CRITICAL: Position ${position.id} - HF: ${healthFactor.toFixed(3)}`);

  // Anti-spam : ne pas recréer un event 'liquidation' toutes les 5 min
  const since = hoursAgo(ALERT_COOLDOWN_HOURS);
  const already = await hasRecentEvent(position.id, 'liquidation', since);
  if (already) {
    console.log(`🛡️ Critical event already logged recently for position ${position.id}`);
    return;
  }

  // Optionnel : détecter si une liquidation a réellement eu lieu sur Aave
  // Si ton aaveService le supporte, il peut renvoyer { wasLiquidated, liquidatedAmountEth, repaidAmount, txHash }
  let liquidationInfo = null;
  try {
    if (typeof aaveService.getLatestLiquidationInfo === 'function') {
      liquidationInfo = await aaveService.getLatestLiquidationInfo(position.aave_position_id, {
        network: position.network,
        userAddress: position.user_address
      });
    }
  } catch (e) {
    // Pas bloquant
    console.warn('getLatestLiquidationInfo failed:', e?.message || e);
  }

  // Message par défaut: "protection Aave"
  let title = 'Protection Aave imminente';
  let description =
    "Votre position est en zone critique. Si le prix de l’ETH continue de baisser, Aave peut liquider automatiquement une partie de votre collatéral.";

  let details = `Health Factor : ${healthFactor.toFixed(3)}`;

  if (liquidationInfo?.wasLiquidated) {
    title = 'Protection activée (Aave)';
    description =
      "Aave a automatiquement liquidé une partie de votre collatéral pour sécuriser votre position.";
    const extra = [];
    if (liquidationInfo.liquidatedEth != null) extra.push(`ETH liquidé : ${liquidationInfo.liquidatedEth}`);
    if (liquidationInfo.repaidAmount != null) extra.push(`Dette remboursée : ${liquidationInfo.repaidAmount}`);
    if (liquidationInfo.txHash) extra.push(`Tx : ${liquidationInfo.txHash}`);
    details = `${details}${extra.length ? `\n${extra.join(' | ')}` : ''}`;

    // ⚠️ Non-custodial: on ne met pas à jour deposited_eth / liquidated_eth car ces champs sont "informatiques" chez toi
    // et doivent idéalement venir d'une lecture on-chain fiable (aaveService).
    // Mais si tu veux quand même refléter les montants on-chain, fais-le uniquement à partir de liquidationInfo (source de vérité),
    // jamais à partir d'une estimation.
    if (liquidationInfo.liquidatedEth != null) {
      await updatePositionStatus(position.id, {
        liquidated_eth: String(liquidationInfo.liquidatedEth)
      });
    }
  }

  // TODO: notifier l’utilisateur (email/push)
  // await notificationService.sendLiquidityCritical({ userAddress: position.user_address, positionId: position.id, healthFactor })

  await insertEvent({
    positionId: position.id,
    type: 'liquidation', // dans ta DB: 'liquidation' existe et sert de "protection"
    icon: '🛡️',
    bgColor: 'bg-red-100',
    title,
    description,
    details
  });
}

// Export
module.exports = exports;

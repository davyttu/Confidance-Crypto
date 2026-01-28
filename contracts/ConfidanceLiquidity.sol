// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * ConfidanceBorrowRouter (V1)
 * - Collatéral: ETH (via Aave WrappedTokenGateway -> WETH)
 * - Emprunt: USDC ou USDT
 * - Position portée par CE contrat (custodial on-chain).
 *
 * ⚠️ V1 volontairement simple:
 * - 1 position par user (écrase la précédente si ré-ouverte)
 * - remboursement "close" = repay tout + withdraw tout
 * - pas de multi-collat, pas de partial close, pas d'EMode, pas de keeper.
 */

interface IERC20 {
  function approve(address spender, uint256 amount) external returns (bool);
  function transfer(address to, uint256 amount) external returns (bool);
  function transferFrom(address from, address to, uint256 amount) external returns (bool);
  function balanceOf(address a) external view returns (uint256);
}

interface IPool {
  function borrow(
    address asset,
    uint256 amount,
    uint256 interestRateMode, // 1 = stable, 2 = variable
    uint16 referralCode,
    address onBehalfOf
  ) external;

  function repay(
    address asset,
    uint256 amount,
    uint256 interestRateMode, // 1 = stable, 2 = variable
    address onBehalfOf
  ) external returns (uint256);
}

interface IWrappedTokenGatewayV3 {
  function depositETH(
    address pool,
    address onBehalfOf,
    uint16 referralCode
  ) external payable;

  function withdrawETH(
    address pool,
    uint256 amount,
    address to
  ) external;
}

contract ConfidanceBorrowRouterV1 {
  // --- Base Aave V3 addresses (hardcoded for V1) ---
  address public constant AAVE_POOL_BASE = 0xA238Dd80C259a72e81d7e4664a9801593F98d1c5;
  address public constant WETH_GATEWAY_BASE = 0xB90493d0876734f77a088538e9d49065F9De4D30;

  // Supported debt assets (Base)
  address public constant USDC_BASE = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
  address public constant USDT_BASE = 0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2;

  IPool public constant POOL = IPool(AAVE_POOL_BASE);
  IWrappedTokenGatewayV3 public constant GATEWAY = IWrappedTokenGatewayV3(WETH_GATEWAY_BASE);

  struct Position {
    uint256 collateralEth;   // ETH déposé via gateway (≈ msg.value)
    address debtAsset;       // USDC ou USDT
    uint256 debtPrincipal;   // montant emprunté à l’ouverture (hors intérêts)
    bool open;
  }

  mapping(address => Position) public positions;

  event PositionOpened(address indexed user, uint256 collateralEth, address indexed debtAsset, uint256 debtAmount);
  event PositionClosed(address indexed user, uint256 repaidAmount, uint256 withdrawnEth);

  error UnsupportedDebtAsset();
  error NoOpenPosition();
  error EthRequired();

  /// @notice Ouvre une position : dépose ETH sur Aave et emprunte un stable (USDC/USDT), puis l'envoie au user
  function openPosition(address debtAsset, uint256 debtAmount) external payable {
    if (msg.value == 0) revert EthRequired();
    if (debtAsset != USDC_BASE && debtAsset != USDT_BASE) revert UnsupportedDebtAsset();

    // 1) Déposer ETH sur Aave (le contrat reçoit les aTokens)
    GATEWAY.depositETH{value: msg.value}(AAVE_POOL_BASE, address(this), 0);

    // 2) Emprunter le stable en mode variable (2), dette au nom du contrat
    POOL.borrow(debtAsset, debtAmount, 2, 0, address(this));

    // 3) Envoyer les fonds à l’utilisateur
    require(IERC20(debtAsset).transfer(msg.sender, debtAmount), "TRANSFER_FAIL");

    // 4) Sauver l'état (V1 : 1 position/user)
    positions[msg.sender] = Position({
      collateralEth: msg.value,
      debtAsset: debtAsset,
      debtPrincipal: debtAmount,
      open: true
    });

    emit PositionOpened(msg.sender, msg.value, debtAsset, debtAmount);
  }

  /**
   * @notice Ferme la position "simplement" :
   * - le user renvoie du stable (>= dette + intérêts) au contrat
   * - le contrat repay sur Aave
   * - le contrat withdraw l'ETH et le renvoie au user
   *
   * @param repayAmount Le montant que le user fournit (tu peux mettre "dette + marge").
   */
  function closePosition(uint256 repayAmount) external {
    Position memory p = positions[msg.sender];
    if (!p.open) revert NoOpenPosition();

    // 1) Récupérer les stables depuis l'utilisateur
    require(IERC20(p.debtAsset).transferFrom(msg.sender, address(this), repayAmount), "TRANSFER_FROM_FAIL");

    // 2) Approve + repay sur Aave (variable = 2)
    IERC20(p.debtAsset).approve(AAVE_POOL_BASE, repayAmount);
    uint256 repaid = POOL.repay(p.debtAsset, repayAmount, 2, address(this));

    // 3) Withdraw ETH (V1: on tente de retirer "collateralEth")
    // ⚠️ En pratique, le max withdraw dépend de la Health Factor.
    // Ici on part du principe "position fermée" => retrait total possible.
    GATEWAY.withdrawETH(AAVE_POOL_BASE, p.collateralEth, msg.sender);

    // 4) Nettoyage
    delete positions[msg.sender];

    emit PositionClosed(msg.sender, repaid, p.collateralEth);
  }

  receive() external payable {}
}

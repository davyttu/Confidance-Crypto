require("dotenv").config();
const { ethers } = require("ethers");

const RPC_URL = process.env.RPC_URL || "https://mainnet.base.org";
const PRIVATE_KEY = process.env.PRIVATE_KEY_PAYER; // Utilisez votre clé privée du payer

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const RECURRING_CONTRACT = "0xAb18dD9edE43e6afF47E4e236B6185117d89c7b1";

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)"
];

async function approveRecurring() {
  console.log("💳 Approbation du contrat récurrent pour 2 mois...\n");

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const usdc = new ethers.Contract(USDC, ERC20_ABI, wallet);

  // Montant à approuver : 0.020358 USDC (2 mois)
  const amountToApprove = ethers.parseUnits("0.020358", 6);

  console.log("Payer:", wallet.address);
  console.log("Contrat récurrent:", RECURRING_CONTRACT);
  console.log("Montant à approuver:", ethers.formatUnits(amountToApprove, 6), "USDC");
  console.log("");

  // Vérifier l'allowance actuelle
  const currentAllowance = await usdc.allowance(wallet.address, RECURRING_CONTRACT);
  console.log("Allowance actuelle:", ethers.formatUnits(currentAllowance, 6), "USDC");

  if (currentAllowance >= amountToApprove) {
    console.log("✅ Allowance déjà suffisante !");
    return;
  }

  console.log("\n⏳ Envoi de la transaction approve()...");

  try {
    const tx = await usdc.approve(RECURRING_CONTRACT, amountToApprove);
    console.log("📤 Transaction envoyée:", tx.hash);
    console.log("⏳ Attente de confirmation...");

    const receipt = await tx.wait();
    console.log("✅ Confirmé au block:", receipt.blockNumber);
    console.log("🔗 https://basescan.org/tx/" + tx.hash);

    // Vérifier la nouvelle allowance
    const newAllowance = await usdc.allowance(wallet.address, RECURRING_CONTRACT);
    console.log("\n✅ Nouvelle allowance:", ethers.formatUnits(newAllowance, 6), "USDC");
    console.log("\n🎉 Succès ! Le keeper pourra maintenant exécuter les 2 mois.");

  } catch (error) {
    console.error("\n❌ Erreur:", error.message);
  }
}

approveRecurring();

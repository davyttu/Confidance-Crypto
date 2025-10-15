const { execSync } = require("child_process");
const fs = require("fs");

async function deployAndAutomate() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🚀 DÉPLOIEMENT AUTOMATISÉ CONFIDANCE CRYPTO");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  try {
    // 1. Déployer les contrats
    console.log("📦 1/4 - Déploiement des contrats sur Base Mainnet...");
    execSync("npx hardhat run scripts/deployBaseMainnet.js --network base_mainnet", {
      stdio: "inherit"
    });

    // 2. Git add
    console.log("\n📤 2/4 - Ajout des fichiers à Git...");
    execSync("git add deployment-info-base.json keeper-cloud/deployment-info-base.json", {
      stdio: "inherit"
    });

    // 3. Git commit avec timestamp
    console.log("\n💾 3/4 - Commit...");
    const timestamp = new Date().toISOString();
    execSync(`git commit -m "🚀 Auto-deploy: ${timestamp}"`, {
      stdio: "inherit"
    });

    // 4. Git push
    console.log("\n🌐 4/4 - Push sur GitHub...");
    execSync("git push origin main", {
      stdio: "inherit"
    });

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ DÉPLOIEMENT AUTOMATISÉ TERMINÉ !");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔄 Render redéploie automatiquement...");
    console.log("📊 Surveillez les logs : https://dashboard.render.com");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  } catch (error) {
    console.error("❌ Erreur :", error.message);
    process.exit(1);
  }
}

deployAndAutomate();
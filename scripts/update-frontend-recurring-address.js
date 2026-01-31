/**
 * Met à jour l'adresse de la factory récurrente (Base Sepolia) dans le frontend
 * après un déploiement. Lit factory-recurring-deployment.test.json.
 */
const fs = require("fs");
const path = require("path");

const deploymentPath = path.join(__dirname, "..", "factory-recurring-deployment.test.json");
const addressesPath = path.join(__dirname, "..", "confidance-frontend", "src", "lib", "contracts", "addresses.ts");

if (!fs.existsSync(deploymentPath)) {
  console.error("❌ Fichier non trouvé : factory-recurring-deployment.test.json");
  process.exit(1);
}

const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
const newAddress = deployment.factoryAddress;

let content = fs.readFileSync(addressesPath, "utf8");
const regex = /(base_sepolia:\s*\{[^}]*factory_recurring:\s*)"[^"]+"/;
if (!regex.test(content)) {
  console.error("❌ Format inattendu dans addresses.ts (base_sepolia.factory_recurring)");
  process.exit(1);
}
content = content.replace(regex, `$1"${newAddress}"`);
fs.writeFileSync(addressesPath, content);
console.log("✅ Frontend mis à jour : base_sepolia.factory_recurring =", newAddress);

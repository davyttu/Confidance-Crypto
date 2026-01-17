require("dotenv").config();
const hre = require("hardhat");

/**
 * Script pour vérifier un contrat ScheduledPayment / Batch / ERC20 sur Basescan
 *
 * Usage:
 *   npx hardhat run scripts/verifyScheduledPayment.js --network base_mainnet -- 0x...
 *
 * Le script détecte automatiquement le type de contrat et lit les paramètres
 * directement depuis la blockchain.
 */

async function main() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔍 VÉRIFICATION CONTRAT ScheduledPayment");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Adresse à vérifier : argument CLI ou variable d'env
  const CONTRACT_ADDRESS =
    process.env.VERIFY_ADDRESS ||
    process.env.CONTRACT_ADDRESS ||
    process.argv[2] ||
    "";

  if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") {
    throw new Error("❌ Veuillez modifier CONTRACT_ADDRESS dans le script");
  }

  console.log("📍 Adresse du contrat :", CONTRACT_ADDRESS);
  console.log("🌐 Réseau :", (await hre.ethers.provider.getNetwork()).name);
  console.log("\n🔍 Lecture des paramètres depuis le contrat...\n");

  try {
    const detectAndRead = async () => {
      const readBatch = async (factoryName, isErc20) => {
        const Factory = await hre.ethers.getContractFactory(factoryName);
        const contract = Factory.attach(CONTRACT_ADDRESS);
        const [payer, releaseTime, cancellable, protocolOwner] = await Promise.all([
          contract.payer(),
          contract.releaseTime(),
          contract.cancellable(),
          isErc20 ? contract.protocolOwner() : Promise.resolve(null),
        ]);
        const [payees, amounts] = await contract.getAllPayees();
        const tokenAddress = isErc20 ? await contract.tokenAddress() : null;

        return {
          type: isErc20 ? "BATCH_ERC20" : "BATCH_ETH",
          contract,
          contractPath: isErc20
            ? "contracts/BatchScheduledPaymentERC20.sol:BatchScheduledPaymentERC20"
            : "contracts/BatchScheduledPayment_V2.sol:BatchScheduledPayment",
          args: isErc20
            ? [payer, tokenAddress, payees, amounts, releaseTime, cancellable, protocolOwner]
            : [payer, payees, amounts, releaseTime, cancellable],
          meta: { payer, tokenAddress, payees, amounts, releaseTime, cancellable, protocolOwner },
        };
      };

      const readSingle = async (factoryName, isErc20) => {
        const Factory = await hre.ethers.getContractFactory(factoryName);
        const contract = Factory.attach(CONTRACT_ADDRESS);
        const [payer, payee, amountToPayee, releaseTime, cancellable, protocolOwner] =
          await Promise.all([
            contract.payer(),
            contract.payee(),
            contract.amountToPayee(),
            contract.releaseTime(),
            contract.cancellable(),
            contract.protocolOwner(),
          ]);
        const tokenAddress = isErc20 ? await contract.tokenAddress() : null;

        return {
          type: isErc20 ? "SINGLE_ERC20" : "SINGLE_ETH",
          contract,
          contractPath: isErc20
            ? "contracts/ScheduledPaymentERC20.sol:ScheduledPaymentERC20"
            : "contracts/ScheduledPayment_V2.sol:ScheduledPayment",
          args: isErc20
            ? [payer, payee, tokenAddress, amountToPayee, releaseTime, cancellable, protocolOwner]
            : [payer, payee, amountToPayee, releaseTime, cancellable, protocolOwner],
          meta: { payer, payee, tokenAddress, amountToPayee, releaseTime, cancellable, protocolOwner },
        };
      };

      // 1) Batch ERC20
      try {
        return await readBatch("BatchScheduledPaymentERC20", true);
      } catch (_) {}

      // 2) Batch ETH
      try {
        return await readBatch("BatchScheduledPayment", false);
      } catch (_) {}

      // 3) Single ERC20
      try {
        return await readSingle("ScheduledPaymentERC20", true);
      } catch (_) {}

      // 4) Single ETH
      return await readSingle("ScheduledPayment", false);
    };

    const detected = await detectAndRead();

    console.log("✅ Type détecté :", detected.type);
    console.log("📋 Paramètres lus depuis le contrat :");
    console.log("   👤 Payer :", detected.meta.payer);
    if (detected.meta.payee) console.log("   👤 Payee :", detected.meta.payee);
    if (detected.meta.tokenAddress) console.log("   🪙 Token :", detected.meta.tokenAddress);
    if (detected.meta.amountToPayee !== undefined) {
      console.log(
        "   💰 Amount to Payee :",
        detected.meta.amountToPayee.toString()
      );
    }
    if (detected.meta.payees) {
      console.log("   👥 Payees count :", detected.meta.payees.length);
    }
    console.log(
      "   ⏰ Release Time :",
      detected.meta.releaseTime.toString(),
      `(${new Date(Number(detected.meta.releaseTime) * 1000).toLocaleString()})`
    );
    console.log("   🔒 Cancellable :", detected.meta.cancellable);
    if (detected.meta.protocolOwner) {
      console.log("   🛡️  Protocol Owner :", detected.meta.protocolOwner);
    }

    console.log("\n🔄 Vérification sur Basescan...\n");

    await hre.run("verify:verify", {
      address: CONTRACT_ADDRESS,
      constructorArguments: detected.args,
      contract: detected.contractPath,
    });

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ CONTRAT VÉRIFIÉ AVEC SUCCÈS !");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`\n🔗 https://basescan.org/address/${CONTRACT_ADDRESS}#code\n`);

  } catch (error) {
    if (error.message.includes("Already Verified") || error.message.includes("Contract source code already verified")) {
      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("✅ LE CONTRAT EST DÉJÀ VÉRIFIÉ !");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`\n🔗 https://basescan.org/address/${CONTRACT_ADDRESS}#code\n`);
    } else {
      console.error("\n❌ Erreur lors de la vérification :");
      console.error(error.message);
      
      if (error.message.includes("Invalid API Key") || error.message.includes("BASESCAN_API_KEY")) {
        console.log("\n💡 Solution :");
        console.log("   1. Créez une clé API sur https://basescan.org/myapikey");
        console.log("   2. Ajoutez-la dans votre .env :");
        console.log("      BASESCAN_API_KEY=votre_cle_api");
        console.log("   3. Relancez le script");
      } else if (error.message.includes("Constructor arguments")) {
        console.log("\n💡 Le script n'a pas pu lire les paramètres du contrat.");
        console.log("   Vérifiez que l'adresse est correcte et que le contrat existe.");
      } else {
        console.log("\n💡 Solutions possibles :");
        console.log("   1. Vérifiez que BASESCAN_API_KEY est dans votre .env");
        console.log("   2. Vérifiez que vous êtes sur le bon réseau (Base Mainnet)");
        console.log("   3. Essayez manuellement sur : https://basescan.org/verifyContract");
        console.log("\n   Pour la vérification manuelle :");
        console.log("   - Compiler Version: 0.8.20");
        console.log("   - License: MIT");
        console.log("   - Optimization: Yes, Runs: 1");
        console.log("   - viaIR: true");
        console.log("   - Bytecode Hash: none");
        console.log("   - Constructor Arguments: utilisez la sortie du script");
      }
      process.exit(1);
    }
  }
}

main().catch((error) => {
  console.error("\n❌ Erreur fatale :", error);
  process.exit(1);
});

import React, { useState, useEffect } from "react";
import { ethers } from "ethers";

export default function PaymentForm({ user, wallet }) {
  const [fiatAmount, setFiatAmount] = useState("");
  const [currency, setCurrency] = useState("USDT");
  const [blockchain, setBlockchain] = useState("Core");
  const [corePrice, setCorePrice] = useState(null);
  const [coreAmount, setCoreAmount] = useState(null);
  const [recipient, setRecipient] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [frequency, setFrequency] = useState("unique");
  const [installments, setInstallments] = useState(2);
  const [canCancel, setCanCancel] = useState(true);
  const [definitive, setDefinitive] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showLoginModal, setShowLoginModal] = useState(false);

  const factoryAddress = import.meta.env.VITE_FACTORY_ADDRESS;

  // ABI séparés pour éviter l'ambiguïté
  const factoryAbi4Args = [
    "function createPayment(address recipient, uint256 releaseTime, bool cancellable, bool definitive) payable returns (address)",
    "function getUserPayments(address user) view returns (address[])",
    "function getPaymentDetails(address paymentContract) view returns (address, address, uint256, uint256, bool, bool, bool)"
  ];

  const factoryAbi3Args = [
    "function createPayment(address recipient, uint256 releaseTime, bool cancellable) payable returns (address)",
    "function getUserPayments(address user) view returns (address[])",
    "function getPaymentDetails(address paymentContract) view returns (address, address, uint256, uint256, bool, bool, bool)"
  ];

  // 💰 Récupérer le prix actuel du CORE
  useEffect(() => {
  const fetchPrices = async () => {
    try {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=coredaoorg&vs_currencies=usd"
      );
      const data = await res.json();

      // 🧩 Détection automatique du testnet Core (chainId = 1115)
      const isTestnet =
        window.ethereum?.networkVersion === "1115" ||
        window.ethereum?.chainId === "0x45b";

      // ⚙️ Si testnet => prix fixe à 1 pour éviter undefined ou NaN
      const prixCore = isTestnet ? 1 : data.coredaoorg?.usd || 1;

      setCorePrice(prixCore);
      console.log("🧮 Prix CORE utilisé :", prixCore, isTestnet ? "(testnet détecté)" : "");
    } catch (err) {
      console.error("Erreur récupération prix CORE:", err);
      setCorePrice(1);
    }
  };
  fetchPrices();
}, []);

  // 💵 Calculer le montant minimum (supprimé)
  const getMinAmount = () => {
    return "0";
  };

  // 🧮 Calcul du montant en USDT/USDC/CORE
  useEffect(() => {
    if (!fiatAmount) {
      setErrorMessage("");
      setCoreAmount(null);
      return;
    }

    console.log("🧮 Debug calcul - inputs:", { fiatAmount, currency, corePrice });

    // Pas de montant minimum
    setErrorMessage("");

    const montantTotal = parseFloat(fiatAmount);
    let brutTotal;

    if (currency === "CORE" && corePrice) {
      brutTotal = montantTotal * corePrice;
      const taxeTotal = brutTotal * 0.0179;
      const totalCompletUSD = brutTotal + taxeTotal;

      brutTotal = montantTotal;
      const taxeTotal_CORE = taxeTotal / corePrice;
      const totalComplet = totalCompletUSD / corePrice;

      const nbMensualites = frequency === "mensuel" && installments > 0 ? installments : 1;
      const brut = brutTotal / nbMensualites;
      const taxe = taxeTotal_CORE / nbMensualites;
      const total = totalComplet / nbMensualites;

      setCoreAmount({ brut, taxe, total, montantTotal, brutTotal, taxeTotal: taxeTotal_CORE, totalComplet, nbMensualites });
    } else {
      brutTotal = montantTotal;
      const taxeTotal = brutTotal * 0.0179;
      const totalComplet = brutTotal + taxeTotal;

      const nbMensualites = frequency === "mensuel" && installments > 0 ? installments : 1;
      const brut = brutTotal / nbMensualites;
      const taxe = taxeTotal / nbMensualites;
      const total = totalComplet / nbMensualites;

      setCoreAmount({ brut, taxe, total, montantTotal, brutTotal, taxeTotal, totalComplet, nbMensualites });
    }
  }, [fiatAmount, currency, frequency, installments, corePrice]);

  // 🎯 Validation des champs
  const validateForm = () => {
    if (!recipient) {
      setStatus("❌ Veuillez saisir l'adresse du destinataire");
      return false;
    }

    try {
      const checksumAddress = ethers.getAddress(recipient);
      console.log("✅ Adresse valide:", checksumAddress);
    } catch (addressError) {
      setStatus(`❌ Adresse du destinataire invalide: ${addressError.message}`);
      return false;
    }

    if (!fiatAmount || !coreAmount) {
      setStatus("❌ Veuillez saisir un montant valide");
      return false;
    }

    // Vérification basique du montant
    if (parseFloat(fiatAmount) <= 0) {
      setStatus("❌ Le montant doit être supérieur à 0");
      return false;
    }

    if (!date) {
      setStatus("❌ Veuillez sélectionner une date");
      return false;
    }

    const selectedDate = new Date(date + (time ? `T${time}` : "T00:00"));
    const now = new Date();
    if (selectedDate <= now) {
      setStatus("❌ La date doit être dans le futur");
      return false;
    }

    // Vérifier que la date n'est pas trop loin (max 1 an)
    const oneYearFromNow = new Date(now.getTime() + (365 * 24 * 60 * 60 * 1000));
    if (selectedDate > oneYearFromNow) {
      setStatus("❌ La date ne peut pas être plus d'un an dans le futur");
      return false;
    }

    return true;
  };

  // 🔥 Fonction principale de création du paiement différé
  const handleScheduledPayment = async (e) => {
    e.preventDefault();

    if (!user) {
      setShowLoginModal(true);
      return;
    }

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      setStatus("🔌 Connexion au wallet...");

      if (!window.ethereum) {
        throw new Error("MetaMask n'est pas installé");
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();

      if (!factoryAddress) {
        throw new Error("Adresse du contrat Factory non configurée (VITE_FACTORY_ADDRESS)");
      }

      // Vérifier que le contrat existe à cette adresse
      setStatus("🔍 Vérification du contrat Factory...");
      const code = await provider.getCode(factoryAddress);
      if (code === "0x") {
        throw new Error(`Aucun contrat trouvé à l'adresse ${factoryAddress}. Vérifiez que le contrat est déployé sur le bon réseau.`);
      }

      // Test simple : appeler une fonction view pour vérifier la compatibilité
      setStatus("🧪 Test de compatibilité du contrat...");
      try {
        const testContract = new ethers.Contract(factoryAddress, [
          "function platformWallet() view returns (address)",
          "function feePercent() view returns (uint256)"
        ], provider);

        const platformWallet = await testContract.platformWallet();
        const feePercent = await testContract.feePercent();
        console.log("✅ Contrat valide - Platform wallet:", platformWallet, "Fee:", feePercent.toString());
      } catch (testError) {
        console.error("❌ Test de compatibilité échoué:", testError);
        throw new Error(`Contrat incompatible: ${testError.message}`);
      }

      // 📅 Préparer la date de libération
      const selectedDate = new Date(date + (time ? `T${time}` : "T00:00"));
      const releaseTimestamp = Math.floor(selectedDate.getTime() / 1000);

      console.log("📅 Debug date:", {
        inputDate: date,
        inputTime: time,
        selectedDate: selectedDate.toString(),
        releaseTimestamp,
        currentTimestamp: Math.floor(Date.now() / 1000),
        timeDiff: releaseTimestamp - Math.floor(Date.now() / 1000)
      });

      // 💰 Calculer le montant en Wei (toujours en CORE pour le smart contract)
      let amountInWei;
      if (currency === "CORE") {
        amountInWei = ethers.parseEther(coreAmount.total.toString());
      } else {
        // Convertir USDT/USDC en CORE pour le smart contract
        const coreEquivalent = coreAmount.total / corePrice;
        amountInWei = ethers.parseEther(coreEquivalent.toString());
      }

      console.log("💰 Debug montant:", {
        fiatAmount,
        currency,
        corePrice,
        coreAmount,
        amountInWei: amountInWei.toString(),
        amountInCORE: ethers.formatEther(amountInWei)
      });

      setStatus("📋 Création du contrat de paiement différé...");

      let tx;
      let paymentAddress;

      try {
        // 🎯 Tentative 1: Version 4 arguments (récente)
        setStatus("⚡ Tentative avec 4 arguments (récente)...");

        const contract4 = new ethers.Contract(factoryAddress, factoryAbi4Args, signer);

        // Debug: Vérifier les paramètres avant l'appel
        console.log("🔍 Debug - Paramètres:", {
          recipient,
          releaseTimestamp,
          canCancel,
          definitive,
          amountInWei: amountInWei.toString(),
          currentTime: Math.floor(Date.now() / 1000),
          factoryAddress
        });

        if (frequency === "mensuel" && installments > 1) {
          // Pour les paiements mensuels, créer plusieurs contrats
          const payments = [];
          const monthlyAmount = amountInWei / BigInt(installments);

          for (let i = 0; i < installments; i++) {
            const monthlyDate = new Date(selectedDate);
            monthlyDate.setMonth(monthlyDate.getMonth() + i);
            const monthlyTimestamp = Math.floor(monthlyDate.getTime() / 1000);

            const monthlyTx = await contract4.createPayment(
              recipient,
              monthlyTimestamp,
              canCancel,
              definitive,
              { value: monthlyAmount }
            );

            setStatus(`⏳ Confirmation du paiement ${i + 1}/${installments}...`);
            const receipt = await monthlyTx.wait();
            payments.push({
              tx: monthlyTx.hash,
              date: monthlyDate.toLocaleDateString(),
              amount: ethers.formatEther(monthlyAmount)
            });
          }

          setStatus(`🎉 ${installments} paiements programmés avec succès !`);

          // Sauvegarder localement pour l'historique
          const store = JSON.parse(localStorage.getItem("confidance_payments") || "[]");
          payments.forEach(payment => {
            store.push({
              type: "scheduled_monthly",
              recipient,
              amount: payment.amount,
              currency,
              date: payment.date,
              status: "Programmé",
              txHash: payment.tx,
              cancellable: canCancel,
              definitive,
              timestamp: Date.now()
            });
          });
          localStorage.setItem("confidance_payments", JSON.stringify(store));

        } else {
          // Paiement unique
          setStatus("🔥 Estimation du gas...");
          try {
            const gasEstimate = await contract4.createPayment.estimateGas(
              recipient,
              releaseTimestamp,
              canCancel,
              definitive,
              { value: amountInWei }
            );
            console.log("✅ Gas estimé:", gasEstimate.toString());

            setStatus("🚀 Envoi de la transaction...");
            tx = await contract4.createPayment(
              recipient,
              releaseTimestamp,
              canCancel,
              definitive,
              { value: amountInWei }
            );
          } catch (gasError) {
            console.error("❌ Erreur estimation gas:", gasError);
            throw new Error(`Échec estimation gas: ${gasError.reason || gasError.message}`);
          }
        }

      } catch (error4Args) {
        console.warn("Échec version 4 arguments:", error4Args.message);

        try {
          // 🎯 Tentative 2: Version 3 arguments (ancienne)
          setStatus("⚡ Tentative avec 3 arguments (ancienne)...");

          const contract3 = new ethers.Contract(factoryAddress, factoryAbi3Args, signer);

          if (frequency === "mensuel" && installments > 1) {
            const payments = [];
            const monthlyAmount = amountInWei / BigInt(installments);

            for (let i = 0; i < installments; i++) {
              const monthlyDate = new Date(selectedDate);
              monthlyDate.setMonth(monthlyDate.getMonth() + i);
              const monthlyTimestamp = Math.floor(monthlyDate.getTime() / 1000);

              const monthlyTx = await contract3.createPayment(
                recipient,
                monthlyTimestamp,
                canCancel,
                { value: monthlyAmount }
              );

              setStatus(`⏳ Confirmation du paiement ${i + 1}/${installments}...`);
              await monthlyTx.wait();
              payments.push({
                tx: monthlyTx.hash,
                date: monthlyDate.toLocaleDateString(),
                amount: ethers.formatEther(monthlyAmount)
              });
            }

            setStatus(`🎉 ${installments} paiements programmés avec succès !`);

          } else {
            tx = await contract3.createPayment(
              recipient,
              releaseTimestamp,
              canCancel,
              { value: amountInWei }
            );
          }

        } catch (error3Args) {
          console.error("Échec version 3 arguments:", error3Args.message);
          throw new Error(`Contrat incompatible ou adresse incorrecte. Vérifiez l'adresse Factory (${factoryAddress}). Erreurs détaillées: 4 args: ${error4Args.shortMessage || error4Args.message} | 3 args: ${error3Args.shortMessage || error3Args.message}`);
        }
      }

      // Pour les paiements uniques
      if (tx) {
        setStatus("⏳ Attente de confirmation sur la blockchain...");
        const receipt = await tx.wait();

        // Extraire l'adresse du contrat créé (si disponible dans les logs)
        const paymentCreatedEvent = receipt.logs.find(log => log.topics.length > 0);
        if (paymentCreatedEvent) {
          // L'adresse est généralement dans le premier topic ou dans les données
          paymentAddress = paymentCreatedEvent.address;
        }

        setStatus(`🎉 Paiement différé programmé avec succès !`);

        // Sauvegarder localement pour l'historique
        const store = JSON.parse(localStorage.getItem("confidance_payments") || "[]");
        store.push({
          type: "scheduled",
          recipient,
          amount: ethers.formatEther(amountInWei),
          currency,
          date: selectedDate.toLocaleDateString(),
          time: selectedDate.toLocaleTimeString(),
          status: "Programmé",
          txHash: tx.hash,
          paymentContract: paymentAddress,
          cancellable: canCancel,
          definitive,
          frequency,
          installments: frequency === "mensuel" ? installments : 1,
          timestamp: Date.now()
        });
        localStorage.setItem("confidance_payments", JSON.stringify(store));

        // Réinitialiser le formulaire
        setTimeout(() => {
          setRecipient("");
          setFiatAmount("");
          setDate("");
          setTime("");
          setStatus("");
        }, 3000);
      }

    } catch (err) {
      console.error("Erreur création paiement différé:", err);
      setStatus(`❌ Erreur: ${err.message || String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto mt-10 p-8 bg-white rounded-2xl shadow-lg text-gray-800">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-blue-600 mb-3">
          Programmer un paiement différé
        </h2>
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-2 rounded-full border border-blue-200">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-medium text-blue-700">Automatisé par Smart Contract</span>
        </div>
      </div>

      <form onSubmit={handleScheduledPayment} className="flex flex-col gap-4">
        {/* Adresse destinataire */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Adresse destinataire *
          </label>
          <input
            type="text"
            placeholder="0x..."
            className="border p-3 rounded-md w-full font-mono text-sm"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            required
          />
        </div>

        {/* Devise + Montant */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Montant *
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Montant"
              className={`border p-3 rounded-md flex-1 ${errorMessage ? 'border-red-500' : ''}`}
              value={fiatAmount}
              onChange={(e) => setFiatAmount(e.target.value)}
              step="0.000001"
              required
            />
            <select
              className="border p-3 rounded-md"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option value="USDT">USDT</option>
              <option value="USDC">USDC</option>
              <option value="CORE">CORE</option>
            </select>
          </div>
          {errorMessage && (
            <p className="text-red-600 text-sm mt-2 flex items-center gap-1">
              <span>⚠️</span>
              <span>{errorMessage}</span>
            </p>
          )}
          {!errorMessage && (
            <p className="text-gray-500 text-xs mt-2">
              Saisissez le montant de votre choix
            </p>
          )}
        </div>

        {/* Blockchain utilisée */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Blockchain utilisée *
          </label>
          <select
            className="border p-3 rounded-md w-full"
            value={blockchain}
            onChange={(e) => setBlockchain(e.target.value)}
          >
            <option value="Ethereum">Ethereum</option>
            <option value="Base">Base</option>
            <option value="Polygon">Polygon</option>
            <option value="Arbitrum">Arbitrum</option>
            <option value="Binance">Binance Smart Chain (BSC)</option>
            <option value="Solana">Solana</option>
            <option value="Core">Core (Testnet)</option>
          </select>
          <p className="text-gray-500 text-xs mt-2">
            Sélectionnez la blockchain sur laquelle vous souhaitez effectuer le paiement
          </p>
        </div>

        {/* Date et heure */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date de libération *
            </label>
            <input
              type="date"
              className="border p-3 rounded-md w-full"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Heure (optionnel)
            </label>
            <input
              type="time"
              className="border p-3 rounded-md w-full"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>

        {/* Fréquence */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fréquence
          </label>
          <select
            className="border p-3 rounded-md w-full"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
          >
            <option value="unique">Paiement unique</option>
            <option value="mensuel">Mensuel</option>
          </select>
        </div>

        {/* Nombre de mensualités */}
        {frequency === "mensuel" && (
          <div className="flex items-center gap-3 bg-blue-50 px-4 py-3 rounded-md border border-blue-200">
            <label className="text-sm font-medium text-blue-900 whitespace-nowrap">
              Nombre de mensualités :
            </label>
            <input
              type="number"
              min="2"
              max="36"
              className="border p-2 rounded-md w-20 text-center"
              value={installments}
              onChange={(e) => setInstallments(parseInt(e.target.value) || 1)}
            />
            <span className="text-xs text-blue-700">
              (Maximum 36 mois)
            </span>
          </div>
        )}

        {/* Montant calculé */}
        <div className="bg-gray-100 p-4 rounded-md text-sm text-gray-700">
          {coreAmount && frequency === "mensuel" && installments > 1 ? (
            <>
              <div className="mb-3 pb-3 border-b border-gray-300">
                <p className="text-xs text-gray-600 mb-1">Montant total initial :</p>
                <p className="text-sm">
                  <strong>{fiatAmount || 0} {currency}</strong> = <strong>{currency === "CORE" ? coreAmount.totalComplet.toFixed(6) : coreAmount.totalComplet.toFixed(2)} {currency}</strong>
                </p>
              </div>
              <p className="text-blue-700 font-semibold mb-2">
                📅 Paiement en {coreAmount.nbMensualites} mensualités :
              </p>
              <p>Montant brut par mensualité : <strong>{currency === "CORE" ? coreAmount.brut.toFixed(6) : coreAmount.brut.toFixed(2)} {currency}</strong></p>
              <p>Frais (1.79 %) par mensualité : <strong>{currency === "CORE" ? coreAmount.taxe.toFixed(6) : coreAmount.taxe.toFixed(2)} {currency}</strong></p>
              <hr className="my-2" />
              <p className="text-lg font-semibold">
                Total par mensualité : {currency === "CORE" ? coreAmount.total.toFixed(6) : coreAmount.total.toFixed(2)} {currency}
              </p>
              <p className="text-xs text-gray-600 mt-2">
                ({coreAmount.nbMensualites} x {currency === "CORE" ? coreAmount.total.toFixed(6) : coreAmount.total.toFixed(2)} {currency})
              </p>
            </>
          ) : coreAmount ? (
            <>
              <p>Montant brut : <strong>{currency === "CORE" ? coreAmount.brut.toFixed(6) : coreAmount.brut.toFixed(2)} {currency}</strong></p>
              <p>Frais (1.79 %) : <strong>{currency === "CORE" ? coreAmount.taxe.toFixed(6) : coreAmount.taxe.toFixed(2)} {currency}</strong></p>
              <hr className="my-2" />
              <p className="text-lg font-semibold">Total : {currency === "CORE" ? coreAmount.total.toFixed(6) : coreAmount.total.toFixed(2)} {currency}</p>
            </>
          ) : (
            <>
              <p>Montant brut : <strong>{currency === "CORE" ? "0.000000" : "0.00"} {currency}</strong></p>
              <p>Frais (1.79 %) : <strong>{currency === "CORE" ? "0.000000" : "0.00"} {currency}</strong></p>
              <hr className="my-2" />
              <p className="text-lg font-semibold">Total : {currency === "CORE" ? "0.000000" : "0.00"} {currency}</p>
            </>
          )}
        </div>

        {/* Options */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="cancellable"
              checked={canCancel}
              onChange={(e) => setCanCancel(e.target.checked)}
            />
            <label htmlFor="cancellable" className="text-sm">
              Permettre l'annulation avant échéance
            </label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="definitive"
              checked={definitive}
              onChange={(e) => setDefinitive(e.target.checked)}
            />
            <label htmlFor="definitive" className="text-sm">
              Paiement définitif (période de rétractation de 48h)
            </label>
          </div>
        </div>

        {/* Bouton de soumission */}
        <button
          type="submit"
          disabled={loading || !!errorMessage}
          className={`py-3 rounded-md font-medium mt-4 transition-all duration-200 ${
            loading || errorMessage
              ? 'bg-gray-400 cursor-not-allowed text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
          }`}
        >
          {loading ? "⏳ Traitement..." : "🚀 Programmer le paiement"}
        </button>
      </form>

      {/* Status */}
      {status && (
        <div className={`mt-4 p-3 rounded-md text-sm ${
          status.includes('❌') ? 'bg-red-50 text-red-700 border border-red-200' :
          status.includes('🎉') ? 'bg-green-50 text-green-700 border border-green-200' :
          'bg-blue-50 text-blue-700 border border-blue-200'
        }`}>
          {status}
        </div>
      )}

      {/* Informations */}
      <div className="mt-6 p-4 bg-gray-50 rounded-md text-xs text-gray-600">
        <h4 className="font-semibold mb-2">ℹ️ Comment ça fonctionne :</h4>
        <ul className="space-y-1">
          <li>• Votre paiement est verrouillé dans un smart contract</li>
          <li>• Il sera automatiquement libéré à la date programmée</li>
          <li>• Les frais (1.79%) ne sont prélevés qu'à la libération</li>
          <li>• Vous pouvez suivre l'état dans votre tableau de bord</li>
        </ul>
      </div>

      <p className="text-center mt-6 text-sm text-gray-500">
        Retrouvez vos paiements dans votre{" "}
        <span
          onClick={() => window.dispatchEvent(new CustomEvent("navigate", { detail: "dashboard" }))}
          className="text-blue-600 hover:underline cursor-pointer"
        >
          historique
        </span>.
      </p>

      {/* Modal de connexion */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-blue-600 mb-4 text-center">
              Créer un compte
            </h3>
            <p className="text-gray-600 mb-6 text-center">
              Connectez-vous pour suivre l'historique de vos paiements programmés.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowLoginModal(false);
                  window.dispatchEvent(new CustomEvent("navigate", { detail: "signup" }));
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md font-medium"
              >
                Créer un compte
              </button>
              <button
                onClick={() => setShowLoginModal(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 px-4 rounded-md font-medium"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
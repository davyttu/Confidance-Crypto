import React, { useState, useEffect } from "react";
import { ethers } from "ethers";

export default function PaymentForm({ user, wallet }) {
  const [fiatAmount, setFiatAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [corePrice, setCorePrice] = useState(null);
  const [coreAmount, setCoreAmount] = useState(null);
  const [exchangeRates, setExchangeRates] = useState(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [frequency, setFrequency] = useState("unique");
  const [installments, setInstallments] = useState(2);
  const [canCancel, setCanCancel] = useState(true);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // 💰 Récupérer le prix actuel du CORE et les taux de change
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=coredaoorg&vs_currencies=usd,eur,cny,jpy,gbp,chf,aud");
        const data = await res.json();
        setCorePrice(data.coredaoorg);
        setExchangeRates(data.coredaoorg);
      } catch (err) {
        console.error("Erreur récupération prix CORE:", err);
      }
    };
    fetchPrices();
  }, []);

  // 💵 Calculer le montant minimum (équivalent 10 USD)
  const getMinAmount = () => {
    if (!exchangeRates) return 10;
    
    const rateToUSD = {
      usd: 1,
      eur: exchangeRates.eur / exchangeRates.usd,
      cny: exchangeRates.cny / exchangeRates.usd,
      jpy: exchangeRates.jpy / exchangeRates.usd,
      gbp: exchangeRates.gbp / exchangeRates.usd,
      chf: exchangeRates.chf / exchangeRates.usd,
      aud: exchangeRates.aud / exchangeRates.usd
    };
    
    return (10 * rateToUSD[currency.toLowerCase()]).toFixed(2);
  };

  // 🧮 Calcul du montant en CORE
  useEffect(() => {
    if (!fiatAmount || !corePrice) {
      setErrorMessage("");
      return;
    }
    const rate = corePrice[currency.toLowerCase()];
    if (!rate) return;
    
    // Vérifier le montant minimum
    const minAmount = getMinAmount();
    if (parseFloat(fiatAmount) < parseFloat(minAmount)) {
      setErrorMessage(`Le montant minimum est de ${minAmount} ${currency} (équivalent à 10 USD)`);
    } else {
      setErrorMessage("");
    }
    
    // Montant total
    const montantTotal = parseFloat(fiatAmount);
    const brutTotal = montantTotal / rate;
    const taxeTotal = brutTotal * 0.0179;
    const totalComplet = brutTotal + taxeTotal;
    
    // Montant par mensualité
    const nbMensualites = frequency === "mensuel" && installments > 0 ? installments : 1;
    const brut = brutTotal / nbMensualites;
    const taxe = taxeTotal / nbMensualites;
    const total = totalComplet / nbMensualites;
    
    setCoreAmount({ brut, taxe, total, montantTotal, brutTotal, taxeTotal, totalComplet, nbMensualites });
  }, [fiatAmount, currency, corePrice, frequency, installments, exchangeRates]);

  // 🔥 Fonction d'envoi via MetaMask
  const handlePayment = async (e) => {
    e.preventDefault();
    try {
      if (!window.ethereum) {
        alert("Veuillez installer MetaMask pour continuer !");
        return;
      }

      if (!coreAmount || !coreAmount.total) {
        alert("Veuillez saisir un montant valide !");
        return;
      }

      // Vérifier le montant minimum
      const minAmount = getMinAmount();
      if (parseFloat(fiatAmount) < parseFloat(minAmount)) {
        alert(`Le montant minimum est de ${minAmount} ${currency} (équivalent à 10 USD)`);
        return;
      }

      setLoading(true);
      setStatus("⏳ Initialisation de la transaction...");

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // 🔢 Conversion en wei
      const amountInWei = ethers.parseEther(coreAmount.total.toFixed(8));

      const tx = await signer.sendTransaction({
        to: "0x0000000000000000000000000000000000000000", // ⚠️ à remplacer par l’adresse de ton contrat ou bénéficiaire
        value: amountInWei,
      });

      setStatus("✅ Transaction envoyée, en attente de confirmation...");
      await tx.wait();

      setStatus(`🎉 Paiement confirmé ! TX : ${tx.hash}`);
      alert(`✅ Paiement confirmé ! Vous retrouverez le détail dans votre historique.`);

      // 👉 Ici, tu pourrais aussi :
      // - Enregistrer la transaction dans ta base (via API)
      // - Rediriger vers la page “Historique”
    } catch (err) {
      console.error(err);
      setStatus("❌ Erreur lors du paiement ou transaction refusée.");
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="text-center p-8 bg-white rounded-2xl shadow">
        <h2 className="text-xl font-semibold text-blue-600 mb-4">Paiement différé</h2>
        <p className="text-gray-600 mb-4">
          Pour programmer un paiement différé, veuillez d’abord créer un compte.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto mt-10 p-8 bg-white rounded-2xl shadow-lg text-gray-800">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-blue-600 mb-3">
          Bienvenue sur votre espace de paiement différé
        </h2>
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-2 rounded-full border border-blue-200">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-medium text-blue-700">Programmer un paiement</span>
        </div>
      </div>

      <form onSubmit={handlePayment} className="flex flex-col gap-4">
        {/* Devise + Montant */}
        <div>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Montant"
              className={`border p-2 rounded-md flex-1 ${errorMessage ? 'border-red-500' : ''}`}
              value={fiatAmount}
              onChange={(e) => setFiatAmount(e.target.value)}
              step="0.01"
            />
            <select
              className="border p-2 rounded-md"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option>USD</option>
              <option>EUR</option>
              <option>CNY</option>
              <option>JPY</option>
              <option>GBP</option>
              <option>CHF</option>
              <option>AUD</option>
            </select>
          </div>
          {errorMessage && (
            <p className="text-red-600 text-sm mt-2 flex items-center gap-1">
              <span>⚠️</span>
              <span>{errorMessage}</span>
            </p>
          )}
          {!errorMessage && exchangeRates && (
            <p className="text-gray-500 text-xs mt-2">
              Montant minimum : {getMinAmount()} {currency} (≈ 10 USD)
            </p>
          )}
        </div>

        {/* Date et heure */}
        <input type="date" className="border p-2 rounded-md" value={date} onChange={(e) => setDate(e.target.value)} />
        <input type="time" className="border p-2 rounded-md" value={time} onChange={(e) => setTime(e.target.value)} />

        {/* Fréquence */}
        <select className="border p-2 rounded-md" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
          <option value="unique">Paiement unique</option>
          <option value="mensuel">Mensuel</option>
        </select>

        {/* Nombre de mensualités */}
        {frequency === "mensuel" && (
          <div className="flex items-center gap-3 bg-blue-50 px-3 py-2 rounded-md border border-blue-200">
            <label className="text-sm font-medium text-blue-900 whitespace-nowrap">
              Mensualités :
            </label>
            <input
              type="number"
              min="2"
              placeholder="2"
              className="border p-2 rounded-md w-20 text-center"
              value={installments}
              onChange={(e) => setInstallments(parseInt(e.target.value) || 1)}
            />
          </div>
        )}

        {/* Montant CORE */}
        <div className="bg-gray-100 p-4 rounded-md text-sm text-gray-700">
          {coreAmount && frequency === "mensuel" && installments > 1 ? (
            <>
              <div className="mb-3 pb-3 border-b border-gray-300">
                <p className="text-xs text-gray-600 mb-1">Montant total initial :</p>
                <p className="text-sm">
                  <strong>{fiatAmount || 0} {currency}</strong> = <strong>{coreAmount.totalComplet.toFixed(6)} CORE</strong>
                </p>
              </div>
              <p className="text-blue-700 font-semibold mb-2">
                📅 Paiement en {coreAmount.nbMensualites} mensualités :
              </p>
              <p>Montant brut par mensualité : <strong>{coreAmount.brut.toFixed(6)} CORE</strong></p>
              <p>Frais (1.79 %) par mensualité : <strong>{coreAmount.taxe.toFixed(6)} CORE</strong></p>
              <hr className="my-2" />
              <p className="text-lg font-semibold">
                Total par mensualité : {coreAmount.total.toFixed(6)} CORE
              </p>
              <p className="text-xs text-gray-600 mt-2">
                ({coreAmount.nbMensualites} x {coreAmount.total.toFixed(6)} CORE)
              </p>
            </>
          ) : coreAmount ? (
            <>
              <p>Montant brut : <strong>{coreAmount.brut.toFixed(6)} CORE</strong></p>
              <p>Frais (1.79 %) : <strong>{coreAmount.taxe.toFixed(6)} CORE</strong></p>
              <hr className="my-2" />
              <p className="text-lg font-semibold">Total : {coreAmount.total.toFixed(6)} CORE</p>
            </>
          ) : (
            <>
              <p>Montant brut : <strong>0.000000 CORE</strong></p>
              <p>Frais (1.79 %) : <strong>0.000000 CORE</strong></p>
              <hr className="my-2" />
              <p className="text-lg font-semibold">Total : 0.000000 CORE</p>
            </>
          )}
        </div>

        {/* Annulation */}
        <div className="flex items-center gap-2 mt-2">
          <input
            type="checkbox"
            checked={canCancel}
            onChange={() => setCanCancel(!canCancel)}
          />
          <label>
            L’utilisateur peut annuler à tout moment (sinon 48h de rétractation)
          </label>
        </div>

        <button
          type="submit"
          disabled={loading || !!errorMessage}
          className={`py-2 rounded-md font-medium mt-4 ${
            loading || errorMessage 
              ? 'bg-gray-400 cursor-not-allowed text-white' 
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {loading ? "Traitement..." : "Confirmer le paiement"}
        </button>
      </form>

      {status && <p className="text-center mt-4 text-sm text-gray-700">{status}</p>}

      <p className="text-center mt-6 text-sm text-gray-500">
        Retrouvez-le dans votre{" "}
        <span
          onClick={() => window.dispatchEvent(new CustomEvent("navigate", { detail: "dashboard" }))}
          className="text-blue-600 hover:underline cursor-pointer"
        >
          historique
        </span>.
      </p>
    </div>
  );
}

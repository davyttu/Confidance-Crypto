import React, { useState } from "react";
import { useUser } from "../context/UserContext";
import { ethers } from "ethers";

const factoryAbi = [
  "function createPayment(address,uint256,bool,bool) payable returns (address)",
  "function getUserPayments(address) view returns (address[])"
];

export default function NewPayment() {
  const { user } = useUser();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [cancellable, setCancellable] = useState(true);
  const [definitive, setDefinitive] = useState(false);
  const [status, setStatus] = useState("");

  const factoryAddress = import.meta.env.VITE_FACTORY_ADDRESS || "";

  async function handleSubmit(e) {
    e.preventDefault();
    if (!user) {
      setStatus("Créez un compte avant de programmer un paiement.");
      return;
    }
    if (!recipient || !amount || !date) {
      setStatus("Remplissez tous les champs");
      return;
    }

    const timestamp = Math.floor(new Date(date).getTime() / 1000);
    const amountWei = ethers.parseEther(amount.toString());

    try {
      if (!window.ethereum) throw new Error("Wallet requis (MetaMask)");
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();

      if (!factoryAddress) {
        // simulate: store locally
        const store = JSON.parse(localStorage.getItem("confidance_payments") || "[]");
        store.push({
          recipient, amount, date, cancellable, definitive, status: "Programmé (local)"
        });
        localStorage.setItem("confidance_payments", JSON.stringify(store));
        setStatus("Paiement simulé enregistré localement (pas de blockchain).");
        return;
      }

      const contract = new ethers.Contract(factoryAddress, factoryAbi, signer);
      setStatus("Envoi de la transaction — signature demandée...");
      const tx = await contract.createPayment(recipient, timestamp, cancellable, definitive, { value: amountWei });
      setStatus("Transaction envoyée — en attente de confirmation...");
      await tx.wait();
      setStatus("Paiement programmé sur la blockchain !");

      // optionally update local store
      const store = JSON.parse(localStorage.getItem("confidance_payments") || "[]");
      store.push({ contract: "onchain", recipient, amount, date, status: "Programmé (chain)" });
      localStorage.setItem("confidance_payments", JSON.stringify(store));
    } catch (err) {
      console.error(err);
      setStatus("Erreur : " + (err.message || String(err)));
    }
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto mt-16 p-8 bg-white rounded-2xl shadow text-center">
        <h3 className="text-xl font-semibold mb-2">Paiement différé</h3>
        <p className="text-gray-600 mb-4">Vous devez créer un compte avant de programmer un paiement.</p>
        <a href="/signup" className="bg-blue-600 text-white px-4 py-2 rounded-md">Créer un compte</a>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-10 bg-white p-8 rounded-2xl shadow">
      <h3 className="text-xl font-semibold text-blue-600 mb-4">Programmer un paiement</h3>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input value={recipient} onChange={e=>setRecipient(e.target.value)} placeholder="Adresse destinataire (0x...)" className="border p-2 rounded-md" />
        <input value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Montant (CORE)" type="number" className="border p-2 rounded-md" />
        <input value={date} onChange={e=>setDate(e.target.value)} type="date" className="border p-2 rounded-md" />
        <div className="flex items-center gap-3">
          <label className="text-sm"><input type="checkbox" checked={cancellable} onChange={e=>setCancellable(e.target.checked)} /> Annulable</label>
          <label className="text-sm"><input type="checkbox" checked={definitive} onChange={e=>setDefinitive(e.target.checked)} /> Paiement définitif (48h possible de rétractation)</label>
        </div>
        <button className="bg-blue-600 text-white py-2 rounded-md">Programmer</button>
      </form>

      {status && <div className="mt-4 text-sm text-gray-700">{status}</div>}
      <div className="mt-4 text-xs text-gray-500">
        <strong>Info :</strong> si vous annulez avant la date prévue, aucune taxe n'est prélevée. La taxe (1.79%) s'applique uniquement lors de la libération.
      </div>
    </div>
  );
}

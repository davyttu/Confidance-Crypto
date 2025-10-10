import React, { useEffect, useState } from "react";
import { useUser } from "../context/UserContext";
import PaymentCard from "../components/PaymentCard";

export default function Dashboard() {
  const { user } = useUser();
  const [payments, setPayments] = useState([]);

  // For now mock: read from localStorage "confidance_payments"
  useEffect(()=> {
    const data = JSON.parse(localStorage.getItem("confidance_payments") || "[]");
    setPayments(data);
  }, []);

  if (!user) {
    return <div className="text-center mt-20">Veuillez créer un compte pour accéder au tableau de bord.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto mt-8">
      <h1 className="text-2xl font-bold text-blue-600 mb-6">Tableau de bord · {user.name}</h1>

      {payments.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl shadow text-center">Aucun paiement pour l'instant — <a className="text-blue-600" href="/payment">Programmer un paiement</a></div>
      ) : (
        <div className="grid gap-4">
          {payments.map((p, i) => (
            <PaymentCard key={i} contractAddress={p.contract || "local:" + i} status={p.status} amount={p.amount} date={p.date} />
          ))}
        </div>
      )}
    </div>
  );
}

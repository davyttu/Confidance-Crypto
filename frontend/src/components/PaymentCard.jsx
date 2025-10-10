import React from "react";

const PaymentCard = ({ payment }) => {
  const { amount, recipient, releaseDate, cancellable, status } = payment;

  return (
    <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl shadow-md border border-white/20 hover:border-blue-400 transition-all">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-semibold text-white">
          {amount} USDT
        </h3>
        <span
          className={`px-3 py-1 text-xs rounded-full ${
            status === "Scheduled"
              ? "bg-blue-500/30 text-blue-200"
              : status === "Executed"
              ? "bg-green-500/30 text-green-200"
              : "bg-red-500/30 text-red-200"
          }`}
        >
          {status}
        </span>
      </div>

      <p className="text-sm text-gray-300">
        Destinataire : <span className="text-white">{recipient}</span>
      </p>
      <p className="text-sm text-gray-300">
        Déblocage prévu : <span className="text-white">{releaseDate}</span>
      </p>
      <p className="text-sm text-gray-300">
        Annulable :{" "}
        <span className="text-white">{cancellable ? "Oui" : "Non"}</span>
      </p>
    </div>
  );
};

export default PaymentCard;

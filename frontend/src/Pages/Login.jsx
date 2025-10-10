import React from "react";
import { Link } from "react-router-dom";

export default function Login() {
  return (
    <div className="max-w-md mx-auto mt-16 p-8 bg-white rounded-2xl shadow text-center">
      <h2 className="text-2xl font-bold text-blue-600 mb-4">Bienvenue</h2>
      <p className="text-gray-600 mb-6">Créez un compte pour programmer et suivre vos paiements.</p>
      <Link to="/signup" className="bg-blue-600 text-white px-4 py-2 rounded-md">Créer un compte</Link>
    </div>
  );
}

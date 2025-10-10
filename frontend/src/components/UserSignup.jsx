import React, { useState } from "react";

export default function UserSignup({ setUser }) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Simule la création d’un compte (à connecter plus tard à ton backend)
    const newUser = {
      name: formData.name,
      email: formData.email,
    };

    // ✅ Met à jour le parent (App.jsx)
    setUser(newUser);

    // ✅ Feedback visuel immédiat
    setSuccess(true);

    // ✅ Redirection automatique après 2 secondes vers la page paiement
    setTimeout(() => {
      window.scrollTo(0, 0); // remonte en haut
      window.dispatchEvent(new CustomEvent("navigate", { detail: "payment" }));
    }, 1500);
  };

  return (
    <div className="max-w-md mx-auto mt-16 p-8 bg-white rounded-2xl shadow">
      <h2 className="text-2xl font-bold text-center text-blue-600 mb-6">
        Créer un compte Confidance Crypto
      </h2>

      {!success ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            name="name"
            placeholder="Nom complet"
            onChange={handleChange}
            value={formData.name}
            required
            className="border border-gray-300 p-2 rounded-md"
          />
          <input
            type="email"
            name="email"
            placeholder="Adresse email"
            onChange={handleChange}
            value={formData.email}
            required
            className="border border-gray-300 p-2 rounded-md"
          />
          <input
            type="password"
            name="password"
            placeholder="Mot de passe"
            onChange={handleChange}
            value={formData.password}
            required
            className="border border-gray-300 p-2 rounded-md"
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md font-medium"
          >
            Créer mon compte
          </button>
        </form>
      ) : (
        <p className="text-green-600 text-center font-medium">
          ✅ Compte créé avec succès ! Redirection vers la page Paiement...
        </p>
      )}
    </div>
  );
}

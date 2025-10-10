import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="text-center mt-24">
      <h1 className="text-4xl font-bold text-blue-600 mb-4">
        Bienvenue sur Confidance Crypto
      </h1>
      <p className="text-gray-600 mb-8">
        La solution de paiements différés sécurisés sur blockchain.
      </p>
      <Link
        to="/signup"
        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md font-medium"
      >
        Créer un compte
      </Link>
    </div>
  );
}

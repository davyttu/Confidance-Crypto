import React, { useState } from "react";
import Navbar from "./components/Navbar";
import PaymentForm from "./components/PaymentForm";
import UserDashboard from "./components/UserDashboard";
import UserSignup from "./components/UserSignup";

function App() {
  const [user, setUser] = useState(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [page, setPage] = useState("signup");

  React.useEffect(() => {
  const handleNavigation = (e) => setPage(e.detail);
  window.addEventListener("navigate", handleNavigation);
  return () => window.removeEventListener("navigate", handleNavigation);
}, []);

{page === "payment" && (
  <PaymentForm user={user} wallet={walletAddress} onNavigate={setPage} />
)}



  // ✅ Lorsqu’un wallet est connecté
  const handleConnectWallet = (address) => {
    setWalletAddress(address);
    console.log("✅ Wallet connecté :", address);
  };

  // 🔒 Déconnexion utilisateur
  const handleLogout = () => {
    setUser(null);
    setWalletAddress("");
    setPage("signup");
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Navbar
        user={user}
        onLogout={handleLogout}
        onNavigate={setPage}
        onConnectWallet={handleConnectWallet}
      />

      <main className="p-8">
        {page === "signup" && <UserSignup setUser={setUser} />}
        {page === "dashboard" && (
          <UserDashboard user={user} wallet={walletAddress} />
        )}
        {page === "payment" && (
          <PaymentForm user={user} wallet={walletAddress} />
        )}
      </main>
    </div>
  );
}

export default App;

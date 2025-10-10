import { useState } from "react";
import { ethers } from "ethers";

export default function useWallet() {
  const [address, setAddress] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);

  async function connect() {
    if (!window.ethereum) throw new Error("MetaMask non détecté");
    const p = new ethers.BrowserProvider(window.ethereum);
    // Request accounts
    await p.send("eth_requestAccounts", []);
    const s = await p.getSigner();
    const a = await s.getAddress();
    setProvider(p);
    setSigner(s);
    setAddress(a);
    return { provider: p, signer: s, address: a };
  }

  function reset() {
    setAddress(null);
    setProvider(null);
    setSigner(null);
  }

  return { address, provider, signer, connect, reset };
}

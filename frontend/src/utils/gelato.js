import { GelatoRelay } from "@gelatonetwork/relay-sdk";
import { ethers } from "ethers";

const relay = new GelatoRelay();

export async function triggerScheduledPayment(contractAddress, abi, apiKey) {
  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(contractAddress, abi, signer);

    const data = contract.interface.encodeFunctionData("executeScheduledPayments");

    const request = {
      chainId: 1116, // Core Testnet
      target: contractAddress,
      data,
      sponsorApiKey: apiKey,
    };

    const response = await relay.sponsoredCall(request);
    console.log("Paiement Gelato exécuté :", response);
  } catch (err) {
    console.error("Erreur Gelato:", err);
  }
}

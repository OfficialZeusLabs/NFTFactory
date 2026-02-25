"use client";

import {
  EthereumClient,
  w3mConnectors,
  w3mProvider,
} from "@web3modal/ethereum";
import { Web3Modal } from "@web3modal/react";
import { configureChains, createConfig, WagmiConfig } from "wagmi";
import { publicProvider } from "wagmi/providers/public";

// Base Sepolia chain definition
const baseSepoliaChain = {
  id: 84532,
  name: 'Base Sepolia',
  network: 'base-sepolia',
  nativeCurrency: {
    decimals: 18,
    name: 'Base Sepolia Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_ALCHEMY_BASE_SEPOLIA_RPC || "https://sepolia.base.org"],
    },
    public: {
      http: [process.env.NEXT_PUBLIC_ALCHEMY_BASE_SEPOLIA_RPC || "https://sepolia.base.org"],
    },
  },
  blockExplorers: {
    default: { name: 'BaseScan', url: 'https://sepolia.basescan.org' },
  },
  testnet: true,
};

const chains = [baseSepoliaChain];

// Use environment variable for project ID (should be set in .env.local)
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "34043931dedf67433e6f95bfa3205586";

const { publicClient } = configureChains(
  chains,
  [w3mProvider({ projectId }), publicProvider()]
);

// Use Web3Modal's built-in connectors which include Coinbase Wallet
const connectors = w3mConnectors({ 
  projectId, 
  chains,
  version: 2 // Use WalletConnect v2
});

export const wagmiConfig = createConfig({
  autoConnect: true,
  connectors,
  publicClient,
});

const ethereumClient = new EthereumClient(wagmiConfig, chains);

export default function WalletConnect() {
  return (
    <>
      <WagmiConfig config={wagmiConfig}></WagmiConfig>
      <Web3Modal 
        projectId={projectId} 
        ethereumClient={ethereumClient}
        defaultChain={baseSepoliaChain}
        themeMode="dark"
        themeVariables={{
          '--w3m-accent-color': '#F59E0B',
        }}
      />
    </>
  );
}

"use client";
import Image from "next/image";
import Button from "../Button";
import { useState, useEffect } from "react";
import { useWeb3Modal } from "@web3modal/react";
import { getAccount, connect } from "@wagmi/core";
import { InjectedConnector } from "wagmi/connectors/injected";
import { orbitron } from "@/fonts/fonts";
import { poppins } from "@/fonts/fonts";
import { useDispatch } from "react-redux";
import { setWalletAddress, setWalletConnected } from "@/reducers/userSlice";
import APIService from "@/http/api_service";

interface NavToolsProps {
  title?: string;
  isMenu?: boolean;
}

const NavTools: React.FC<NavToolsProps> = (props) => {
  const dispatch = useDispatch(); 
  const [buttonText, setButtonText] = useState("Connect Wallet");
  const { open } = useWeb3Modal();
  const { title, isMenu = false } = props;
  const { address, isConnected } = getAccount();

  useEffect(() => {
    if (isConnected) {
      const requestBody = { 
        wallet_address: address, 
      };
      APIService.createProfile(requestBody, (response: any, error: any) => {
        if(error){
          console.log(error, "#error"); 
        }
        console.log(response, "#response-data");
      })
      // @ts-ignore
      const short = `${address.slice(0, 5)}...${address.slice(-4)}`;
      setButtonText(short);
      dispatch(setWalletAddress(address));
      dispatch(setWalletConnected(true));
    } else {
      setButtonText("Connect Wallet");
    }
  }, [isConnected, address]);

  // Function to detect and connect to Coinbase/Base Wallet
  const connectToBaseWallet = async () => {
    // Check if Coinbase Wallet (Base Wallet) is installed
    const ethereum = (window as any).ethereum;
    
    // Check for Coinbase Wallet
    const isCoinbaseWallet = ethereum?.isCoinbaseWallet || 
      ethereum?.providers?.some((p: any) => p.isCoinbaseWallet);
    
    // Check for any injected wallet (MetaMask, Coinbase, etc.)
    const hasInjectedWallet = typeof ethereum !== 'undefined';
    
    if (hasInjectedWallet) {
      try {
        // Create a new injected connector that will use the browser wallet
        const injectedConnector = new InjectedConnector({
          chains: [{
            id: 84532,
            name: 'Base Sepolia',
            network: 'base-sepolia',
            nativeCurrency: { decimals: 18, name: 'Base Sepolia Ether', symbol: 'ETH' },
            rpcUrls: {
              default: { http: ['https://sepolia.base.org'] },
              public: { http: ['https://sepolia.base.org'] },
            },
          }],
          options: {
            name: isCoinbaseWallet ? 'Coinbase Wallet' : 'Injected Wallet',
            shimDisconnect: true,
          },
        });
        
        await connect({ connector: injectedConnector });
      } catch (error) {
        console.log("Direct wallet connection failed, opening modal", error);
        await open();
      }
    } else {
      // No injected wallet found, open the modal
      await open();
    }
  };

  return (
    <>
      {isMenu ? (
        <div className="w-[90%] mx-auto flex justify-between">
          <h2 className={`${orbitron.className} text-2xl text-white`}>
            {title}
          </h2>
          <div className="flex flex-row gap-3 items-center">
            <button
              className="bg-gradient-linear rounded-md px-3 py-2 text-sm"
              onClick={async () => {
                await connectToBaseWallet();
              }}
            >
              {buttonText}
            </button>
            <a href="/profile">
              <Image
                height={25}
                width={25}
                src={"/profile.svg"}
                alt={"profile"}
                style={{ cursor: "pointer" }}
              />
            </a>
          </div>
        </div>
      ) : (
        <>
          <button
            className="bg-gradient-linear rounded-md px-3 py-2 text-md"
            onClick={async () => {
              await connectToBaseWallet();
            }}
          >
            {buttonText}
          </button>
          <a href="/profile">
            <Image
              height={25}
              width={25}
              src={"/profile.svg"}
              alt={"profile"}
              style={{ cursor: "pointer" }}
            />
          </a>
        </>
      )}
    </>
  );
};

export default NavTools;

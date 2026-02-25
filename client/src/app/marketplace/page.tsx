"use client";
import TopNavigation from "@/common/navs/top/TopNavigation";
import React, { useState, useEffect } from "react";
import TrendingCollection from "@/components/marketplace/TrendingCollections";
import SearchCollection from "@/components/marketplace/SearchCollection";
import Footer from "@/components/Footer";
import NSMECollection from "@/components/marketplace/NSMECollection";
import TopSellers from "@/components/marketplace/TopSellers";
import { readFactoryContract, readSimpleCollectibleContract, hasActiveSubscription } from "@/utils";
import axios from "axios";
import ProjectCollection from "@/components/marketplace/ProjectCollection";
import { useAccount } from "wagmi";
import Link from "next/link";

const MarketPlace: React.FC = () => {
  const { address: walletAddress } = useAccount();
  const [collections, setCollections] = useState<any[]>([]);
  const [owners, setOwners] = useState<any[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [names, setNames] = useState<string[]>([]);
  const [hasSubscription, setHasSubscription] = useState<boolean | null>(null);

  useEffect(() => {
    console.log("jjj");
    readFactoryContract("getMarketPlaces").then((result: unknown) => {
      console.log(result);
      const res = result as any[];
      res.forEach((address: any) => {
        console.log(address);
        readSimpleCollectibleContract(address, "getData").then((dataResult: unknown) => {
          console.log(dataResult);
          const data = dataResult as any[];
          data &&
            setCollections((existingCollections: any[]) => [
              ...existingCollections,
              ...data,
            ]);
          readSimpleCollectibleContract(address, "name").then((name) => {
            console.log(name);
            name &&
              setNames((existingNames: string[]) => [...existingNames, String(name)]);
            data &&
              data.forEach((response: any) => {
                console.log(response, response.uri);
                axios.get(response.uri).then((axiosResponse) => {
                  console.log(axiosResponse);
                  setImages((existingImages: string[]) => [
                    ...existingImages,
                    axiosResponse.data.image,
                  ]);
                });
                readSimpleCollectibleContract(address, "getOwners", [
                  parseFloat(response.index),
                ]).then((ownersResult: unknown) => {
                  const owners = ownersResult as any[];
                  owners && setOwners(owners);
                });
              });
          });
        });
      });
    });
    
    // Also fetch live marketplace data
    const fetchLiveMarketData = async () => {
      try {
        // Fetch live data from the Next.js API route
        const response = await fetch('/api/marketplace/trending');
        const data = await response.json();
        
        console.log("Fetched live marketplace data:", data);
      } catch (error) {
        console.error("Error fetching live marketplace data:", error);
      }
    };
    
    fetchLiveMarketData();
  }, []);

  // Check subscription status
  useEffect(() => {
    if (walletAddress) {
      hasActiveSubscription(walletAddress as `0x${string}`).then(setHasSubscription);
    }
  }, [walletAddress]);

  return (
    <>
      <TopNavigation />
      <div className="mx-auto w-[97%] tablet_l:w-[94%] laptop_l:w-[89%] max-w-[1280px]">
        {/* Subscription Banner */}
        {hasSubscription === false && (
          <div className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 border border-purple-500/30 rounded-xl p-6 mb-6 mt-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Get a Subscription to Create Collections</h3>
                  <p className="text-gray-400 text-sm">
                    Mint a subscription NFT to unlock the launchpad and create your own NFT collections
                  </p>
                </div>
              </div>
              <Link href="/subscription">
                <button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-all whitespace-nowrap">
                  View Subscriptions
                </button>
              </Link>
            </div>
          </div>
        )}
        
        {/* Active Subscription Badge */}
        {hasSubscription === true && (
          <div className="bg-gradient-to-r from-green-900/30 to-green-700/30 border border-green-500/30 rounded-xl p-4 mb-6 mt-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <span className="text-green-400 font-semibold">Active Subscription</span>
                <span className="text-gray-400 text-sm ml-2">You can create collections on the launchpad</span>
              </div>
            </div>
          </div>
        )}

        <SearchCollection />
        <TrendingCollection
          collections={collections}
          owners={owners}
          names={names}
          images={images}
        />
        <NSMECollection
          collections={collections}
          owners={owners}
          names={names}
          images={images}
        />
        <ProjectCollection />
        <TopSellers />
      </div>
      <Footer />
    </>
  );
};

export default MarketPlace;

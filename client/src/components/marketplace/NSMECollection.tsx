import React, { useState, useEffect } from "react";
import { orbitron } from "@/fonts/fonts";
import CollectionCard from "../CollectionCard";
import { nsmeCollection } from "@/data/collection";
import Link from "next/link";
import axios from "axios";

type Props = {
  names: string[];
  images: string[];
  collections: any[];
  owners: any[];
};

const NSMECollection = ({ collections, owners, names, images }: Props) => {
  // State to hold live data for each collection
  const [collectionStats, setCollectionStats] = useState<{[key: string]: {floorPrice: number;totalVolume: number;}}>({});

  // Fetch live data for each collection
  useEffect(() => {
    const fetchCollectionStats = async () => {
      for (let i = 0; i < collections.length; i++) {
        const { mintFee, index } = collections[i];
        try {
          // Fetch live data from the Next.js API route
          const response = await axios.get(`/api/marketplace/collections/stats`);
          
          // Find the matching collection stats
          const contractAddress = ""; // This would come from your collections data
          const stats = response.data.data.find(
            (stat: any) => stat.contractAddress === contractAddress
          );
          
          if (stats) {
            setCollectionStats((prev: {[key: string]: {floorPrice: number;totalVolume: number;}}) => ({
              ...prev,
              [index]: {
                floorPrice: stats.floorPrice,
                totalVolume: stats.totalVolume
              }
            }));
          } else {
            // Fallback to calculation based on current data
            setCollectionStats((prev: {[key: string]: {floorPrice: number;totalVolume: number;}}) => ({
              ...prev,
              [index]: {
                floorPrice: parseFloat(mintFee) / 10 ** 18,
                totalVolume: (parseFloat(mintFee) / 10 ** 18) * (owners.length || 1)
              }
            }));
          }
        } catch (error) {
          console.error(`Error fetching stats for collection ${index}:`, error);
          // Set fallback values
          setCollectionStats((prev: {[key: string]: {floorPrice: number;totalVolume: number;}}) => ({
            ...prev,
            [index]: {
              floorPrice: parseFloat(mintFee) / 10 ** 18,
              totalVolume: (parseFloat(mintFee) / 10 ** 18) * (owners.length || 1)
            }
          }));
        }
      }
    };

    if (collections.length > 0) {
      fetchCollectionStats();
    }
  }, [collections, owners]);

  return (
    <div>
      <div className="text-center mb-8 mt-6">
        <h2 className={`${orbitron.className} text-3xl text-white}`}>
          NFTs Collection by NSMEs
        </h2>
        <p className="text-white">
          Check out all the latest Product NFTs from your favourite brand
          worldwide
        </p>
      </div>

      <div className="w-[85%] tablet:w-full mx-auto">
        <div
          className={`grid grid-cols-1 tablet:grid-cols-2 tablet_l:grid-cols-3 text-white gap-6 ${orbitron.className}`}
        >
          {collections.map(({ mintFee, index }, i) => {
            const stats = collectionStats[index] || {
              floorPrice: parseFloat(mintFee) / 10 ** 18,
              totalVolume: (parseFloat(mintFee) / 10 ** 18) * (owners.length || 1)
            };
            
            return (
              <CollectionCard key={index} title={names[0]} source={images[0]}>
                <div className="flex justify-between">
                  <div className="text-white">
                    <p>Floor</p>
                    <p>{stats.floorPrice.toFixed(4)} ETH</p>
                  </div>
                  <div>
                    <p>Total Volume</p>
                    <p>{stats.totalVolume.toFixed(4)} ETH</p>
                  </div>
                </div>
                <Link href={`/collections/${parseFloat(index) + 1}`}>
                  <div className="my-6 underline text-center">View Details</div>
                </Link>
              </CollectionCard>
            );
          })}
        </div>
        <div className="flex justify-end my-8">
          <Link href="/">
            <p className="underline text-white">See more</p>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NSMECollection;

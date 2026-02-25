"use client";

import profile from "@/assets/images/profile.png";
import Card from "@/common/card";
import ProfileSideBar from "@/common/navs/side/ProfileSidebar";
import TopNavigation from "@/common/navs/top/TopNavigation";
import { poppins } from "@/fonts/fonts";
import APIService from "@/http/api_service";
import { getWalletAddress, getWalletConnected } from "@/reducers/userSlice";
import { readFactoryContract, readSimpleCollectibleContract, getUserSubscription, SubscriptionTier, getAllUserNFTs } from "@/utils";
import axios from "axios";
import Image from "next/image";
import React, { useEffect, useState } from "react";
import { AiOutlineMenu } from "react-icons/ai";
import { useSelector } from "react-redux";
import { useAccount, useBalance } from "wagmi";
import Link from "next/link";

const Profile: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({
    address: address,
    chainId: 84532, // Base Sepolia
  });
  const walletAddress = useSelector(getWalletAddress);
  const connected = useSelector(getWalletConnected);
  const [Open, setOpen] = useState(true);
  const [name, setName] = useState("");
  const [mintFee, setMintFee] = useState<number[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [profileData, setProfile] = useState<any>({});
  const [subscriptionId, setSubscriptionId] = useState<bigint | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [userNFTs, setUserNFTs] = useState<any[]>([]);

  const menuNav = () => {
    setOpen(!Open);
  };

  useEffect(() => {
    // let wallet = "0xe0a9462AFFf9E7cB8ABAC3CBb56F87337344433b";
    if(connected){
      if(walletAddress){
        APIService.fetchProfile(walletAddress, (response: any, error: any) => { 
          if(error){
            console.log(error); 
            return;
          }
          const responseData = response["data"];
          setProfile({...responseData});
        })
        
        // Check subscription
        getUserSubscription(walletAddress as `0x${string}`).then((subId) => {
          if (subId) {
            setSubscriptionId(subId);
            // Determine tier name based on subscription ID or fetch from contract
            setSubscriptionTier("Active");
          }
        });
        
        // Load user's NFTs
        getAllUserNFTs(walletAddress as `0x${string}`).then((nfts) => {
          setUserNFTs(nfts);
          setLoading(false);
        });
      }
    }
  }, [connected, walletAddress]);
  

  useEffect(() => {
    readFactoryContract("getMarketPlaces").then((result: unknown) => {
      console.log(result);
      const addresses = result as any[];
      addresses.forEach((contractAddress: any) => {
        readSimpleCollectibleContract(contractAddress, "getData", [
          address,
        ]).then((dataResult: unknown) => {
          const items = dataResult as any[];
          readSimpleCollectibleContract(contractAddress, "name").then(
            (name) => {
              name && setName(String(name));
              items && Array.isArray(items) &&
                items.forEach((response: any, _i: number) => {
                  console.log(response, response.uri);
                  setMintFee((existingCollections: number[]) => [
                    ...existingCollections,
                    parseFloat(response.mintFee) / 10 ** 18,
                  ]);
                  axios.get(response.uri).then((axiosResponse) => {
                    console.log(axiosResponse);
                    setImages((existingImages: string[]) => [
                      ...existingImages,
                      axiosResponse.data.image,
                    ]);
                  });
                });
            }
          );
        });
      });
    });
  }, []);

  return (
    <>
      <TopNavigation />
      <div
        className={
          Open
            ? "flex flex-row gap-10  min-h-screen"
            : " flex flex-row min-h-screen gap-0"
        }
      >
        <div
          className={
            Open
              ? "w-[11rem] laptop:w-[15rem] h-screen"
              : "relative w-[0rem]  h-screen"
          }
        >
          {Open ? (
            <ProfileSideBar menuNav={menuNav} />
          ) : (
            <div className="absolute top-16 cursor-pointer" onClick={menuNav}>
              <AiOutlineMenu className="h-6 w-6 items-center" />
            </div>
          )}
        </div>
        <div
          className={
            Open
              ? "mr-auto w-[70%] py-10 mt-20"
              : "w-[97%] mt-20 tablet_l:w-[94%] laptop_l:w-[89%]  max-w-[1280px] mx-auto py-10 "
          }
        >
          {
            profileData && 
            <>
            <div
              className="flex flex-col"
              style={{
                background:
                  "linear-gradient(180deg, rgba(0, 0, 0, 0.47) 0%, rgba(10, 4, 9, 1) 100%)",
              }}
            >
              <Image
                src={profile}
                alt="user img_profile"
                className="rounded-full mb-4"
                height={150}
                width={150}
              />
              <div
                className={`${poppins.className} flex justify-between items-center`}
              >
                <div>
                  <p className="text-2xl font-light">@{profileData?.username || address?.slice(0, 8)}</p>
                  {balance && (
                    <p className="text-sm text-gray-400 mt-1">
                      Balance: {parseFloat(balance.formatted).toFixed(4)} {balance.symbol}
                    </p>
                  )}
                  {subscriptionId !== null && (
                    <p className="text-sm text-green-400 mt-1">
                      ✓ Subscription Active (ID: {subscriptionId.toString()})
                    </p>
                  )}
                </div>
                <div className="flex flex-row gap-2">
                  <Image
                    src="/pen-edit.svg"
                    alt="edit-profile"
                    height={20}
                    width={20}
                  />
                  <Link href="/profile/edit">
                  <span className="text-primary">
                    Edit Profile
                    </span>
                  </Link>
                </div>
              </div>
              <div className="flex gap-4 mt-5">
                {["discord.svg", "twitter.svg"].map((item) => {
                  let socialLink = item.split('.')[0];
                  return (
                  <a 
                  href={`${profileData[socialLink] || "#" }`} 
                  key={item}
                  target="_blank">
                  <Image
                    src={`/${item}`}
                    alt="social icon"
                    height={30}
                    width={30}
                    style={{ cursor: "pointer" }}
                  />
                  </a>
                )})}
              </div>
            </div>
            <div className="mt-8 w-3/4">
              <h2 className="text-2xl mb-4">My NFTs</h2>
              {loading ? (
                <p className="text-gray-400">Loading your NFTs...</p>
              ) : userNFTs.length > 0 ? (
                <>
                  <p className="text-primary mt-3 mb-2">
                    Owned NFTs ({userNFTs.length})
                  </p>
                  <div className="grid grid-cols-1 tablet:grid-cols-2 laptop:grid-cols-3 gap-6">
                    {userNFTs.map((nft, i) => (
                      <div key={i} className="bg-gray-800 rounded-lg p-4">
                        <p className="text-sm text-gray-400">{nft.collectionName}</p>
                        <p className="text-lg font-semibold">Token #{nft.tokenId}</p>
                        <a 
                          href={nft.tokenURI} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-400 text-sm underline"
                        >
                          View Metadata
                        </a>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-gray-400">You don&apos;t own any NFTs yet.</p>
              )}
            </div>
            </>
          }
        </div>
      </div>
    </>
  );
};

export default Profile;

"use client";

import React, { useEffect, useState } from "react";
import TopNavigation from "@/common/navs/top/TopNavigation";
import Footer from "@/components/Footer";
import styles from "@/styles/Home.module.css";
import { orbitron } from "@/fonts/fonts";
import { poppins } from "@/fonts/fonts";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  prepareWriteContract,
  writeContract,
  waitForTransaction,
} from "@wagmi/core";

import {
  usePrepareContractWrite,
  useContractWrite,
  useWaitForTransaction,
  useAccount,
} from "wagmi";
import { SimpleCollectible } from "../../../../constants";
import { readFactoryContract, readSimpleCollectibleContract } from "@/utils";
import axios from "axios";
import { toast } from "react-toastify";
import { parseEther } from "viem";

const Details = () => {
  const { isConnected, address } = useAccount();
  const pathName = usePathname();
  const router = useRouter();
  const params = parseFloat(pathName.charAt(pathName.length - 1));
  const [collection, setCollection] = useState({ mintFee: 0 });
  const [owners, setOwners] = useState<any[]>([]);
  const [image, setImage] = useState("");
  const [cAddress, setAddress] = useState<`0x${string}`>(
    "0x950384443e2455E93010BeeC53Fd24e3aaD04C67"
    //"0x74327bBA4Afbbdb553652989E6a2d7D6B9bf31A0"
  );
  const [name, setName] = useState("");
  const [isRedeemed, setIsRedeemed] = useState(false);

  useEffect(() => {
    console.log("jjj");
    readFactoryContract("getMarketPlaces").then((res: unknown) => {
      console.log(res);
      const addresses = Array.isArray(res) ? res : [];
      addresses.forEach((address: any) => {
        console.log(address);
        readSimpleCollectibleContract(address, "getData").then(
          (data: unknown) => {
            console.log(data, address);
            const dataArray = Array.isArray(data) ? data : [];
            dataArray[params] &&
              setCollection({
                mintFee: parseFloat(dataArray[params].mintFee) / 10 ** 18,
              });
            readSimpleCollectibleContract(address, "name").then((name) => {
              console.log(name, data);
              setAddress(address);
              name && setName(String(name));
              dataArray[params] &&
                axios.get(dataArray[params].uri).then((axiosResponse) => {
                  console.log(axiosResponse);
                  setImage(axiosResponse.data.image);
                  readSimpleCollectibleContract(address, "getOwners", [
                    parseFloat(dataArray[params].index),
                  ]).then((owners: unknown) => {
                    console.log(owners, "fff");
                    const ownersArray = Array.isArray(owners) ? owners : [];
                    setOwners(ownersArray);
                  });
                });
            });
          }
        );
      });
    });
  }, []);

  const {
    config,
    error: prepareError,
    isError: isPrepareError,
  } = usePrepareContractWrite({
    address: cAddress,
    abi: SimpleCollectible.abi,
    functionName: "createCollectible",
    args: [address, params],
    value: parseEther(String(collection.mintFee * 100)),
  });
  const { data, error, isError, write } = useContractWrite(config);

  const { isSuccess } = useWaitForTransaction({
    hash: data?.hash,
  });

  useEffect(() => {
    console.log(String(collection.mintFee * 100), collection.mintFee);
    if (isSuccess) {
      toast.dismiss();
      toast.success("Minted Successfully", { theme: "colored" });
      router.push("");
      //setIsRedeemed(true);
    } else if ((isPrepareError || isError) && collection.mintFee) {
      toast.error(prepareError?.message || error?.message, {
        theme: "colored",
      });
    }
  }, [isSuccess, isError, isPrepareError]);

  useEffect(() => {
    async function updateUI() {
      if (isConnected) {
        //@ts-ignore
        const balance = await getbalance();
        console.log("balance is ", balance);
        //@ts-ignore
        if (parseInt(balance) > 0) {
          setIsRedeemed(true);
        }
      }
    }
    updateUI();
  }, [isConnected]);

  async function getbalance() {
    const balance = await readSimpleCollectibleContract(
      "0x9a5CfF1ca498D7f01c14d288F794f0d1093Fd3C1",
      "balanceOf",
      [address]
    );
    return balance;
  }

  const Mint = () => {
    if (!isRedeemed) {
      toast.success("Transaction in progress, confirm in wallet", {
        autoClose: false,
      });
      write?.();
    }
    // router.push("/collections/mint");
    // 0x74327bBA4Afbbdb553652989E6a2d7D6B9bf31A0 --old contract address
  };

  async function getTokenId(tokenId: number) {
    console.log("entering get Token id");
    const owner = await readSimpleCollectibleContract(
      "0x9a5CfF1ca498D7f01c14d288F794f0d1093Fd3C1",
      "ownerOf",
      [tokenId]
    );
    return owner;
  }
  async function prepareCancel() {
    console.log("entering perapare cancel");
    for (let i = 0; i < 100; i++) {
      console.log(i);
      if (address == (await getTokenId(i))) {
        console.log(`found ${i}`);
        return i;
      }
    }
  }
  async function _prepareCancel() {
    const tokens = await readSimpleCollectibleContract(
      //"0xCd922Fe5fdbFE76916d08d72ed8c4C4F33F960e6",
      "0x9a5CfF1ca498D7f01c14d288F794f0d1093Fd3C1",
      "getTokenData",
      [address]
    );
    const tokensArray = Array.isArray(tokens) ? tokens : [];
    return tokensArray[0];
  }

  const Redeem = async () => {
    const progress = toast.success(
      "Transaction in progress, confirm in wallet",
      {
        autoClose: false,
      }
    );
    // write?.();
    // router.push("/collections/mint");
    //const tokenId = await prepareCancel();
    const tokenId = await _prepareCancel();
    const request = await prepareWriteContract({
      address: "0x9a5CfF1ca498D7f01c14d288F794f0d1093Fd3C1",
      abi: SimpleCollectible.abi,
      functionName: "redeem",
      args: [tokenId, params],
    });
    console.log("value is ", request);
    const { hash } = await writeContract(request);
    const data = await waitForTransaction({
      confirmations: 1,
      hash,
    });
    if (data.status == "success") {
      toast.dismiss(progress);
      toast.success(`NFT with Id ${tokenId} was redeemed successfully`);
    }
    console.log("data is ", data);
  };

  return (
    <div className="mt-24">
      <TopNavigation />
      <div className="text-white">
        <div className="flex gap-8 gap-y-16 items-end flex-col tablet_l:flex-row mx-auto w-[97%] tablet_l:w-[94%] laptop_l:w-[89%] max-w-[1280px]">
          <div className="mr-auto">
            <Image
              src={image}
              alt=""
              height={800}
              width={808}
              className="w-[100%] tablet_l:w-[350px] max-w-[400px] "
              // style={{ width: "568px", height: "400px" }}
            />
            <div></div>
            <p
              className={`${orbitron.className} flex gap-3 tracking-wide items-center mt-3 `}
              // className=""
            >
              {name} NFTS
              <Image
                src="/images/badge-check.svg"
                alt=""
                height={20}
                width={20}
                className="w-[20px] h-[20px]"
              />
            </p>
          </div>
          <div className="">
            <h4 className={`${poppins.className} text-2xl `}>
              About Collection
            </h4>
            <p className="mt-3 mb-6">
              Lorem ipsum dolor sit amet, consectetur adipisicing elit.
              Laudantium est quia illo nisi, cumque laborum vero quae maxime
              ratione nulla veniam, perferendis recusandae. Temporibus, minus
              sunt nobis asperiores qui iure.
            </p>
            <ul className="gap-3 flex flex-col list-disc">
              <li>Benefit of Feature</li>
              <li>Benefit of Feature</li>
              <li>Benefit of Feature</li>
            </ul>
          </div>
        </div>
        <div className="text-2xl w-[97%] tablet_l:w-[94%] laptop_l:w-[89%] max-w-[1280px] mx-auto my-14">
          <p className={`${orbitron.className} text-2xl `}>
            Product/Package type
          </p>
          <p className="bg-[#FFC72C] h-[1.5px] my-7"></p>
          <div className="flex flex-wrap gap-5 justify-between">
            <p className="flex flex-col text-[15px]">
              Unique Owners
              <span className={`${orbitron.className} text-xl`}>
                {owners.length} Owners
              </span>
            </p>
            <div>
              <p className="text-[15px]">Mint price</p>
              <p className={`${orbitron.className} text-xl`}>
                {collection.mintFee} eth
              </p>
            </div>
            {isRedeemed ? (
              <button className={styles.home_btn} onClick={Redeem}>
                Redeem
              </button>
            ) : (
              <button className={styles.home_btn} onClick={Mint}>
                Mint
              </button>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Details;

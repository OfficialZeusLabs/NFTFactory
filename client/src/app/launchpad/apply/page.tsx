/**
 * Apply Component
 *
 * This React component represents an application form with multiple pages and navigation.
 * Users can navigate through different sections of the form, input data, and submit it.
 *
 * @component
 */

// Import necessary modules and components
"use client";
import React, { useState, useEffect } from "react";
import Button from "@/common/Button";
import {
  SectionOneForm,
  SecondSectionForm,
} from "@/components/Forms/ProjectDetails";
import Onborading from "@/components/Forms/Onborading";
import GetStarted from "@/components/Forms/GetStarted";
import TeamInformationForm from "@/components/Forms/TeamInformation";
import { useDebounce } from "use-debounce";
import {
  usePrepareContractWrite,
  useContractWrite,
  useWaitForTransaction,
  useAccount,
} from "wagmi";
import ArtworkDetailsForm from "@/components/Forms/ArtworkDetails";
import Minting from "@/components/Forms/Minting";

import ConfirmSubmit from "@/components/Forms/ConfirmSubmit";
import Succes from "@/components/Forms/Succes";
import SalesPlanForm from "@/components/Forms/Minting";

import Social from "@/components/Forms/Social";
import { toast } from "react-toastify";
import Endpoints from "@/http/endpoints";
import axios from "axios";
import { useRouter } from "next/navigation";
import { ClipLoader } from "react-spinners";
import {
  getProject,
  getSales,
  getArtworks,
  getTeam,
  getSocial,
} from "@/reducers/userSlice";
import { useSelector } from "react-redux";
import { Factory, SubscriptionNFT } from "../../../../constants";
import { parseEther } from "viem";
import { SubscriptionTier } from "@/utils";

const Apply: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { address: walletAddress } = useAccount();
  const project = useSelector(getProject);
  const sales = useSelector(getSales);
  const team = useSelector(getTeam);
  const artworks = useSelector(getArtworks);
  const socials = useSelector(getSocial);

  // State variables
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>(SubscriptionTier.COAL);
  const [hasSubscription, setHasSubscription] = useState<boolean>(false);
  const [checkingSubscription, setCheckingSubscription] = useState<boolean>(true);
  const debouncedTitle = useDebounce(project?.title, 500);
  const debouncedPrice = useDebounce(artworks?.price, 500);

  // Check if user has active subscription and verify factory config
  useEffect(() => {
    const checkSubscription = async () => {
      if (!walletAddress) {
        setCheckingSubscription(false);
        return;
      }
      setCheckingSubscription(true);
      try {
        const { hasActiveSubscription, getUserSubscription, readFactoryContract } = await import("@/utils");
        
        // Check factory platform fee recipient and collection implementation
        try {
          const recipient = await readFactoryContract("platformFeeRecipient");
          console.log("Factory platformFeeRecipient:", recipient);
          
          const collectionImpl = await readFactoryContract("collectionImplementation");
          console.log("Factory collectionImplementation:", collectionImpl);
          
          const subscriptionNFT = await readFactoryContract("subscriptionNFT");
          console.log("Factory subscriptionNFT:", subscriptionNFT);
        } catch (e) {
          console.error("Error reading factory config:", e);
        }
        
        const active = await hasActiveSubscription(walletAddress as `0x${string}`);
        console.log("Subscription check result:", active);
        setHasSubscription(active);
        if (active) {
          const subId = await getUserSubscription(walletAddress as `0x${string}`);
          console.log("Active subscription detected, ID:", subId?.toString());
        } else {
          console.log("No active subscription found for:", walletAddress);
        }
      } catch (err) {
        console.error("Error checking subscription:", err);
        setHasSubscription(false);
      }
      setCheckingSubscription(false);
    };
    checkSubscription();
    
    // Re-check when window gains focus (in case user minted subscription in another tab)
    const handleFocus = () => {
      if (walletAddress) {
        console.log("Window focused, re-checking subscription...");
        checkSubscription();
      }
    };
    window.addEventListener('focus', handleFocus);
    
    // Also re-check every 10 seconds while on the page
    const interval = setInterval(() => {
      if (walletAddress && currentPage > 2 && !hasSubscription) {
        console.log("Interval check for subscription...");
        checkSubscription();
      }
    }, 10000);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [walletAddress, currentPage, hasSubscription]);

  const {
    config,
    error: prepareError,
    isError: isPrepareError,
  } = usePrepareContractWrite({
    address: Factory.address as `0x${string}`,
    abi: Factory.abi,
    functionName: "deployWithSubscription",
    args: [
      debouncedTitle[0] || "My Collection",
      debouncedTitle[0] === "string"
        ? String(debouncedTitle).substring(0, 3).toUpperCase()
        : "NFT",
      // This should be the metadata, but since they can't specify details of each NFT, we use existing
      [
        "https://bafybeib4eyyxb5j2mugwzr4fmr2vd2wyqb4hrsj5w42xyb7frdcae5nusa.ipfs.dweb.link/1.json",
        "https://bafybeifzlqzt7jdzrfdr44sxbcpiuya6tf3dic3ghikhktlyogr3qfxkze.ipfs.dweb.link/2.json",
        "https://bafybeieamp53yjixpvq6h26zf5qmycohspmec2hjky5ufucslunivjrbc4.ipfs.dweb.link/3.json",
      ],
      // They should be able to set the prices for the various NFTs, but for now, one for all
      [
        debouncedPrice[0]
          ? parseEther(String(parseFloat(debouncedPrice[0]) / 100))
          : 0,
        debouncedPrice[0]
          ? parseEther(String(parseFloat(debouncedPrice[0]) / 100))
          : 0,
        debouncedPrice[0]
          ? parseEther(String(parseFloat(debouncedPrice[0]) / 100))
          : 0,
      ],
      selectedTier,
    ],
    enabled: hasSubscription && !!debouncedTitle[0],
  });
  const { data, error, isError, write } = useContractWrite(config);

  const { isSuccess } = useWaitForTransaction({
    hash: data?.hash,
  });
  const [confirm, setConfirm] = useState<boolean>(false);

  /**
   * Function to navigate to the next page of the application form.
   * It increments the current page number.
   */
  const handleNextPage = () => {
    if (currentPage < 7) {
      setCurrentPage((prevPage) => prevPage + 1);
    }
  };

  /**
   * Function to submit the launchpad application to MongoDB for admin review.
   * This sends submission data instead of directly deploying NFT.
   */
  const handleSubmitToReview = async () => {
    if (!walletAddress) {
      toast.error("Please connect your wallet first", { theme: "colored" });
      return;
    }

    setLoading(true);
    
    try {
      // Prepare submission data
      const submissionData = {
        walletAddress,
        project: {
          title: project?.title || "",
          description: project?.description || "",
          category: project?.category || "",
          ...project
        },
        team: team || {},
        sales: sales || {},
        artworks: artworks || {},
        socials: socials || {},
        productTier: selectedTier,
        status: "PENDING",
        submittedAt: new Date().toISOString(),
      };

      // Send to backend API
      const response = await axios.post(
        Endpoints.LAUNCHPAD_SUBMIT_PACKAGE,
        submissionData
      );

      if (response.data.success) {
        toast.success(
          "Submission received! Your NFT collection is pending admin review.",
          { theme: "colored" }
        );
        setCurrentPage(8); // Success page
      } else {
        throw new Error(response.data.error || "Submission failed");
      }
    } catch (error: any) {
      console.error("Submission error:", error);
      toast.error(
        error?.response?.data?.error || error.message || "Failed to submit. Please try again.",
        { theme: "colored" }
      );
    } finally {
      setLoading(false);
      setConfirm(false);
    }
  };

  useEffect(() => {
    if (isSuccess) {
      const requestBody = {
        ...project,
        ...team,
        ...sales,
        ...artworks,
        ...socials,
      };
      axios
        .post(Endpoints.LAUNCHPAD_CREATE_PACKAGE, requestBody)
        .then((response) => {
          setLoading(false);
          let message = response?.data?.message;
          toast.success(message, { theme: "colored" });
          router.push("/marketplace", { scroll: false });
        })
        .catch((error) => {
          let message = error?.response?.data?.error;
          toast.error(message, { theme: "colored" });
          setLoading(false);
        });
    } else if (isPrepareError || isError) {
      toast.error(prepareError?.message || error?.message, {
        theme: "colored",
      });
    }
  }, [isSuccess, isError, isPrepareError]);

  /**
   * Function to toggle the confirmation state.
   * It changes the confirmation state from true to false or vice versa.
   */
  const toggleConfirmation = () => {
    setConfirm(!confirm);
  };

  // Check if the current page is the last page of the form
  const isLastPage = currentPage === 7;

  // Subscription tier options
  const tierOptions = [
    { value: SubscriptionTier.COAL, label: "COAL - 5 USDC (10 NFTs)", price: 5 },
    { value: SubscriptionTier.BRONZE, label: "BRONZE - 10 USDC (50 NFTs)", price: 10 },
    { value: SubscriptionTier.SILVER, label: "SILVER - 25-35 USDC (120 NFTs)", price: 25 },
    { value: SubscriptionTier.GOLD, label: "GOLD - 60-90 USDC (300 NFTs)", price: 60 },
    { value: SubscriptionTier.PLATINUM, label: "PLATINUM - 150-250 USDC (1000 NFTs)", price: 150 },
  ];

  // Redirect to subscription page if no subscription
  const handleSubscribe = () => {
    router.push("/subscription");
  };

  /**
   * Function to render the current page of the application form based on the current page number.
   * It returns the appropriate form component for the current page.
   *
   * @returns {JSX.Element} - The JSX element representing the current page of the form.
   */
  const previewCurrentPage = () => {
    switch (currentPage) {
      case 1:
        return <Onborading nextPage={handleNextPage} />;
      case 2:
        return <GetStarted nextPage={handleNextPage} />;
      case 3:
        return <SectionOneForm />;
      case 4:
        return <SecondSectionForm />;
      case 5:
        return <TeamInformationForm />;
      case 6:
        return <ArtworkDetailsForm />;
      case 7:
        return <Social />;
      case 8:
        return (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
              <svg
                className="w-10 h-10 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-3xl font-bold mb-4">Submission Received!</h2>
            <p className="text-gray-400 max-w-md mb-8">
              Your NFT collection application has been submitted for admin review.
              You will be notified once it&apos;s approved.
            </p>
            <div className="flex gap-4">
              <Button
                handleClick={() => router.push("/dashboard")}
                className="bg-gradient-linear px-6 py-3"
              >
                Go to Dashboard
              </Button>
              <Button
                handleClick={() => router.push("/dashboard/submissions")}
                className="bg-gray-700 px-6 py-3"
              >
                View Submissions
              </Button>
            </div>
          </div>
        );
      default:
        return;
    }
  };

  // Show subscription check loading
  if (checkingSubscription) {
    return (
      <div className="flex flex-col justify-center items-center h-screen text-white">
        <ClipLoader color="#fff" size={50} />
        <p className="mt-4">Checking subscription status...</p>
      </div>
    );
  }

  // Show subscription required message
  if (!hasSubscription && currentPage > 2) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen text-white px-4 bg-[#0d0d0d]">
        {/* Error Icon */}
        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
          <svg
            className="w-10 h-10 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* Error Title */}
        <h2 className="text-3xl font-bold mb-4 text-center">
          No Subscription Tier NFT Detected
        </h2>

        {/* Error Message */}
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 max-w-lg mb-8">
          <p className="text-center text-gray-300 mb-4">
            You need an active NFT Factory subscription to create a collection.
            Mint a Subscription Plan first to get access to the launchpad.
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>Subscription NFTs are soulbound and non-transferable</span>
          </div>
        </div>

        {/* Tier Preview */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8 w-full max-w-4xl">
          {tierOptions.map((tier) => (
            <div
              key={tier.value}
              className="p-4 rounded-lg border border-gray-700 bg-gray-800/50 text-center"
            >
              <h3 className="font-semibold text-sm mb-1">{tier.label}</h3>
              <p className="text-xs text-gray-500">{tier.price} USDC</p>
            </div>
          ))}
        </div>

        {/* CTA Button */}
        <Button
          handleClick={handleSubscribe}
          className="bg-gradient-linear px-10 py-4 text-lg font-semibold"
        >
          <span className="flex items-center gap-2">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            Mint a Subscription Plan
          </span>
        </Button>

        {/* Refresh Button */}
        <button
          onClick={() => {
            setCheckingSubscription(true);
            window.location.reload();
          }}
          className="mt-4 text-blue-400 hover:text-blue-300 text-sm underline flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Already minted? Click to refresh
        </button>

        {/* Secondary Link */}
        <button
          onClick={() => router.push("/subscription")}
          className="mt-2 text-gray-400 hover:text-white text-sm underline"
        >
          Learn more about subscription tiers
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-start h-screen mt-10 mb-10 text-white">
      <div className="w-[98%] ">{previewCurrentPage()}</div>
      {currentPage > 2 && currentPage < 9 && (
        <div className="w-[98%] flex flex-col items-end mt-5 gap-2">
          {isLastPage && hasSubscription && (
            <div className="flex items-center gap-2 mb-2">
              <label className="text-sm text-gray-400">Product Tier:</label>
              <select
                value={selectedTier}
                onChange={(e) => setSelectedTier(Number(e.target.value) as SubscriptionTier)}
                className="bg-gray-800 border border-gray-600 rounded px-3 py-1 text-sm"
              >
                {tierOptions.map((tier) => (
                  <option key={tier.value} value={tier.value}>
                    {tier.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex justify-end">
            {isLastPage ? (
              <Button
                handleClick={toggleConfirmation}
                className={`bg-gradient-linear px-6 mb-5 py-3 ${!hasSubscription ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <p>Submit for Review</p>
              </Button>
            ) : (
              <Button
                handleClick={handleNextPage}
                className="bg-gradient-linear px-6 mb-5 py-3"
              >
                <p> Proceed</p>
              </Button>
            )}
          </div>
        </div>
      )}
      {confirm && (
        <ConfirmSubmit nextPage={handleSubmitToReview} cancel={toggleConfirmation} />
      )}
    </div>
  );
};

export default Apply;

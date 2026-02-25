// Deployment script for SubscriptionNFT, FactoryV2, SimpleCollectibleV2, and Marketplace
const { ethers, upgrades } = require("hardhat");
const hre = require("hardhat");

async function main() {
  console.log("Deploying NFT Factory Tier-Certified Infrastructure...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // Base Sepolia USDC address (using a test USDC or mock)
  // For production, replace with actual Base Sepolia USDC
  const USDC_ADDRESS = process.env.USDC_ADDRESS || "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // Base Sepolia USDC

  // Get existing Factory address if upgrading
  const existingFactoryProxy = process.env.FACTORY_PROXY_ADDRESS;

  // ============================================
  // STEP 1: Deploy SubscriptionNFT
  // ============================================
  console.log("\n=== Deploying SubscriptionNFT ===");
  
  const SubscriptionNFT = await ethers.getContractFactory("SubscriptionNFT");
  
  // For initial deployment, we'll use deployer as factory (will be updated after FactoryV2 deploy)
  const subscriptionNFT = await upgrades.deployProxy(
    SubscriptionNFT,
    [
      USDC_ADDRESS,           // _usdcToken
      deployer.address        // _factoryContract (temporary, will update)
    ],
    {
      initializer: "initialize",
      kind: "uups",
    }
  );

  await subscriptionNFT.deployed();
  console.log("SubscriptionNFT Proxy deployed to:", subscriptionNFT.address);
  
  const subscriptionImplementation = await upgrades.erc1967.getImplementationAddress(
    subscriptionNFT.address
  );
  console.log("SubscriptionNFT Implementation:", subscriptionImplementation);

  // Get tier pricing
  console.log("\n=== Subscription Tier Pricing (USDC) ===");
  const tiers = ["COAL", "BRONZE", "SILVER", "GOLD", "PLATINUM"];
  for (let i = 0; i < 5; i++) {
    const price = await subscriptionNFT.tierPrices(i);
    const quota = await subscriptionNFT.tierQuotas(i);
    const fee = await subscriptionNFT.tierMarketplaceFees(i);
    console.log(`${tiers[i]}: ${(price / 1e6).toFixed(2)} USDC | Quota: ${quota} | Fee: ${fee / 100}%`);
  }

  // ============================================
  // STEP 2: Deploy SimpleCollectible Implementation (for FactoryV2)
  // ============================================
  console.log("\n=== Deploying SimpleCollectible Implementation ===");

  const SimpleCollectible = await ethers.getContractFactory("SimpleCollectible");
  const simpleCollectibleImpl = await SimpleCollectible.deploy();
  await simpleCollectibleImpl.deployed();
  console.log("SimpleCollectible Implementation:", simpleCollectibleImpl.address);

  // ============================================
  // STEP 3: Deploy FactoryV2
  // ============================================
  console.log("\n=== Deploying FactoryV2 ===");

  const FactoryV2 = await ethers.getContractFactory("FactoryV2");
  
  const platformFeeRecipient = deployer.address;
  const platformFeeBps = 250; // 2.5% base fee

  const factoryV2 = await upgrades.deployProxy(
    FactoryV2,
    [
      platformFeeRecipient,
      platformFeeBps,
      subscriptionNFT.address,
      simpleCollectibleImpl.address  // Collection implementation address
    ],
    {
      initializer: "initialize",
      kind: "uups",
    }
  );

  await factoryV2.deployed();
  console.log("FactoryV2 Proxy deployed to:", factoryV2.address);
  
  const factoryImplementation = await upgrades.erc1967.getImplementationAddress(
    factoryV2.address
  );
  console.log("FactoryV2 Implementation:", factoryImplementation);

  // ============================================
  // STEP 4: Deploy SimpleCollectibleV2 Implementation
  // ============================================
  console.log("\n=== Deploying SimpleCollectibleV2 Implementation ===");

  const SimpleCollectibleV2 = await ethers.getContractFactory("SimpleCollectibleV2");
  const simpleCollectibleV2Impl = await SimpleCollectibleV2.deploy();
  await simpleCollectibleV2Impl.deployed();
  console.log("SimpleCollectibleV2 Implementation:", simpleCollectibleV2Impl.address);

  // Update FactoryV2 with new implementation
  console.log("Updating FactoryV2 with SimpleCollectibleV2 implementation...");
  await (await factoryV2.updateCollectionImplementation(simpleCollectibleV2Impl.address)).wait();
  console.log("FactoryV2 implementation updated");

  // ============================================
  // STEP 5: Deploy Marketplace
  // ============================================
  console.log("\n=== Deploying Marketplace ===");

  const Marketplace = await ethers.getContractFactory("Marketplace");
  
  const marketplace = await upgrades.deployProxy(
    Marketplace,
    [
      subscriptionNFT.address,
      platformFeeRecipient,
      USDC_ADDRESS
    ],
    {
      initializer: "initialize",
      kind: "uups",
    }
  );

  await marketplace.deployed();
  console.log("Marketplace Proxy deployed to:", marketplace.address);
  
  const marketplaceImplementation = await upgrades.erc1967.getImplementationAddress(
    marketplace.address
  );
  console.log("Marketplace Implementation:", marketplaceImplementation);

  // ============================================
  // STEP 6: Update Contract References
  // ============================================
  console.log("\n=== Updating Contract References ===");

  // Update SubscriptionNFT with FactoryV2 address
  await (await subscriptionNFT.setFactoryContract(factoryV2.address)).wait();
  console.log("SubscriptionNFT factory set to:", factoryV2.address);

  // Update SubscriptionNFT with Marketplace address
  await (await subscriptionNFT.setMarketplaceContract(marketplace.address)).wait();
  console.log("SubscriptionNFT marketplace set to:", marketplace.address);

  // ============================================
  // STEP 7: Pre-mint Subscription NFTs for Marketplace
  // ============================================
  console.log("\n=== Pre-minting Subscription NFTs for Marketplace ===");
  
  // Note: In production, you'd need USDC approval first
  // For testing, we'll mint one of each tier to the deployer
  // These will be available for purchase on the marketplace
  
  console.log("Minting COAL subscription...");
  // This would require USDC approval first
  // await (await subscriptionNFT.mintSubscription(0)).wait();
  
  console.log("Pre-mint setup complete (requires USDC approval for actual minting)");

  // ============================================
  // STEP 8: Verify Contracts
  // ============================================
  console.log("\n=== Verification ===");
  
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("Waiting for block confirmations...");
    await new Promise((resolve) => setTimeout(resolve, 30000));

    try {
      await hre.run("verify:verify", {
        address: subscriptionImplementation,
        contract: "contracts/SubscriptionNFT.sol:SubscriptionNFT",
      });
      console.log("SubscriptionNFT implementation verified");
    } catch (e) {
      console.log("SubscriptionNFT verification error:", e.message);
    }

    try {
      await hre.run("verify:verify", {
        address: factoryImplementation,
        contract: "contracts/FactoryV2.sol:FactoryV2",
      });
      console.log("FactoryV2 implementation verified");
    } catch (e) {
      console.log("FactoryV2 verification error:", e.message);
    }

    try {
      await hre.run("verify:verify", {
        address: simpleCollectibleV2Impl.address,
        contract: "contracts/SimpleCollectibleV2.sol:SimpleCollectibleV2",
      });
      console.log("SimpleCollectibleV2 verified");
    } catch (e) {
      console.log("SimpleCollectibleV2 verification error:", e.message);
    }

    try {
      await hre.run("verify:verify", {
        address: marketplaceImplementation,
        contract: "contracts/Marketplace.sol:Marketplace",
      });
      console.log("Marketplace implementation verified");
    } catch (e) {
      console.log("Marketplace verification error:", e.message);
    }
  }

  // ============================================
  // STEP 9: Save Deployment Info
  // ============================================
  console.log("\n=== Deployment Summary ===");
  
  const deploymentInfo = {
    network: hre.network.name,
    chainId: (await ethers.provider.getNetwork()).chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      subscriptionNFT: {
        proxy: subscriptionNFT.address,
        implementation: subscriptionImplementation,
      },
      factoryV2: {
        proxy: factoryV2.address,
        implementation: factoryImplementation,
      },
      simpleCollectible: {
        implementation: simpleCollectibleImpl.address,
      },
      simpleCollectibleV2: {
        implementation: simpleCollectibleV2Impl.address,
      },
      marketplace: {
        proxy: marketplace.address,
        implementation: marketplaceImplementation,
      },
    },
    usdcAddress: USDC_ADDRESS,
    tierPricing: {
      COAL: (await subscriptionNFT.tierPrices(0)).toString(),
      BRONZE: (await subscriptionNFT.tierPrices(1)).toString(),
      SILVER: (await subscriptionNFT.tierPrices(2)).toString(),
      GOLD: (await subscriptionNFT.tierPrices(3)).toString(),
      PLATINUM: (await subscriptionNFT.tierPrices(4)).toString(),
    },
  };

  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Save to file
  const fs = require("fs");
  const deploymentPath = `./deployments/deployment-${hre.network.name}-${Date.now()}.json`;
  fs.mkdirSync("./deployments", { recursive: true });
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\nDeployment info saved to: ${deploymentPath}`);

  console.log("\n=== Deployment Complete ===");
  console.log("\nNext steps:");
  console.log("1. Approve USDC spending for subscription purchases");
  console.log("2. Mint initial subscription NFTs to the marketplace");
  console.log("3. Update client constants with new contract addresses");
  console.log("4. Test the subscription purchase flow");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

# NFT Factory - Base Sepolia Deployment Guide

## Prerequisites

Ensure you have the following installed:
- Node.js (v18 or higher)
- npm or yarn
- Git

## Step 1: Install Dependencies

```bash
cd core
npm install
```

This will install:
- Hardhat
- OpenZeppelin upgradeable contracts
- Testing libraries (Chai, Mocha)
- Deployment tools

## Step 2: Environment Setup

1. Copy the environment template:
```bash
cp .env.example .env
```

2. Edit `.env` and fill in your values:
```bash
# Private key of deployer wallet (0xc318466b329385d08a63894ceA20ee285D7e0840)
PRIVATE_KEY=0x...

# Alchemy API Key (provided: KgTV8U-VkMAe7rYR_0ltT)
ALCHEMY_API_KEY=KgTV8U-VkMAe7rYR_0ltT

# BaseScan API Key (get from https://basescan.org/register)
BASESCAN_API_KEY=your_basescan_api_key
```

## Step 3: Run Tests

Before deploying, run the comprehensive test suite:

```bash
# Run all tests
npx hardhat test

# Run with gas reporting
REPORT_GAS=true npx hardhat test

# Run with coverage
npx hardhat coverage
```

## Step 4: Deploy to Base Sepolia

### Option A: Using Hardhat Deploy

```bash
# Deploy to Base Sepolia
npx hardhat deploy --network baseSepolia

# Verify contracts
npx hardhat verify --network baseSepolia <IMPLEMENTATION_ADDRESS>
```

### Option B: Using Hardhat Run Script

Create a deployment script `scripts/deploy.js`:

```javascript
const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const PLATFORM_FEE_BPS = 250; // 2.5%

  // Deploy Factory
  const Factory = await ethers.getContractFactory("Factory");
  const factory = await upgrades.deployProxy(
    Factory,
    [deployer.address, PLATFORM_FEE_BPS],
    { initializer: "initialize", kind: "uups" }
  );

  await factory.deployed();

  console.log("Factory Proxy deployed to:", factory.address);
  console.log("Factory Implementation:", await upgrades.erc1967.getImplementationAddress(factory.address));

  // Save deployment info
  const fs = require("fs");
  const deploymentInfo = {
    network: "baseSepolia",
    factoryProxy: factory.address,
    factoryImplementation: await upgrades.erc1967.getImplementationAddress(factory.address),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync("deployment.json", JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

Run the script:
```bash
npx hardhat run scripts/deploy.js --network baseSepolia
```

## Step 5: Verify on BaseScan

After deployment, verify the implementation contract:

```bash
npx hardhat verify --network baseSepolia <FACTORY_IMPLEMENTATION_ADDRESS>
```

## Step 6: Update Client Configuration

1. Copy the client environment template:
```bash
cd ../client
cp .env.local.example .env.local
```

2. Edit `.env.local` and add the deployed Factory proxy address:
```bash
NEXT_PUBLIC_FACTORY_PROXY_ADDRESS=<DEPLOYED_FACTORY_PROXY_ADDRESS>
NEXT_PUBLIC_ALCHEMY_BASE_SEPOLIA_RPC=https://base-sepolia.g.alchemy.com/v2/KgTV8U-VkMAe7rYR_0ltT
```

## Step 7: Test Deployment

Create a test script to verify the deployment:

```javascript
// scripts/test-deployment.js
const { ethers } = require("hardhat");

async function main() {
  const factoryAddress = "<DEPLOYED_FACTORY_PROXY_ADDRESS>";
  const Factory = await ethers.getContractFactory("Factory");
  const factory = Factory.attach(factoryAddress);

  console.log("Factory Owner:", await factory.owner());
  console.log("Platform Fee Recipient:", await factory.platformFeeRecipient());
  console.log("Platform Fee BPS:", await factory.platformFeeBps());
  console.log("Collection Count:", await factory.getCollectionCount());

  // Test deploying a collection
  const tx = await factory.deploy(
    "Test Collection",
    "TEST",
    ["ipfs://QmTest1", "ipfs://QmTest2"],
    [ethers.utils.parseEther("0.01"), ethers.utils.parseEther("0.02")]
  );
  await tx.wait();

  console.log("Collection deployed!");
  console.log("Collections:", await factory.getMarketPlaces());
}

main().catch(console.error);
```

Run:
```bash
npx hardhat run scripts/test-deployment.js --network baseSepolia
```

## Deployment Checklist

- [ ] Node.js and npm installed
- [ ] Dependencies installed (`npm install`)
- [ ] `.env` file configured with private key and API keys
- [ ] Deployer wallet funded with Base Sepolia ETH
- [ ] Tests passing (`npx hardhat test`)
- [ ] Contracts deployed to Base Sepolia
- [ ] Contracts verified on BaseScan
- [ ] Client `.env.local` updated with contract addresses
- [ ] Deployment tested

## Troubleshooting

### Issue: "insufficient funds"
**Solution:** Get Base Sepolia ETH from the [Coinbase faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet)

### Issue: "cannot estimate gas"
**Solution:** Ensure the contract compiles successfully:
```bash
npx hardhat compile
```

### Issue: "Invalid API Key"
**Solution:** Verify your Alchemy API key is correct and has Base Sepolia access enabled.

### Issue: "Contract verification failed"
**Solution:** Wait a few minutes after deployment for the contract to be indexed, then retry verification.

## Base Sepolia Network Details

- **Network Name:** Base Sepolia
- **Chain ID:** 84532
- **RPC URL:** https://base-sepolia.g.alchemy.com/v2/YOUR_API_KEY
- **Block Explorer:** https://sepolia.basescan.org
- **Currency Symbol:** ETH

## Post-Deployment

After successful deployment, update the following files with the new addresses:
1. `client/constants/Factory.json` - Update `address` field
2. `client/.env.local` - Update `NEXT_PUBLIC_FACTORY_PROXY_ADDRESS`
3. Server environment variables (if applicable)

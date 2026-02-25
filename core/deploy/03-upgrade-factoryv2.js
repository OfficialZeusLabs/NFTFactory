// Upgrade script for FactoryV2 to fix the selector
const { ethers, upgrades } = require("hardhat");
const hre = require("hardhat");

async function main() {
  console.log("Upgrading FactoryV2 to fix selector...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Upgrading with account:", deployer.address);

  // FactoryV2 proxy address
  const FACTORY_V2_PROXY = "0x214ba6F4f7F8af2D0455A17437f5968C31207F0c";

  // Get the new FactoryV2 implementation
  const FactoryV2 = await ethers.getContractFactory("FactoryV2");
  
  console.log("Preparing upgrade...");
  
  // Upgrade the proxy to new implementation
  const factoryV2 = await upgrades.upgradeProxy(FACTORY_V2_PROXY, FactoryV2);
  
  await factoryV2.deployed();
  
  const newImplementation = await upgrades.erc1967.getImplementationAddress(
    FACTORY_V2_PROXY
  );
  
  console.log("FactoryV2 upgraded successfully!");
  console.log("Proxy address:", FACTORY_V2_PROXY);
  console.log("New implementation:", newImplementation);

  // Verify if not on local network
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("\nWaiting for block confirmations...");
    await new Promise((resolve) => setTimeout(resolve, 30000));

    try {
      await hre.run("verify:verify", {
        address: newImplementation,
        contract: "contracts/FactoryV2.sol:FactoryV2",
      });
      console.log("FactoryV2 implementation verified");
    } catch (e) {
      console.log("FactoryV2 verification error:", e.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

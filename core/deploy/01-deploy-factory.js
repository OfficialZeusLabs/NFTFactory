const { network, ethers } = require("hardhat");
const { verify } = require("../utils/verify");

const PLATFORM_FEE_BPS = 250; // 2.5%

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  log("----------------------------------------");
  log("Deploying Factory contract with upgrades proxy...");

  // Get the contract factory
  const Factory = await ethers.getContractFactory("Factory");

  // Deploy as upgradeable proxy
  const factory = await upgrades.deployProxy(
    Factory,
    [deployer, PLATFORM_FEE_BPS], // initializer arguments
    {
      initializer: "initialize",
      kind: "uups",
    }
  );

  await factory.deployed();

  log(`Factory Proxy deployed at: ${factory.address}`);
  log(`Factory Implementation deployed at: ${await upgrades.erc1967.getImplementationAddress(factory.address)}`);
  log(`Factory Admin deployed at: ${await upgrades.erc1967.getAdminAddress(factory.address)}`);

  // Save deployment info
  await deployments.save("Factory", {
    address: factory.address,
    abi: JSON.parse(Factory.interface.format(ethers.utils.FormatTypes.json)),
  });

  // Verify on block explorer if not on local network
  if (network.config.chainId !== 31337 && process.env.BASESCAN_API_KEY) {
    log("Waiting for block confirmations...");
    await factory.deployTransaction.wait(6);

    log("Verifying implementation contract...");
    const implementationAddress = await upgrades.erc1967.getImplementationAddress(factory.address);
    await verify(implementationAddress, []);
  }

  log("----------------------------------------");
};

module.exports.tags = ["Factory", "all"];

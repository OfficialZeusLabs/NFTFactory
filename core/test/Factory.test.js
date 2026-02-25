const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("Factory Contract", function () {
  let Factory;
  let factory;
  let SimpleCollectible;
  let owner;
  let addr1;
  let addr2;
  let addrs;

  const NFT_NAME = "Test Collection";
  const NFT_SYMBOL = "TEST";
  const URIs = ["ipfs://QmTest1", "ipfs://QmTest2"];
  const MINT_FEES = [ethers.utils.parseEther("0.01"), ethers.utils.parseEther("0.02")];

  beforeEach(async function () {
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
    
    // Deploy Factory as upgradeable
    Factory = await ethers.getContractFactory("Factory");
    factory = await upgrades.deployProxy(Factory, [], {
      initializer: "initialize",
    });
    await factory.deployed();

    // Get SimpleCollectible factory for reference
    SimpleCollectible = await ethers.getContractFactory("SimpleCollectible");
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await factory.owner()).to.equal(owner.address);
    });

    it("Should initialize with empty marketplace", async function () {
      expect(await factory.getMarketPlaces()).to.deep.equal([]);
    });

    it("Should be pausable by owner", async function () {
      await factory.pause();
      expect(await factory.paused()).to.be.true;
    });

    it("Should not allow non-owner to pause", async function () {
      await expect(factory.connect(addr1).pause()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });
  });

  describe("NFT Collection Deployment", function () {
    it("Should deploy a new NFT collection", async function () {
      await expect(
        factory.deploy(NFT_NAME, NFT_SYMBOL, URIs, MINT_FEES)
      )
        .to.emit(factory, "CollectionDeployed")
        .withArgs(await factory.getMarketPlaces().then(arr => arr[0]), NFT_NAME, NFT_SYMBOL, owner.address);
    });

    it("Should track deployed collections", async function () {
      await factory.deploy(NFT_NAME, NFT_SYMBOL, URIs, MINT_FEES);
      await factory.deploy("Second Collection", "SEC", URIs, MINT_FEES);
      
      const marketplaces = await factory.getMarketPlaces();
      expect(marketplaces.length).to.equal(2);
    });

    it("Should not allow deployment when paused", async function () {
      await factory.pause();
      await expect(
        factory.deploy(NFT_NAME, NFT_SYMBOL, URIs, MINT_FEES)
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Should validate URI and fee array lengths match", async function () {
      const mismatchedFees = [ethers.utils.parseEther("0.01")];
      await expect(
        factory.deploy(NFT_NAME, NFT_SYMBOL, URIs, mismatchedFees)
      ).to.be.revertedWithCustomError(factory, "MismatchedArrayLengths");
    });

    it("Should validate non-empty name and symbol", async function () {
      await expect(
        factory.deploy("", NFT_SYMBOL, URIs, MINT_FEES)
      ).to.be.revertedWithCustomError(factory, "EmptyString");
      
      await expect(
        factory.deploy(NFT_NAME, "", URIs, MINT_FEES)
      ).to.be.revertedWithCustomError(factory, "EmptyString");
    });

    it("Should validate non-empty URI array", async function () {
      await expect(
        factory.deploy(NFT_NAME, NFT_SYMBOL, [], [])
      ).to.be.revertedWithCustomError(factory, "EmptyArray");
    });
  });

  describe("Collection Querying", function () {
    beforeEach(async function () {
      await factory.deploy(NFT_NAME, NFT_SYMBOL, URIs, MINT_FEES);
      await factory.connect(addr1).deploy("User Collection", "USER", URIs, MINT_FEES);
    });

    it("Should return all collections", async function () {
      const collections = await factory.getMarketPlaces();
      expect(collections.length).to.equal(2);
    });

    it("Should return collection details", async function () {
      const collections = await factory.getMarketPlaces();
      const details = await factory.getCollectionDetails(collections[0]);
      
      expect(details.name).to.equal(NFT_NAME);
      expect(details.symbol).to.equal(NFT_SYMBOL);
      expect(details.creator).to.equal(owner.address);
      expect(details.uriCount).to.equal(URIs.length);
    });
  });

  describe("Upgradeability", function () {
    it("Should allow owner to upgrade", async function () {
      const FactoryV2 = await ethers.getContractFactory("Factory");
      const upgraded = await upgrades.upgradeProxy(factory.address, FactoryV2);
      expect(upgraded.address).to.equal(factory.address);
    });

    it("Should not allow non-owner to upgrade", async function () {
      const FactoryV2 = await ethers.getContractFactory("Factory", addr1);
      await expect(
        upgrades.upgradeProxy(factory.address, FactoryV2)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
});

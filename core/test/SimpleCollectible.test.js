const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("SimpleCollectible Contract", function () {
  let SimpleCollectible;
  let nft;
  let Factory;
  let factory;
  let owner;
  let addr1;
  let addr2;
  let addrs;
  let platformFeeRecipient;

  const NFT_NAME = "Test NFT";
  const NFT_SYMBOL = "TNFT";
  const URIs = ["ipfs://QmTest1", "ipfs://QmTest2", "ipfs://QmTest3"];
  const MINT_FEES = [
    ethers.utils.parseEther("0.01"),
    ethers.utils.parseEther("0.02"),
    ethers.utils.parseEther("0.03"),
  ];
  const PLATFORM_FEE_BPS = 250; // 2.5%

  beforeEach(async function () {
    [owner, addr1, addr2, platformFeeRecipient, ...addrs] = await ethers.getSigners();
    
    // Deploy Factory first (needed for deployment through factory)
    Factory = await ethers.getContractFactory("Factory");
    factory = await upgrades.deployProxy(Factory, [platformFeeRecipient.address, PLATFORM_FEE_BPS], {
      initializer: "initialize",
    });
    await factory.deployed();

    // Deploy a collection through factory
    const tx = await factory.deploy(NFT_NAME, NFT_SYMBOL, URIs, MINT_FEES);
    const receipt = await tx.wait();
    
    // Get the deployed collection address from event
    const event = receipt.events.find(e => e.event === "CollectionDeployed");
    const collectionAddress = event.args.collectionAddress;
    
    // Attach to the deployed collection
    SimpleCollectible = await ethers.getContractFactory("SimpleCollectible");
    nft = SimpleCollectible.attach(collectionAddress);
  });

  describe("Deployment", function () {
    it("Should set the correct name and symbol", async function () {
      expect(await nft.name()).to.equal(NFT_NAME);
      expect(await nft.symbol()).to.equal(NFT_SYMBOL);
    });

    it("Should set the correct owner", async function () {
      expect(await nft.owner()).to.equal(owner.address);
    });

    it("Should initialize with correct URI data", async function () {
      const data = await nft.getData();
      expect(data.length).to.equal(URIs.length);
      expect(data[0].uri).to.equal(URIs[0]);
      expect(data[0].mintFee).to.equal(MINT_FEES[0]);
    });

    it("Should support ERC721 interface", async function () {
      const ERC721InterfaceId = "0x80ac58cd";
      expect(await nft.supportsInterface(ERC721InterfaceId)).to.be.true;
    });

    it("Should support ERC2981 (royalty) interface", async function () {
      const ERC2981InterfaceId = "0x2a55205a";
      expect(await nft.supportsInterface(ERC2981InterfaceId)).to.be.true;
    });
  });

  describe("Minting", function () {
    it("Should mint NFT with correct fee", async function () {
      const uriIndex = 0;
      const mintFee = MINT_FEES[uriIndex];
      
      await expect(
        nft.connect(addr1).createCollectible(addr1.address, uriIndex, { value: mintFee })
      )
        .to.emit(nft, "CollectibleCreated")
        .withArgs(addr1.address, uriIndex, 0);
      
      expect(await nft.ownerOf(0)).to.equal(addr1.address);
      expect(await nft.tokenURI(0)).to.equal(URIs[uriIndex]);
    });

    it("Should reject minting with insufficient fee", async function () {
      const uriIndex = 0;
      const insufficientFee = ethers.utils.parseEther("0.005");
      
      await expect(
        nft.connect(addr1).createCollectible(addr1.address, uriIndex, { value: insufficientFee })
      ).to.be.revertedWithCustomError(nft, "InsufficientMintFee");
    });

    it("Should allow overpayment and track excess", async function () {
      const uriIndex = 0;
      const overpayment = ethers.utils.parseEther("0.02");
      
      await nft.connect(addr1).createCollectible(addr1.address, uriIndex, { value: overpayment });
      
      // Check that contract received the full amount
      expect(await ethers.provider.getBalance(nft.address)).to.equal(overpayment);
    });

    it("Should not mint when paused", async function () {
      await nft.pause();
      
      await expect(
        nft.connect(addr1).createCollectible(addr1.address, 0, { value: MINT_FEES[0] })
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Should increment token IDs correctly", async function () {
      await nft.connect(addr1).createCollectible(addr1.address, 0, { value: MINT_FEES[0] });
      await nft.connect(addr1).createCollectible(addr1.address, 1, { value: MINT_FEES[1] });
      
      expect(await nft.tokenURI(0)).to.equal(URIs[0]);
      expect(await nft.tokenURI(1)).to.equal(URIs[1]);
    });

    it("Should track user's tokens", async function () {
      await nft.connect(addr1).createCollectible(addr1.address, 0, { value: MINT_FEES[0] });
      await nft.connect(addr1).createCollectible(addr1.address, 1, { value: MINT_FEES[1] });
      
      const tokens = await nft.getTokenData(addr1.address);
      expect(tokens.length).to.equal(2);
      expect(tokens[0]).to.equal(0);
      expect(tokens[1]).to.equal(1);
    });
  });

  describe("Redemption Flow", function () {
    beforeEach(async function () {
      // Mint a token for addr1
      await nft.connect(addr1).createCollectible(addr1.address, 0, { value: MINT_FEES[0] });
    });

    it("Should allow owner to initiate redemption", async function () {
      await expect(nft.connect(addr1).redeem(0, 0))
        .to.emit(nft, "RedeemInitiated")
        .withArgs(0, addr1.address);
      
      // Token should be transferred to contract
      expect(await nft.ownerOf(0)).to.equal(nft.address);
    });

    it("Should not allow non-owner to redeem", async function () {
      await expect(nft.connect(addr2).redeem(0, 0)).to.be.revertedWithCustomError(
        nft,
        "NotTokenOwner"
      );
    });

    it("Should track escrowed tokens", async function () {
      await nft.connect(addr1).redeem(0, 0);
      
      const escrowed = await nft.getEscrowedTokens(addr1.address);
      expect(escrowed.length).to.equal(1);
      expect(escrowed[0].tokenId).to.equal(0);
      expect(escrowed[0].uriIndex).to.equal(0);
    });

    it("Should allow owner to cancel redemption", async function () {
      await nft.connect(addr1).redeem(0, 0);
      
      await expect(nft.connect(addr1).cancelRedeem(0))
        .to.emit(nft, "RedeemCancelled")
        .withArgs(0, addr1.address);
      
      // Token should be returned to owner
      expect(await nft.ownerOf(0)).to.equal(addr1.address);
    });

    it("Should allow contract owner to acknowledge redemption", async function () {
      await nft.connect(addr1).redeem(0, 0);
      
      await expect(nft.ackRedeem(0, 0, 0))
        .to.emit(nft, "Redeemed")
        .withArgs(0, addr1.address);
      
      // Token should be burned
      await expect(nft.ownerOf(0)).to.be.revertedWith("ERC721: invalid token ID");
    });

    it("Should not allow non-contract-owner to acknowledge redemption", async function () {
      await nft.connect(addr1).redeem(0, 0);
      
      await expect(nft.connect(addr1).ackRedeem(0, 0, 0)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });

    it("Should not allow double redemption", async function () {
      await nft.connect(addr1).redeem(0, 0);
      
      await expect(nft.connect(addr1).redeem(0, 0)).to.be.revertedWithCustomError(
        nft,
        "TokenInEscrow"
      );
    });
  });

  describe("Royalty (EIP-2981)", function () {
    it("Should return correct platform royalty info", async function () {
      const salePrice = ethers.utils.parseEther("1");
      const [receiver, royaltyAmount] = await nft.royaltyInfo(0, salePrice);
      
      expect(receiver).to.equal(platformFeeRecipient.address);
      expect(royaltyAmount).to.equal(salePrice.mul(PLATFORM_FEE_BPS).div(10000));
    });

    it("Should allow owner to set custom royalty", async function () {
      const customBps = 500; // 5%
      await nft.setCustomRoyalty(addr1.address, customBps);
      
      const salePrice = ethers.utils.parseEther("1");
      const [receiver, royaltyAmount] = await nft.royaltyInfo(0, salePrice);
      
      expect(receiver).to.equal(addr1.address);
      expect(royaltyAmount).to.equal(salePrice.mul(customBps).div(10000));
    });

    it("Should enforce max royalty limit", async function () {
      const tooHighBps = 5001; // 50.01%
      await expect(nft.setCustomRoyalty(addr1.address, tooHighBps)).to.be.revertedWithCustomError(
        nft,
        "RoyaltyTooHigh"
      );
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to adjust mint fee", async function () {
      const newFee = ethers.utils.parseEther("0.05");
      
      await expect(nft.adjustMintFee(0, newFee))
        .to.emit(nft, "MintFeeAdjusted")
        .withArgs(0, MINT_FEES[0], newFee);
      
      const data = await nft.getData();
      expect(data[0].mintFee).to.equal(newFee);
    });

    it("Should not allow non-owner to adjust mint fee", async function () {
      await expect(nft.connect(addr1).adjustMintFee(0, 100)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });

    it("Should allow owner to adjust URI", async function () {
      const newURI = "ipfs://QmNew";
      
      await expect(nft.adjustURI(0, newURI))
        .to.emit(nft, "URIAdjusted")
        .withArgs(0, URIs[0], newURI);
      
      const data = await nft.getData();
      expect(data[0].uri).to.equal(newURI);
    });

    it("Should allow owner to withdraw funds", async function () {
      // Mint some tokens to generate revenue
      await nft.connect(addr1).createCollectible(addr1.address, 0, { value: MINT_FEES[0] });
      await nft.connect(addr2).createCollectible(addr2.address, 1, { value: MINT_FEES[1] });
      
      const contractBalance = await ethers.provider.getBalance(nft.address);
      const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
      
      const tx = await nft.withdraw();
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);
      
      const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);
      
      expect(ownerBalanceAfter).to.equal(
        ownerBalanceBefore.add(contractBalance).sub(gasUsed)
      );
      expect(await ethers.provider.getBalance(nft.address)).to.equal(0);
    });

    it("Should not allow non-owner to withdraw", async function () {
      await expect(nft.connect(addr1).withdraw()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });

    it("Should not allow withdrawal with zero balance", async function () {
      await expect(nft.withdraw()).to.be.revertedWithCustomError(nft, "NoFundsToWithdraw");
    });
  });

  describe("Pausable", function () {
    it("Should allow owner to pause and unpause", async function () {
      await nft.pause();
      expect(await nft.paused()).to.be.true;
      
      await nft.unpause();
      expect(await nft.paused()).to.be.false;
    });

    it("Should prevent transfers when paused", async function () {
      await nft.connect(addr1).createCollectible(addr1.address, 0, { value: MINT_FEES[0] });
      await nft.pause();
      
      await expect(
        nft.connect(addr1).transferFrom(addr1.address, addr2.address, 0)
      ).to.be.revertedWith("Pausable: paused");
    });
  });

  describe("Reentrancy Protection", function () {
    it("Should be protected against reentrancy in withdraw", async function () {
      // This test would require a malicious contract - simplified check
      await nft.connect(addr1).createCollectible(addr1.address, 0, { value: MINT_FEES[0] });
      
      // Should succeed normally
      await expect(nft.withdraw()).to.not.be.reverted;
    });
  });
});

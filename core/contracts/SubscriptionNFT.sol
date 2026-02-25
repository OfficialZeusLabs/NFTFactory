// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

/**
 * @title SubscriptionNFT
 * @dev Soulbound NFT representing organization tier and minting rights
 * Non-transferable, wallet-bound, quota-based subscription system
 */
contract SubscriptionNFT is 
    Initializable, 
    ERC721Upgradeable, 
    OwnableUpgradeable, 
    PausableUpgradeable,
    UUPSUpgradeable 
{
    using Strings for uint256;

    // ============ Enums ============
    enum Tier {
        COAL,       // 0
        BRONZE,     // 1
        SILVER,     // 2
        GOLD,       // 3
        PLATINUM    // 4
    }

    enum VerificationStatus {
        VERIFIED,
        UNDER_REVIEW,
        SUSPENDED
    }

    // ============ Structs ============
    struct Subscription {
        Tier organizationTier;
        uint256 totalMintQuota;
        uint256 remainingMintQuota;
        mapping(Tier => uint256) classMintedCount;
        address owner;
        VerificationStatus verificationStatus;
        uint256 purchasePrice;
        uint256 mintedAt;
    }

    // ============ State Variables ============
    mapping(uint256 => Subscription) public subscriptions;
    mapping(address => uint256) public walletToSubscription;
    mapping(Tier => uint256) public tierPrices;
    mapping(Tier => uint256) public tierQuotas;
    mapping(Tier => uint256) public tierMarketplaceFees;
    
    IERC20 public usdcToken;
    address public factoryContract;
    address public marketplaceContract;
    
    uint256 public nextSubscriptionId;
    uint256 public constant MAX_LOWER_TIER_PERCENTAGE = 50; // 50%
    
    // ============ Events ============
    event SubscriptionMinted(
        uint256 indexed subscriptionId,
        address indexed owner,
        Tier tier,
        uint256 price,
        uint256 quota
    );
    event SubscriptionRenewed(
        uint256 indexed subscriptionId,
        uint256 newQuota
    );
    event QuotaConsumed(
        uint256 indexed subscriptionId,
        Tier productClass,
        uint256 remainingQuota
    );
    event VerificationStatusUpdated(
        uint256 indexed subscriptionId,
        VerificationStatus newStatus
    );
    event SubscriptionSuspended(
        uint256 indexed subscriptionId,
        string reason
    );
    event SubscriptionMigrated(
        uint256 indexed subscriptionId,
        address indexed oldWallet,
        address indexed newWallet
    );
    event WalletMigrationApproved(
        uint256 indexed subscriptionId,
        address indexed newWallet
    );
    event TierPricingSet(Tier tier, uint256 price);

    // ============ Modifiers ============
    modifier onlyFactory() {
        require(msg.sender == factoryContract, "SubscriptionNFT: Only factory");
        _;
    }

    modifier onlyMarketplace() {
        require(msg.sender == marketplaceContract, "SubscriptionNFT: Only marketplace");
        _;
    }

    modifier validSubscription(uint256 subscriptionId) {
        require(_exists(subscriptionId), "SubscriptionNFT: Invalid subscription");
        require(
            subscriptions[subscriptionId].verificationStatus != VerificationStatus.SUSPENDED,
            "SubscriptionNFT: Subscription suspended"
        );
        _;
    }

    modifier onlySubscriptionOwner(uint256 subscriptionId) {
        require(
            ownerOf(subscriptionId) == msg.sender,
            "SubscriptionNFT: Not subscription owner"
        );
        _;
    }

    // ============ Initializer ============
    function initialize(
        address _usdcToken,
        address _factoryContract
    ) public initializer {
        __ERC721_init("NFT Factory Subscription", "NFTFS");
        __Ownable_init();
        __Pausable_init();
        __UUPSUpgradeable_init();

        usdcToken = IERC20(_usdcToken);
        factoryContract = _factoryContract;
        nextSubscriptionId = 1;

        // Set tier quotas (fixed)
        tierQuotas[Tier.COAL] = 10;
        tierQuotas[Tier.BRONZE] = 50;
        tierQuotas[Tier.SILVER] = 120;
        tierQuotas[Tier.GOLD] = 300;
        tierQuotas[Tier.PLATINUM] = 1000;

        // Set marketplace fees by tier (in basis points)
        tierMarketplaceFees[Tier.COAL] = 500;      // 5%
        tierMarketplaceFees[Tier.BRONZE] = 450;    // 4.5%
        tierMarketplaceFees[Tier.SILVER] = 400;    // 4%
        tierMarketplaceFees[Tier.GOLD] = 350;      // 3.5%
        tierMarketplaceFees[Tier.PLATINUM] = 300;  // 3%

        // Set fixed pricing for lower tiers
        tierPrices[Tier.COAL] = 5 * 10**6;      // 5 USDC
        tierPrices[Tier.BRONZE] = 10 * 10**6;   // 10 USDC

        // Randomize higher tier pricing (done once at deployment)
        _initializeTierPricing();
    }

    // ============ Pricing Initialization ============
    function _initializeTierPricing() internal {
        // SILVER: randomized between 25-35 USDC
        uint256 silverPrice = _randomizePrice(25, 35);
        tierPrices[Tier.SILVER] = silverPrice * 10**6;

        // GOLD: randomized between 60-90 USDC
        uint256 goldPrice = _randomizePrice(60, 90);
        tierPrices[Tier.GOLD] = goldPrice * 10**6;

        // PLATINUM: randomized between 150-250 USDC
        uint256 platinumPrice = _randomizePrice(150, 250);
        tierPrices[Tier.PLATINUM] = platinumPrice * 10**6;

        emit TierPricingSet(Tier.SILVER, tierPrices[Tier.SILVER]);
        emit TierPricingSet(Tier.GOLD, tierPrices[Tier.GOLD]);
        emit TierPricingSet(Tier.PLATINUM, tierPrices[Tier.PLATINUM]);
    }

    function _randomizePrice(uint256 min, uint256 max) internal view returns (uint256) {
        require(max > min, "Invalid range");
        uint256 range = max - min + 1;
        // Use block hash and timestamp for pseudo-randomness
        uint256 random = uint256(keccak256(abi.encodePacked(
            blockhash(block.number - 1),
            block.timestamp,
            msg.sender
        ))) % range;
        return min + random;
    }

    // ============ Minting Functions ============
    function mintSubscription(Tier tier) external whenNotPaused returns (uint256) {
        require(
            walletToSubscription[msg.sender] == 0,
            "SubscriptionNFT: Wallet already has subscription"
        );
        require(
            uint256(tier) <= uint256(Tier.PLATINUM),
            "SubscriptionNFT: Invalid tier"
        );

        uint256 price = tierPrices[tier];
        require(price > 0, "SubscriptionNFT: Tier not priced");

        // Transfer USDC payment
        require(
            usdcToken.transferFrom(msg.sender, address(this), price),
            "SubscriptionNFT: USDC transfer failed"
        );

        uint256 subscriptionId = nextSubscriptionId++;
        uint256 quota = tierQuotas[tier];

        Subscription storage sub = subscriptions[subscriptionId];
        sub.organizationTier = tier;
        sub.totalMintQuota = quota;
        sub.remainingMintQuota = quota;
        sub.owner = msg.sender;
        sub.verificationStatus = VerificationStatus.UNDER_REVIEW;
        sub.purchasePrice = price;
        sub.mintedAt = block.timestamp;

        walletToSubscription[msg.sender] = subscriptionId;

        _safeMint(msg.sender, subscriptionId);

        emit SubscriptionMinted(subscriptionId, msg.sender, tier, price, quota);

        return subscriptionId;
    }

    // ============ Soulbound Logic ============
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal virtual override {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);

        // Allow minting (from == address(0)) and burning (to == address(0))
        // But block all transfers between wallets
        if (from != address(0) && to != address(0)) {
            revert("SubscriptionNFT: Soulbound - transfers disabled");
        }
    }

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal virtual override {
        super._afterTokenTransfer(from, to, tokenId, batchSize);

        // Update wallet mapping on mint/burn
        if (from == address(0) && to != address(0)) {
            // Mint
            walletToSubscription[to] = tokenId;
            subscriptions[tokenId].owner = to;
        } else if (from != address(0) && to == address(0)) {
            // Burn
            walletToSubscription[from] = 0;
        }
    }

    // ============ Quota Management ============
    function consumeQuota(
        uint256 subscriptionId,
        Tier productClass
    ) external onlyFactory validSubscription(subscriptionId) returns (bool) {
        Subscription storage sub = subscriptions[subscriptionId];
        
        require(sub.remainingMintQuota > 0, "SubscriptionNFT: Quota exhausted");
        require(
            uint256(productClass) <= uint256(sub.organizationTier),
            "SubscriptionNFT: Product class exceeds tier"
        );

        // Check lower-tier allocation limit (50% max)
        if (productClass < sub.organizationTier) {
            uint256 lowerTierMinted = _getLowerTierMintedCount(subscriptionId, sub.organizationTier);
            uint256 newLowerTierCount = lowerTierMinted + 1;
            uint256 maxLowerTier = (sub.totalMintQuota * MAX_LOWER_TIER_PERCENTAGE) / 100;
            
            require(
                newLowerTierCount <= maxLowerTier,
                "SubscriptionNFT: Lower-tier quota exceeded (50% max)"
            );
        }

        sub.remainingMintQuota--;
        sub.classMintedCount[productClass]++;

        emit QuotaConsumed(subscriptionId, productClass, sub.remainingMintQuota);

        return true;
    }

    function _getLowerTierMintedCount(
        uint256 subscriptionId,
        Tier organizationTier
    ) internal view returns (uint256) {
        Subscription storage sub = subscriptions[subscriptionId];
        uint256 count = 0;
        
        for (uint256 i = 0; i < uint256(organizationTier); i++) {
            count += sub.classMintedCount[Tier(i)];
        }
        
        return count;
    }

    // ============ View Functions ============
    function hasActiveSubscription(address wallet) external view returns (bool) {
        uint256 subId = walletToSubscription[wallet];
        if (subId == 0) return false;
        
        Subscription storage sub = subscriptions[subId];
        return sub.verificationStatus != VerificationStatus.SUSPENDED &&
               sub.remainingMintQuota > 0;
    }

    function getSubscriptionId(address wallet) external view returns (uint256) {
        return walletToSubscription[wallet];
    }

    function getSubscriptionDetails(
        uint256 subscriptionId
    ) external view returns (
        Tier organizationTier,
        uint256 totalQuota,
        uint256 remainingQuota,
        address owner,
        VerificationStatus status,
        uint256 purchasePrice
    ) {
        Subscription storage sub = subscriptions[subscriptionId];
        return (
            sub.organizationTier,
            sub.totalMintQuota,
            sub.remainingMintQuota,
            sub.owner,
            sub.verificationStatus,
            sub.purchasePrice
        );
    }

    function getClassMintedCount(
        uint256 subscriptionId,
        Tier productClass
    ) external view returns (uint256) {
        return subscriptions[subscriptionId].classMintedCount[productClass];
    }

    function getMarketplaceFee(Tier tier) external view returns (uint256) {
        return tierMarketplaceFees[tier];
    }

    // ============ Governance Functions ============
    function updateVerificationStatus(
        uint256 subscriptionId,
        VerificationStatus newStatus
    ) external onlyOwner {
        require(_exists(subscriptionId), "SubscriptionNFT: Invalid subscription");
        
        subscriptions[subscriptionId].verificationStatus = newStatus;
        
        emit VerificationStatusUpdated(subscriptionId, newStatus);
        
        if (newStatus == VerificationStatus.SUSPENDED) {
            emit SubscriptionSuspended(subscriptionId, "Administrative suspension");
        }
    }

    function approveWalletMigration(
        uint256 subscriptionId,
        address newWallet
    ) external onlyOwner validSubscription(subscriptionId) {
        require(newWallet != address(0), "SubscriptionNFT: Invalid new wallet");
        require(
            walletToSubscription[newWallet] == 0,
            "SubscriptionNFT: New wallet already has subscription"
        );
        
        emit WalletMigrationApproved(subscriptionId, newWallet);
    }

    function migrateSubscription(
        uint256 subscriptionId,
        address newWallet
    ) external onlyOwner validSubscription(subscriptionId) {
        require(newWallet != address(0), "SubscriptionNFT: Invalid new wallet");
        require(
            walletToSubscription[newWallet] == 0,
            "SubscriptionNFT: New wallet already has subscription"
        );

        address oldWallet = ownerOf(subscriptionId);
        
        // Burn from old wallet
        walletToSubscription[oldWallet] = 0;
        _burn(subscriptionId);
        
        // Mint to new wallet
        walletToSubscription[newWallet] = subscriptionId;
        subscriptions[subscriptionId].owner = newWallet;
        _safeMint(newWallet, subscriptionId);

        emit SubscriptionMigrated(subscriptionId, oldWallet, newWallet);
    }

    // ============ Admin Functions ============
    function setFactoryContract(address _factory) external onlyOwner {
        factoryContract = _factory;
    }

    function setMarketplaceContract(address _marketplace) external onlyOwner {
        marketplaceContract = _marketplace;
    }

    function withdrawUSDC(address to, uint256 amount) external onlyOwner {
        require(usdcToken.transfer(to, amount), "SubscriptionNFT: Withdrawal failed");
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ============ Upgrade Authorization ============
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // ============ Metadata ============
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "SubscriptionNFT: Nonexistent token");
        
        Subscription storage sub = subscriptions[tokenId];
        
        string memory tierName = _getTierName(sub.organizationTier);
        string memory tierColor = _getTierColor(sub.organizationTier);
        string memory statusName = _getStatusName(sub.verificationStatus);
        
        string memory json = string(abi.encodePacked(
            '{',
            '"name":"NFT Factory Subscription #', tokenId.toString(), '",',
            '"description":"Tier-certified organization license for NFT Factory",',
            '"image":"', _generateSVG(sub, tokenId), '",',
            '"attributes":[',
            '{"trait_type":"Organization Tier","value":"', tierName, '"},',
            '{"trait_type":"Total Quota","value":', sub.totalMintQuota.toString(), '},',
            '{"trait_type":"Remaining Quota","value":', sub.remainingMintQuota.toString(), '},',
            '{"trait_type":"Verification Status","value":"', statusName, '"},',
            '{"trait_type":"Purchase Price","display_type":"number","value":', (sub.purchasePrice / 10**6).toString(), '},',
            '{"trait_type":"Minted At","display_type":"date","value":', sub.mintedAt.toString(), '}',
            ']',
            '}'
        ));

        return string(abi.encodePacked(
            "data:application/json;base64,",
            Base64.encode(bytes(json))
        ));
    }

    function _generateSVG(
        Subscription storage sub,
        uint256 tokenId
    ) internal view returns (string memory) {
        string memory tierName = _getTierName(sub.organizationTier);
        string memory tierColor = _getTierColor(sub.organizationTier);
        string memory statusColor = _getStatusColor(sub.verificationStatus);
        
        string memory svg = string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500">',
            '<defs>',
            '<linearGradient id="tierGrad" x1="0%" y1="0%" x2="100%" y2="100%">',
            '<stop offset="0%" style="stop-color:', tierColor, ';stop-opacity:1" />',
            '<stop offset="100%" style="stop-color:#1a1a1a;stop-opacity:1" />',
            '</linearGradient>',
            '</defs>',
            '<rect width="500" height="500" fill="url(#tierGrad)" rx="20"/>',
            '<rect x="20" y="20" width="460" height="460" fill="none" stroke="', tierColor, '" stroke-width="4" rx="15"/>',
            '<text x="250" y="80" text-anchor="middle" fill="white" font-family="Arial" font-size="24" font-weight="bold">NFT FACTORY</text>',
            '<text x="250" y="110" text-anchor="middle" fill="', tierColor, '" font-family="Arial" font-size="18">CERTIFIED ORGANIZATION</text>',
            '<circle cx="250" cy="200" r="60" fill="none" stroke="', tierColor, '" stroke-width="3"/>',
            '<text x="250" y="210" text-anchor="middle" fill="white" font-family="Arial" font-size="32" font-weight="bold">', _getTierSymbol(sub.organizationTier), '</text>',
            '<text x="250" y="290" text-anchor="middle" fill="white" font-family="Arial" font-size="28" font-weight="bold">', tierName, '</text>',
            '<text x="250" y="330" text-anchor="middle" fill="#888" font-family="Arial" font-size="14">TIER</text>',
            '<text x="250" y="370" text-anchor="middle" fill="white" font-family="Arial" font-size="16">Quota: ', sub.remainingMintQuota.toString(), '/', sub.totalMintQuota.toString(), '</text>',
            '<rect x="150" y="400" width="200" height="30" fill="', statusColor, '" rx="15"/>',
            '<text x="250" y="420" text-anchor="middle" fill="white" font-family="Arial" font-size="12" font-weight="bold">', _getStatusName(sub.verificationStatus), '</text>',
            '<text x="250" y="470" text-anchor="middle" fill="#666" font-family="Arial" font-size="10">ID: ', tokenId.toString(), '</text>',
            '</svg>'
        ));

        return string(abi.encodePacked(
            "data:image/svg+xml;base64,",
            Base64.encode(bytes(svg))
        ));
    }

    function _getTierName(Tier tier) internal pure returns (string memory) {
        if (tier == Tier.COAL) return "COAL";
        if (tier == Tier.BRONZE) return "BRONZE";
        if (tier == Tier.SILVER) return "SILVER";
        if (tier == Tier.GOLD) return "GOLD";
        if (tier == Tier.PLATINUM) return "PLATINUM";
        return "UNKNOWN";
    }

    function _getTierColor(Tier tier) internal pure returns (string memory) {
        if (tier == Tier.COAL) return "#36454F";
        if (tier == Tier.BRONZE) return "#CD7F32";
        if (tier == Tier.SILVER) return "#C0C0C0";
        if (tier == Tier.GOLD) return "#FFD700";
        if (tier == Tier.PLATINUM) return "#E5E4E2";
        return "#FFFFFF";
    }

    function _getTierSymbol(Tier tier) internal pure returns (string memory) {
        if (tier == Tier.COAL) return "C";
        if (tier == Tier.BRONZE) return "B";
        if (tier == Tier.SILVER) return "S";
        if (tier == Tier.GOLD) return "G";
        if (tier == Tier.PLATINUM) return "P";
        return "?";
    }

    function _getStatusName(VerificationStatus status) internal pure returns (string memory) {
        if (status == VerificationStatus.VERIFIED) return "VERIFIED";
        if (status == VerificationStatus.UNDER_REVIEW) return "UNDER REVIEW";
        if (status == VerificationStatus.SUSPENDED) return "SUSPENDED";
        return "UNKNOWN";
    }

    function _getStatusColor(VerificationStatus status) internal pure returns (string memory) {
        if (status == VerificationStatus.VERIFIED) return "#22c55e";
        if (status == VerificationStatus.UNDER_REVIEW) return "#f59e0b";
        if (status == VerificationStatus.SUSPENDED) return "#ef4444";
        return "#6b7280";
    }

    function _exists(uint256 tokenId) internal view override returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }
}

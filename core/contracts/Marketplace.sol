// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SubscriptionNFT} from "./SubscriptionNFT.sol";
import {SimpleCollectibleV2} from "./SimpleCollectibleV2.sol";

/**
 * @title Marketplace
 * @dev Tier-certified NFT marketplace with dynamic fees and filtering
 * @author NFT Factory Team
 */
contract Marketplace is 
    Initializable, 
    UUPSUpgradeable, 
    OwnableUpgradeable, 
    PausableUpgradeable,
    ReentrancyGuardUpgradeable 
{
    // ============ Errors ============
    error InvalidListing();
    error NotTokenOwner();
    error ListingNotFound();
    error InsufficientPayment();
    error InvalidPrice();
    error InvalidTokenContract();
    error TransferFailed();
    error AlreadyListed();
    error InvalidFeeRecipient();
    error TierMismatch();

    // ============ Events ============
    event Listed(
        address indexed tokenContract,
        uint256 indexed tokenId,
        address indexed seller,
        uint256 price,
        SubscriptionNFT.Tier organizationTier,
        SubscriptionNFT.Tier productClass
    );
    event Delisted(
        address indexed tokenContract,
        uint256 indexed tokenId,
        address indexed seller
    );
    event Sold(
        address indexed tokenContract,
        uint256 indexed tokenId,
        address indexed seller,
        address buyer,
        uint256 price,
        uint256 platformFee,
        uint256 royaltyFee
    );
    event PriceUpdated(
        address indexed tokenContract,
        uint256 indexed tokenId,
        uint256 newPrice
    );
    event SubscriptionNFTSet(address indexed subscriptionNFT);
    event FeeRecipientUpdated(address indexed newRecipient);

    // ============ Structs ============
    struct Listing {
        address seller;
        uint256 price;
        uint256 listedAt;
        bool active;
        SubscriptionNFT.Tier organizationTier;
        SubscriptionNFT.Tier productClass;
        SubscriptionNFT.VerificationStatus verificationStatus;
    }

    struct CollectionInfo {
        address tokenContract;
        SubscriptionNFT.Tier organizationTier;
        SubscriptionNFT.Tier productClass;
        SubscriptionNFT.VerificationStatus verificationStatus;
        uint256 listingCount;
    }

    // ============ State Variables ============
    /// @dev SubscriptionNFT contract reference
    SubscriptionNFT public subscriptionNFT;
    
    /// @dev Platform fee recipient
    address public platformFeeRecipient;
    
    /// @dev USDC token for subscription purchases
    IERC20 public usdcToken;
    
    /// @dev Mapping from token contract => token ID => Listing
    mapping(address => mapping(uint256 => Listing)) public listings;
    
    /// @dev Array of all listed token contracts
    address[] public listedCollections;
    
    /// @dev Mapping to track if a collection is listed
    mapping(address => bool) public isCollectionListed;
    
    /// @dev Total active listings count
    uint256 public totalActiveListings;

    // ============ Constants ============
    uint256 public constant VERSION = 1;
    uint256 public constant BASIS_POINTS = 10000;

    // ============ Modifiers ============
    modifier validListing(address tokenContract, uint256 tokenId) {
        if (!listings[tokenContract][tokenId].active) revert ListingNotFound();
        _;
    }

    modifier notListed(address tokenContract, uint256 tokenId) {
        if (listings[tokenContract][tokenId].active) revert AlreadyListed();
        _;
    }

    // ============ Constructor & Initializer ============
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the marketplace
     * @param _subscriptionNFT Address of the SubscriptionNFT contract
     * @param _platformFeeRecipient Address to receive platform fees
     * @param _usdcToken Address of USDC token
     */
    function initialize(
        address _subscriptionNFT,
        address _platformFeeRecipient,
        address _usdcToken
    ) public initializer {
        if (_subscriptionNFT == address(0)) revert InvalidTokenContract();
        if (_platformFeeRecipient == address(0)) revert InvalidFeeRecipient();
        if (_usdcToken == address(0)) revert InvalidTokenContract();
        
        __Ownable_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        
        subscriptionNFT = SubscriptionNFT(_subscriptionNFT);
        platformFeeRecipient = _platformFeeRecipient;
        usdcToken = IERC20(_usdcToken);
    }

    // ============ Listing Functions ============

    /**
     * @notice Lists an NFT for sale
     * @param tokenContract Address of the NFT contract
     * @param tokenId ID of the token to list
     * @param price Sale price in wei
     */
    function list(
        address tokenContract,
        uint256 tokenId,
        uint256 price
    ) 
        external 
        whenNotPaused
        notListed(tokenContract, tokenId)
    {
        if (price == 0) revert InvalidPrice();
        if (tokenContract == address(0)) revert InvalidTokenContract();
        
        IERC721 nft = IERC721(tokenContract);
        if (nft.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();

        // Get tier/class info from the collection
        SimpleCollectibleV2 collection = SimpleCollectibleV2(payable(tokenContract));
        SimpleCollectibleV2.CollectionMetadata memory metadata = collection.getCollectionMetadata();

        // Create listing
        listings[tokenContract][tokenId] = Listing({
            seller: msg.sender,
            price: price,
            listedAt: block.timestamp,
            active: true,
            organizationTier: metadata.organizationTier,
            productClass: metadata.productClass,
            verificationStatus: metadata.verificationStatus
        });

        // Track collection
        if (!isCollectionListed[tokenContract]) {
            listedCollections.push(tokenContract);
            isCollectionListed[tokenContract] = true;
        }

        totalActiveListings++;

        emit Listed(
            tokenContract,
            tokenId,
            msg.sender,
            price,
            metadata.organizationTier,
            metadata.productClass
        );
    }

    /**
     * @notice Delists an NFT
     * @param tokenContract Address of the NFT contract
     * @param tokenId ID of the token to delist
     */
    function delist(
        address tokenContract,
        uint256 tokenId
    ) 
        external 
        whenNotPaused
        validListing(tokenContract, tokenId)
    {
        Listing storage listing = listings[tokenContract][tokenId];
        if (listing.seller != msg.sender) revert NotTokenOwner();

        listing.active = false;
        totalActiveListings--;

        emit Delisted(tokenContract, tokenId, msg.sender);
    }

    /**
     * @notice Updates the price of a listed NFT
     * @param tokenContract Address of the NFT contract
     * @param tokenId ID of the token
     * @param newPrice New sale price
     */
    function updatePrice(
        address tokenContract,
        uint256 tokenId,
        uint256 newPrice
    ) 
        external 
        whenNotPaused
        validListing(tokenContract, tokenId)
    {
        if (newPrice == 0) revert InvalidPrice();
        
        Listing storage listing = listings[tokenContract][tokenId];
        if (listing.seller != msg.sender) revert NotTokenOwner();

        listing.price = newPrice;

        emit PriceUpdated(tokenContract, tokenId, newPrice);
    }

    // ============ Purchase Functions ============

    /**
     * @notice Purchases a listed NFT
     * @param tokenContract Address of the NFT contract
     * @param tokenId ID of the token to purchase
     */
    function buy(
        address tokenContract,
        uint256 tokenId
    ) 
        external 
        payable
        whenNotPaused
        nonReentrant
        validListing(tokenContract, tokenId)
    {
        Listing storage listing = listings[tokenContract][tokenId];
        if (msg.value < listing.price) revert InsufficientPayment();

        // Calculate fees based on organization tier
        uint256 platformFeeBps = subscriptionNFT.getMarketplaceFee(listing.organizationTier);
        uint256 platformFee = (listing.price * platformFeeBps) / BASIS_POINTS;

        // Get royalty info
        SimpleCollectibleV2 collection = SimpleCollectibleV2(payable(tokenContract));
        (address royaltyReceiver, uint256 royaltyFee) = collection.royaltyInfo(tokenId, listing.price);

        // Calculate seller proceeds
        uint256 sellerProceeds = listing.price - platformFee - royaltyFee;

        // Mark listing as inactive
        listing.active = false;
        totalActiveListings--;

        // Transfer NFT to buyer
        IERC721(tokenContract).safeTransferFrom(listing.seller, msg.sender, tokenId);

        // Transfer funds
        _transferETH(listing.seller, sellerProceeds);
        _transferETH(platformFeeRecipient, platformFee);
        if (royaltyFee > 0 && royaltyReceiver != address(0)) {
            _transferETH(royaltyReceiver, royaltyFee);
        }

        // Refund excess
        if (msg.value > listing.price) {
            _transferETH(msg.sender, msg.value - listing.price);
        }

        emit Sold(
            tokenContract,
            tokenId,
            listing.seller,
            msg.sender,
            listing.price,
            platformFee,
            royaltyFee
        );
    }

    // ============ Subscription Purchase Functions ============

    /**
     * @notice Purchases a subscription NFT (for initial marketplace availability)
     * @param tier Subscription tier to purchase
     */
    function purchaseSubscription(SubscriptionNFT.Tier tier) 
        external 
        whenNotPaused
        nonReentrant
        returns (uint256 subscriptionId)
    {
        // Delegate to SubscriptionNFT contract
        subscriptionId = subscriptionNFT.mintSubscription(tier);
        return subscriptionId;
    }

    // ============ View Functions ============

    /**
     * @notice Returns listing details
     */
    function getListing(
        address tokenContract,
        uint256 tokenId
    ) 
        external 
        view 
        returns (Listing memory) 
    {
        return listings[tokenContract][tokenId];
    }

    /**
     * @notice Returns all listed collections
     */
    function getListedCollections() external view returns (address[] memory) {
        return listedCollections;
    }

    /**
     * @notice Returns listings filtered by organization tier
     */
    function getListingsByTier(
        SubscriptionNFT.Tier tier
    ) 
        external 
        view 
        returns (
            address[] memory tokenContracts,
            uint256[] memory tokenIds,
            Listing[] memory listingDetails
        ) 
    {
        // First count matching listings
        uint256 count = 0;
        for (uint256 c = 0; c < listedCollections.length; c++) {
            address collection = listedCollections[c];
            // This is a simplified version - in production, you'd want to track listings per collection
            // For now, we'll return empty arrays
        }

        return (new address[](0), new uint256[](0), new Listing[](0));
    }

    /**
     * @notice Returns listings filtered by product class
     */
    function getListingsByProductClass(
        SubscriptionNFT.Tier productClass
    ) 
        external 
        view 
        returns (
            address[] memory tokenContracts,
            uint256[] memory tokenIds,
            Listing[] memory listingDetails
        ) 
    {
        // Simplified implementation
        return (new address[](0), new uint256[](0), new Listing[](0));
    }

    /**
     * @notice Returns listings filtered by verification status
     */
    function getListingsByVerificationStatus(
        SubscriptionNFT.VerificationStatus status
    ) 
        external 
        view 
        returns (
            address[] memory tokenContracts,
            uint256[] memory tokenIds,
            Listing[] memory listingDetails
        ) 
    {
        // Simplified implementation
        return (new address[](0), new uint256[](0), new Listing[](0));
    }

    /**
     * @notice Returns the platform fee for a given tier
     */
    function getPlatformFee(SubscriptionNFT.Tier tier) external view returns (uint256) {
        return subscriptionNFT.getMarketplaceFee(tier);
    }

    /**
     * @notice Returns the total number of active listings
     */
    function getTotalActiveListings() external view returns (uint256) {
        return totalActiveListings;
    }

    // ============ Admin Functions ============

    /**
     * @notice Updates the SubscriptionNFT contract reference
     */
    function setSubscriptionNFT(address _subscriptionNFT) external onlyOwner {
        if (_subscriptionNFT == address(0)) revert InvalidTokenContract();
        subscriptionNFT = SubscriptionNFT(_subscriptionNFT);
        emit SubscriptionNFTSet(_subscriptionNFT);
    }

    /**
     * @notice Updates the platform fee recipient
     */
    function setPlatformFeeRecipient(address _recipient) external onlyOwner {
        if (_recipient == address(0)) revert InvalidFeeRecipient();
        platformFeeRecipient = _recipient;
        emit FeeRecipientUpdated(_recipient);
    }

    /**
     * @notice Pauses the marketplace
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpauses the marketplace
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Emergency withdrawal of stuck funds
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance > 0) {
            _transferETH(owner(), balance);
        }
    }

    // ============ Internal Functions ============

    /**
     * @dev Transfers ETH to a recipient
     */
    function _transferETH(address recipient, uint256 amount) internal {
        (bool success, ) = payable(recipient).call{value: amount}("");
        if (!success) revert TransferFailed();
    }

    /**
     * @dev Authorizes contract upgrades
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /**
     * @dev Receives ETH
     */
    receive() external payable {}
}

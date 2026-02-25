// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {ERC2981Upgradeable} from "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {Counters} from "@openzeppelin/contracts/utils/Counters.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {SubscriptionNFT} from "./SubscriptionNFT.sol";

/**
 * @title SimpleCollectibleV2
 * @dev Upgradeable ERC-721 NFT contract with tier/class encoding and redemption capabilities
 * @author NFT Factory Team
 */
contract SimpleCollectibleV2 is 
    Initializable,
    ERC721Upgradeable,
    ERC2981Upgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    using Counters for Counters.Counter;
    using Strings for uint256;

    // ============ Errors ============
    error TokenAlreadyRedeemed();
    error NotTokenOwner();
    error InsufficientMintFee();
    error MismatchedArrayLengths();
    error TokenUriCreationFailed();
    error TokenInEscrow();
    error NotInEscrow();
    error InvalidTokenIndex();
    error NoFundsToWithdraw();
    error TransferFailed();
    error RoyaltyTooHigh();
    error InvalidAddress();
    error InvalidFeeBps();
    error AlreadyInitialized();

    // ============ Events ============
    event CollectibleCreated(
        address indexed recipient,
        uint256 indexed uriIndex,
        uint256 indexed tokenId,
        uint256 mintFee,
        SubscriptionNFT.Tier organizationTier,
        SubscriptionNFT.Tier productClass
    );
    event RedeemInitiated(
        uint256 indexed tokenId,
        address indexed owner,
        uint256 escrowIndex
    );
    event RedeemCancelled(
        uint256 indexed tokenId,
        address indexed owner
    );
    event Redeemed(
        uint256 indexed tokenId,
        address indexed owner,
        uint256 timestamp
    );
    event Withdrawn(
        address indexed owner,
        uint256 amount,
        uint256 timestamp
    );
    event MintFeeAdjusted(
        uint256 indexed index,
        uint256 oldFee,
        uint256 newFee
    );
    event URIAdjusted(
        uint256 indexed index,
        string oldURI,
        string newURI
    );
    event CustomRoyaltySet(
        address indexed receiver,
        uint96 feeNumerator
    );

    // ============ Structs ============
    struct TokenData {
        uint256 index;
        string uri;
        uint256 mintFee;
    }

    struct EscrowEntry {
        uint256 uriIndex;
        uint256 tokenId;
        uint256 escrowIndex;
        uint256 createdAt;
    }

    struct CollectionMetadata {
        uint256 subscriptionId;
        SubscriptionNFT.Tier organizationTier;
        SubscriptionNFT.Tier productClass;
        SubscriptionNFT.VerificationStatus verificationStatus;
        uint256 deployedAt;
        bytes32 factorySignatureHash;
    }

    // ============ State Variables ============
    Counters.Counter private _tokenIds;
    
    /// @dev Array of all token data (URI + mint fee)
    TokenData[] public tokenData;
    
    /// @dev Mapping from token ID to its URI index
    mapping(uint256 => uint256) public tokenToUriIndex;
    
    /// @dev Mapping from URI index to array of token owners
    mapping(uint256 => address[]) public uriOwners;
    
    /// @dev Mapping from owner to their token IDs
    mapping(address => uint256[]) public ownerTokens;
    
    /// @dev Mapping from owner to their escrowed tokens
    mapping(address => EscrowEntry[]) public userEscrow;
    
    /// @dev Mapping to track if token is in escrow
    mapping(uint256 => bool) public isInEscrow;
    
    /// @dev Platform fee recipient (NFT Factory)
    address public platformFeeRecipient;
    
    /// @dev Platform fee in basis points
    uint96 public platformFeeBps;
    
    /// @dev Custom royalty info per token
    mapping(uint256 => address) public customRoyaltyReceiver;
    mapping(uint256 => uint96) public customRoyaltyBps;
    
    /// @dev Collection metadata (tier/class info)
    CollectionMetadata public collectionMetadata;
    
    /// @dev Mapping from token ID to its metadata
    mapping(uint256 => TokenMetadata) public tokenMetadata;
    
    /// @dev Initialization flag
    bool private _initialized;

    // ============ Token Metadata Struct ============
    struct TokenMetadata {
        uint256 tokenId;
        uint256 uriIndex;
        SubscriptionNFT.Tier organizationTier;
        SubscriptionNFT.Tier productClass;
        SubscriptionNFT.VerificationStatus verificationStatus;
        uint256 mintedAt;
        bytes32 factorySignatureHash;
    }

    // ============ Constants ============
    uint256 public constant MAX_ROYALTY_BPS = 5000; // 50%
    uint256 public constant VERSION = 2;

    // ============ Modifiers ============
    modifier validTokenIndex(uint256 index) {
        if (index >= tokenData.length) revert InvalidTokenIndex();
        _;
    }

    modifier notInEscrow(uint256 tokenId) {
        if (isInEscrow[tokenId]) revert TokenInEscrow();
        _;
    }

    // ============ Constructor & Initializer ============
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the NFT collection with tier/class metadata
     * @param _name Token name
     * @param _symbol Token symbol
     * @param _URIs Array of token URIs
     * @param _mintFees Array of mint fees
     * @param _owner Collection owner
     * @param _platformFeeRecipient Platform fee recipient
     * @param _platformFeeBps Platform fee in basis points
     * @param _subscriptionId Parent subscription ID
     * @param _organizationTier Organization tier
     * @param _productClass Product class
     * @param _verificationStatus Verification status
     */
    function initialize(
        string memory _name,
        string memory _symbol,
        string[] memory _URIs,
        uint256[] memory _mintFees,
        address _owner,
        address _platformFeeRecipient,
        uint96 _platformFeeBps,
        uint256 _subscriptionId,
        SubscriptionNFT.Tier _organizationTier,
        SubscriptionNFT.Tier _productClass,
        SubscriptionNFT.VerificationStatus _verificationStatus
    ) public initializer {
        if (_URIs.length != _mintFees.length) revert MismatchedArrayLengths();
        if (_platformFeeRecipient == address(0)) revert InvalidAddress();
        if (_platformFeeBps > 1000) revert InvalidFeeBps(); // Max 10% platform fee

        __ERC721_init(_name, _symbol);
        __ERC2981_init();
        __Ownable_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        // Transfer ownership to the specified owner
        _transferOwnership(_owner);

        // Set platform fee info
        platformFeeRecipient = _platformFeeRecipient;
        platformFeeBps = _platformFeeBps;

        // Set default royalty
        _setDefaultRoyalty(_platformFeeRecipient, _platformFeeBps);

        // Set collection metadata
        collectionMetadata = CollectionMetadata({
            subscriptionId: _subscriptionId,
            organizationTier: _organizationTier,
            productClass: _productClass,
            verificationStatus: _verificationStatus,
            deployedAt: block.timestamp,
            factorySignatureHash: keccak256(abi.encodePacked(
                _subscriptionId,
                _organizationTier,
                _productClass,
                block.timestamp
            ))
        });

        // Initialize token data
        for (uint256 i = 0; i < _URIs.length; i++) {
            tokenData.push(TokenData({
                index: i,
                uri: _URIs[i],
                mintFee: _mintFees[i]
            }));
        }
    }

    // ============ Minting Functions ============

    /**
     * @notice Mints a new NFT with tier/class metadata
     * @param recipient Address to receive the NFT
     * @param _uriIndex Index of the token type to mint
     * @return tokenId The ID of the newly minted token
     */
    function createCollectible(
        address recipient,
        uint256 _uriIndex
    ) 
        external 
        payable 
        whenNotPaused
        validTokenIndex(_uriIndex)
        returns (uint256 tokenId) 
    {
        TokenData memory data = tokenData[_uriIndex];
        
        if (msg.value < data.mintFee) revert InsufficientMintFee();

        tokenId = _tokenIds.current();
        
        _safeMint(recipient, tokenId);
        _setTokenURI(tokenId, _uriIndex);
        
        // Store token metadata with tier/class info
        tokenMetadata[tokenId] = TokenMetadata({
            tokenId: tokenId,
            uriIndex: _uriIndex,
            organizationTier: collectionMetadata.organizationTier,
            productClass: collectionMetadata.productClass,
            verificationStatus: collectionMetadata.verificationStatus,
            mintedAt: block.timestamp,
            factorySignatureHash: collectionMetadata.factorySignatureHash
        });
        
        tokenToUriIndex[tokenId] = _uriIndex;
        ownerTokens[recipient].push(tokenId);
        uriOwners[_uriIndex].push(recipient);

        _tokenIds.increment();

        emit CollectibleCreated(
            recipient, 
            _uriIndex, 
            tokenId, 
            data.mintFee,
            collectionMetadata.organizationTier,
            collectionMetadata.productClass
        );

        return tokenId;
    }

    // ============ Redemption Functions ============

    /**
     * @notice Initiates the redemption process for a token
     * @param _tokenId ID of the token to redeem
     * @param _uriIndex URI index of the token (for verification)
     */
    function redeem(
        uint256 _tokenId,
        uint256 _uriIndex
    ) 
        external 
        whenNotPaused
        notInEscrow(_tokenId)
    {
        if (ownerOf(_tokenId) != msg.sender) revert NotTokenOwner();
        if (tokenToUriIndex[_tokenId] != _uriIndex) revert InvalidTokenIndex();

        uint256 escrowIndex = userEscrow[msg.sender].length;
        
        userEscrow[msg.sender].push(EscrowEntry({
            uriIndex: _uriIndex,
            tokenId: _tokenId,
            escrowIndex: escrowIndex,
            createdAt: block.timestamp
        }));
        
        isInEscrow[_tokenId] = true;

        // Transfer token to contract
        _transfer(msg.sender, address(this), _tokenId);

        emit RedeemInitiated(_tokenId, msg.sender, escrowIndex);
    }

    /**
     * @notice Cancels a pending redemption and returns the token
     * @param _tokenId ID of the token to cancel redemption for
     */
    function cancelRedeem(uint256 _tokenId) external whenNotPaused {
        if (!isInEscrow[_tokenId]) revert NotInEscrow();

        EscrowEntry[] storage escrows = userEscrow[msg.sender];
        bool found = false;
        
        for (uint256 i = 0; i < escrows.length; i++) {
            if (escrows[i].tokenId == _tokenId && escrows[i].createdAt != 0) {
                // Mark as cancelled by setting createdAt to 0
                escrows[i].createdAt = 0;
                found = true;
                break;
            }
        }
        
        if (!found) revert NotTokenOwner();

        isInEscrow[_tokenId] = false;

        // Return token to owner
        _transfer(address(this), msg.sender, _tokenId);

        emit RedeemCancelled(_tokenId, msg.sender);
    }

    /**
     * @notice Acknowledges and completes a redemption (owner only)
     * @param _tokenId ID of the token being redeemed
     * @param _uriIndex URI index of the token
     * @param _escrowIndex Index in the escrow array
     */
    function ackRedeem(
        uint256 _tokenId,
        uint256 _uriIndex,
        uint256 _escrowIndex
    ) external onlyOwner {
        if (!isInEscrow[_tokenId]) revert NotInEscrow();

        address tokenOwner = _getEscrowOwner(_tokenId);
        
        // Burn the token
        _burn(_tokenId);
        
        // Remove from escrow
        isInEscrow[_tokenId] = false;
        if (_escrowIndex < userEscrow[tokenOwner].length) {
            userEscrow[tokenOwner][_escrowIndex].createdAt = 0;
        }

        // Remove from owner's token list
        _removeFromOwnerTokens(tokenOwner, _tokenId);

        // Remove from uri owners
        _removeFromUriOwners(_uriIndex, tokenOwner);

        emit Redeemed(_tokenId, tokenOwner, block.timestamp);
    }

    // ============ Admin Functions ============

    /**
     * @notice Adjusts the mint fee for a token type
     * @param index Index of the token type
     * @param _newMintFee New mint fee
     */
    function adjustMintFee(
        uint256 index,
        uint256 _newMintFee
    ) external onlyOwner validTokenIndex(index) {
        uint256 oldFee = tokenData[index].mintFee;
        tokenData[index].mintFee = _newMintFee;
        
        emit MintFeeAdjusted(index, oldFee, _newMintFee);
    }

    /**
     * @notice Adjusts the URI for a token type
     * @param index Index of the token type
     * @param _newURI New URI
     */
    function adjustURI(
        uint256 index,
        string memory _newURI
    ) external onlyOwner validTokenIndex(index) {
        string memory oldURI = tokenData[index].uri;
        tokenData[index].uri = _newURI;
        
        emit URIAdjusted(index, oldURI, _newURI);
    }

    /**
     * @notice Sets custom royalty for a specific token
     * @param tokenId Token ID
     * @param receiver Royalty receiver
     * @param feeBps Royalty in basis points
     */
    function setCustomRoyalty(
        uint256 tokenId,
        address receiver,
        uint96 feeBps
    ) external onlyOwner {
        if (feeBps > MAX_ROYALTY_BPS) revert RoyaltyTooHigh();
        if (receiver == address(0)) revert InvalidAddress();
        
        customRoyaltyReceiver[tokenId] = receiver;
        customRoyaltyBps[tokenId] = feeBps;
        
        _setTokenRoyalty(tokenId, receiver, feeBps);
        
        emit CustomRoyaltySet(receiver, feeBps);
    }

    /**
     * @notice Withdraws all accumulated funds
     */
    function withdraw() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        if (balance == 0) revert NoFundsToWithdraw();

        (bool sent, ) = payable(owner()).call{value: balance}("");
        if (!sent) revert TransferFailed();

        emit Withdrawn(owner(), balance, block.timestamp);
    }

    /**
     * @notice Pauses the contract
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpauses the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ============ View Functions ============

    /**
     * @notice Returns all token data
     */
    function getData() external view returns (TokenData[] memory) {
        return tokenData;
    }

    /**
     * @notice Returns token IDs owned by an address
     * @param _owner Owner address
     */
    function getTokenData(address _owner) external view returns (uint256[] memory) {
        return ownerTokens[_owner];
    }

    /**
     * @notice Returns escrowed tokens for an address
     * @param _owner Owner address
     */
    function getEscrowedTokens(address _owner) external view returns (EscrowEntry[] memory) {
        return userEscrow[_owner];
    }

    /**
     * @notice Returns owners of a specific token type
     * @param index Token type index
     */
    function getOwners(uint256 index) external view returns (address[] memory) {
        return uriOwners[index];
    }

    /**
     * @notice Returns the token URI
     * @param tokenId Token ID
     */
    function tokenURI(
        uint256 tokenId
    ) public view override returns (string memory) {
        _requireMinted(tokenId);
        uint256 uriIndex = tokenToUriIndex[tokenId];
        return tokenData[uriIndex].uri;
    }

    /**
     * @notice Returns extended token metadata with tier/class info
     * @param tokenId Token ID
     */
    function getTokenMetadata(uint256 tokenId) 
        external 
        view 
        returns (TokenMetadata memory) 
    {
        _requireMinted(tokenId);
        return tokenMetadata[tokenId];
    }

    /**
     * @notice Returns collection metadata
     */
    function getCollectionMetadata() 
        external 
        view 
        returns (CollectionMetadata memory) 
    {
        return collectionMetadata;
    }

    /**
     * @notice Returns royalty info for a token
     * @param tokenId Token ID
     * @param salePrice Sale price
     */
    function royaltyInfo(
        uint256 tokenId,
        uint256 salePrice
    ) public view override returns (address receiver, uint256 royaltyAmount) {
        // Check for custom royalty first
        if (customRoyaltyReceiver[tokenId] != address(0)) {
            receiver = customRoyaltyReceiver[tokenId];
            royaltyAmount = (salePrice * customRoyaltyBps[tokenId]) / 10000;
        } else {
            // Use default royalty
            (receiver, royaltyAmount) = super.royaltyInfo(tokenId, salePrice);
        }
    }

    /**
     * @notice Returns contract version
     */
    function version() external pure returns (uint256) {
        return VERSION;
    }

    /**
     * @notice Returns the total supply
     */
    function totalSupply() external view returns (uint256) {
        return _tokenIds.current();
    }

    /**
     * @notice Returns the organization tier of this collection
     */
    function getOrganizationTier() external view returns (SubscriptionNFT.Tier) {
        return collectionMetadata.organizationTier;
    }

    /**
     * @notice Returns the product class of this collection
     */
    function getProductClass() external view returns (SubscriptionNFT.Tier) {
        return collectionMetadata.productClass;
    }

    // ============ Internal Functions ============

    /**
     * @dev Sets the token URI
     */
    function _setTokenURI(uint256 tokenId, uint256 uriIndex) internal {
        tokenToUriIndex[tokenId] = uriIndex;
    }

    /**
     * @dev Finds the owner of an escrowed token
     */
    function _getEscrowOwner(uint256 _tokenId) internal view returns (address) {
        // Since the token is held by the contract, we need to find the original owner from escrow data
        // This is a simplified version - in production, you might want a reverse mapping
        return ownerOf(_tokenId); // This will revert if token doesn't exist
    }

    /**
     * @dev Removes a token from owner's token list
     */
    function _removeFromOwnerTokens(address _owner, uint256 _tokenId) internal {
        uint256[] storage tokens = ownerTokens[_owner];
        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] == _tokenId) {
                tokens[i] = tokens[tokens.length - 1];
                tokens.pop();
                break;
            }
        }
    }

    /**
     * @dev Removes an owner from URI owners list
     */
    function _removeFromUriOwners(uint256 uriIndex, address _owner) internal {
        address[] storage owners = uriOwners[uriIndex];
        for (uint256 i = 0; i < owners.length; i++) {
            if (owners[i] == _owner) {
                owners[i] = owners[owners.length - 1];
                owners.pop();
                break;
            }
        }
    }

    /**
     * @dev Authorizes contract upgrades
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /**
     * @dev Checks if contract supports an interface
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721Upgradeable, ERC2981Upgradeable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    /**
     * @dev Hook that is called before any token transfer
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override whenNotPaused {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    /**
     * @dev Receives ETH
     */
    receive() external payable {}
}

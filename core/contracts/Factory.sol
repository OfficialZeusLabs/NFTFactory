// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {SimpleCollectible} from "./SimpleCollectible.sol";

/**
 * @title Factory
 * @dev Factory contract for deploying upgradeable NFT collections with redemption capabilities
 * @author NFT Factory Team
 */
contract Factory is 
    Initializable, 
    UUPSUpgradeable, 
    OwnableUpgradeable, 
    PausableUpgradeable,
    ReentrancyGuardUpgradeable 
{
    // ============ Errors ============
    error MismatchedArrayLengths();
    error EmptyString();
    error EmptyArray();
    error InvalidFeeBps();
    error CollectionNotFound();
    error InvalidPlatformFeeRecipient();

    // ============ Events ============
    event CollectionDeployed(
        address indexed collectionAddress,
        string name,
        string symbol,
        address indexed creator,
        uint256 timestamp
    );
    event PlatformFeeConfigUpdated(
        address indexed newRecipient,
        uint96 newFeeBps
    );
    event CollectionImplementationUpdated(
        address indexed newImplementation
    );

    // ============ Structs ============
    struct CollectionInfo {
        string name;
        string symbol;
        address creator;
        uint256 deployedAt;
        uint256 uriCount;
    }

    // ============ State Variables ============
    /// @dev Array of all deployed collection addresses
    address[] public marketplace;
    
    /// @dev Mapping from collection address to its details
    mapping(address => CollectionInfo) public collectionDetails;
    
    /// @dev Platform fee recipient (NFT Factory)
    address public platformFeeRecipient;
    
    /// @dev Platform fee in basis points (e.g., 250 = 2.5%)
    uint96 public platformFeeBps;
    
    /// @dev Implementation contract for new collections
    address public collectionImplementation;

    // ============ Constants ============
    uint256 public constant MAX_PLATFORM_FEE_BPS = 1000; // 10% max
    uint256 public constant VERSION = 1;

    // ============ Modifiers ============
    modifier validString(string memory str) {
        if (bytes(str).length == 0) revert EmptyString();
        _;
    }

    modifier validArray(string[] memory arr) {
        if (arr.length == 0) revert EmptyArray();
        _;
    }

    // ============ Constructor & Initializer ============
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the factory contract
     * @param _platformFeeRecipient Address to receive platform royalties
     * @param _platformFeeBps Platform fee in basis points (max 10%)
     */
    function initialize(
        address _platformFeeRecipient,
        uint96 _platformFeeBps
    ) public initializer {
        if (_platformFeeRecipient == address(0)) revert InvalidPlatformFeeRecipient();
        if (_platformFeeBps > MAX_PLATFORM_FEE_BPS) revert InvalidFeeBps();
        
        __Ownable_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        
        platformFeeRecipient = _platformFeeRecipient;
        platformFeeBps = _platformFeeBps;
        
        // Deploy the implementation contract for collections
        collectionImplementation = address(new SimpleCollectible());
    }

    // ============ External Functions ============
    
    /**
     * @notice Deploys a new NFT collection
     * @param name Collection name
     * @param symbol Collection symbol
     * @param _URIs Array of token URIs for different types
     * @param _mintFees Array of mint fees corresponding to each URI
     * @return collectionAddress Address of the newly deployed collection
     */
    function deploy(
        string memory name,
        string memory symbol,
        string[] memory _URIs,
        uint256[] memory _mintFees
    ) 
        external 
        whenNotPaused 
        nonReentrant
        validString(name)
        validString(symbol)
        validArray(_URIs)
        returns (address collectionAddress) 
    {
        if (_URIs.length != _mintFees.length) revert MismatchedArrayLengths();

        // Deploy proxy for the new collection
        bytes memory initData = abi.encodeWithSelector(
            SimpleCollectible.initialize.selector,
            name,
            symbol,
            _URIs,
            _mintFees,
            msg.sender,
            platformFeeRecipient,
            platformFeeBps
        );

        collectionAddress = _deployProxy(collectionImplementation, initData);

        // Track the collection
        marketplace.push(collectionAddress);
        collectionDetails[collectionAddress] = CollectionInfo({
            name: name,
            symbol: symbol,
            creator: msg.sender,
            deployedAt: block.timestamp,
            uriCount: _URIs.length
        });

        emit CollectionDeployed(
            collectionAddress,
            name,
            symbol,
            msg.sender,
            block.timestamp
        );

        return collectionAddress;
    }

    /**
     * @notice Updates platform fee configuration
     * @param _platformFeeRecipient New platform fee recipient
     * @param _platformFeeBps New platform fee in basis points
     */
    function updatePlatformFeeConfig(
        address _platformFeeRecipient,
        uint96 _platformFeeBps
    ) external onlyOwner {
        if (_platformFeeRecipient == address(0)) revert InvalidPlatformFeeRecipient();
        if (_platformFeeBps > MAX_PLATFORM_FEE_BPS) revert InvalidFeeBps();
        
        platformFeeRecipient = _platformFeeRecipient;
        platformFeeBps = _platformFeeBps;
        
        emit PlatformFeeConfigUpdated(_platformFeeRecipient, _platformFeeBps);
    }

    /**
     * @notice Updates the collection implementation contract
     * @param _newImplementation Address of new implementation
     */
    function updateCollectionImplementation(address _newImplementation) external onlyOwner {
        if (_newImplementation == address(0)) revert InvalidPlatformFeeRecipient();
        collectionImplementation = _newImplementation;
        emit CollectionImplementationUpdated(_newImplementation);
    }

    /**
     * @notice Pauses the factory
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpauses the factory
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ============ View Functions ============

    /**
     * @notice Returns all deployed collection addresses
     */
    function getMarketPlaces() external view returns (address[] memory) {
        return marketplace;
    }

    /**
     * @notice Returns collection details
     * @param collection Address of the collection
     */
    function getCollectionDetails(address collection) 
        external 
        view 
        returns (CollectionInfo memory) 
    {
        if (collectionDetails[collection].deployedAt == 0) revert CollectionNotFound();
        return collectionDetails[collection];
    }

    /**
     * @notice Returns the total number of collections
     */
    function getCollectionCount() external view returns (uint256) {
        return marketplace.length;
    }

    /**
     * @notice Returns collections created by a specific address
     * @param creator Address of the creator
     */
    function getCollectionsByCreator(address creator) 
        external 
        view 
        returns (address[] memory) 
    {
        uint256 count = 0;
        for (uint256 i = 0; i < marketplace.length; i++) {
            if (collectionDetails[marketplace[i]].creator == creator) {
                count++;
            }
        }

        address[] memory creatorCollections = new address[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < marketplace.length; i++) {
            if (collectionDetails[marketplace[i]].creator == creator) {
                creatorCollections[index] = marketplace[i];
                index++;
            }
        }

        return creatorCollections;
    }

    /**
     * @notice Returns the contract version
     */
    function version() external pure returns (uint256) {
        return VERSION;
    }

    // ============ Internal Functions ============

    /**
     * @dev Deploys a minimal proxy for a collection
     */
    function _deployProxy(
        address implementation,
        bytes memory initData
    ) internal returns (address proxy) {
        // Deploy ERC1967 proxy
        bytes memory proxyBytecode = abi.encodePacked(
            hex"3d602d80600a3d3981f3363d3d373d3d3d363d73",
            implementation,
            hex"5af43d82803e903d91602b57fd5bf3"
        );

        assembly {
            proxy := create(0, add(proxyBytecode, 0x20), mload(proxyBytecode))
        }

        if (proxy == address(0)) revert InvalidPlatformFeeRecipient();

        // Initialize the proxy
        (bool success, ) = proxy.call(initData);
        if (!success) revert InvalidPlatformFeeRecipient();

        return proxy;
    }

    /**
     * @dev Authorizes contract upgrades
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}

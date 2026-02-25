import { StatusCodes } from 'http-status-codes';
import ContractModel from "../models/contract_model.js";
import ContractRepository from "../repository/contract_repo.js";
import Preconditions from "../utils/preconditions.js";
import ResponseHandler from "../utils/response_handler.js";

class ContractService {
    static async storeContract(req, res) {
        const { address, token, contract_type, network, chain_id, metadata } = req.body;
        const badRequestError = Preconditions.checkNotNull({ address });
        if (badRequestError) {
            return ResponseHandler.sendErrorResponse(res, StatusCodes.BAD_REQUEST, badRequestError);
        }
        try {
            const storeContract = await ContractModel.create({ 
                address, 
                token: token ?? "",
                contract_type: contract_type ?? 'collection',
                network: network ?? 'baseSepolia',
                chain_id: chain_id ?? 84532,
                metadata: metadata ?? {}
            });
            await storeContract.save();
            return ResponseHandler.sendResponseWithoutData(res, StatusCodes.OK, "Contract stored successfully");
        }
        catch (error) {
            console.error(error);
            return ResponseHandler.sendErrorResponse(res, StatusCodes.BAD_REQUEST, "Error storing contract");
        }
    }

    static async fetchContract(req, res) {
        const { address } = req.params;
        const badRequestError = Preconditions.checkNotNull({ address });
        if (badRequestError) {
            return ResponseHandler.sendErrorResponse(res, StatusCodes.BAD_REQUEST, badRequestError);
        }
        const addressExists = await ContractRepository.findByAddress(address);
        if (!addressExists) {
            return ResponseHandler.sendErrorResponse(res, StatusCodes.BAD_REQUEST, "Address does not exists");
        }
        return ResponseHandler.sendResponseWithData(res, StatusCodes.OK, "Address successfully retrieved", addressExists);
    }

    static async storeDeploymentConfig(req, res) {
        const { network, chain_id, contracts, usdcAddress, tierPricing } = req.body;
        
        try {
            const deploymentContracts = [
                { type: 'subscription_nft', address: contracts.subscriptionNFT?.proxy, impl: contracts.subscriptionNFT?.implementation },
                { type: 'factory', address: contracts.factoryV2?.proxy, impl: contracts.factoryV2?.implementation },
                { type: 'marketplace', address: contracts.marketplace?.proxy, impl: contracts.marketplace?.implementation },
                { type: 'implementation', address: contracts.simpleCollectible?.implementation, name: 'SimpleCollectible' },
                { type: 'implementation', address: contracts.simpleCollectibleV2?.implementation, name: 'SimpleCollectibleV2' },
            ];

            const savedContracts = [];
            for (const contract of deploymentContracts) {
                if (contract.address) {
                    const saved = await ContractModel.create({
                        contract_address: contract.address,
                        contract_type: contract.type,
                        network: network ?? 'baseSepolia',
                        chain_id: chain_id ?? 84532,
                        metadata: {
                            implementation: contract.impl,
                            name: contract.name,
                            usdcAddress,
                            tierPricing
                        }
                    });
                    savedContracts.push(saved);
                }
            }

            return ResponseHandler.sendResponseWithData(res, StatusCodes.OK, "Deployment configuration stored successfully", {
                contractsStored: savedContracts.length,
                network,
                chain_id
            });
        } catch (error) {
            console.error(error);
            return ResponseHandler.sendErrorResponse(res, StatusCodes.BAD_REQUEST, "Error storing deployment configuration");
        }
    }

    static async getContractsByType(req, res) {
        const { contract_type, network } = req.query;
        
        try {
            const query = {};
            if (contract_type) query.contract_type = contract_type;
            if (network) query.network = network;
            
            const contracts = await ContractModel.find(query).sort({ createdAt: -1 });
            return ResponseHandler.sendResponseWithData(res, StatusCodes.OK, "Contracts retrieved successfully", contracts);
        } catch (error) {
            console.error(error);
            return ResponseHandler.sendErrorResponse(res, StatusCodes.BAD_REQUEST, "Error retrieving contracts");
        }
    }
}

export default ContractService;
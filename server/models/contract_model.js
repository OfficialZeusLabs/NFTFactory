import mongoose from "mongoose";

const ContractSchema = new mongoose.Schema({
    owner_id: String,
    contract_address: String,
    contract_type: {
        type: String,
        enum: ['factory', 'subscription_nft', 'marketplace', 'collection', 'proxy', 'implementation'],
        default: 'collection'
    },
    network: {
        type: String,
        default: 'baseSepolia'
    },
    chain_id: {
        type: Number,
        default: 84532
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, { timestamps: true });

const ContractModel = mongoose.model("Contract", ContractSchema);
export default ContractModel;

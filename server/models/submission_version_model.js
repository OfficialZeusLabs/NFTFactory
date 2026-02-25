import mongoose from "mongoose";

/**
 * Submission Version Model
 * Tracks all changes to submissions for full audit history
 * No overwrites - every change creates a new version
 */

const SubmissionVersionSchema = new mongoose.Schema({
    // Reference
    submissionId: {
        type: String,
        required: true,
        index: true
    },
    
    // Version Info
    versionNumber: {
        type: Number,
        required: true
    },
    
    // Change Tracking
    changeType: {
        type: String,
        enum: ['INITIAL', 'UPDATE', 'RESUBMISSION', 'ADMIN_EDIT'],
        default: 'INITIAL'
    },
    
    // Fields that were updated in this version
    updatedFields: [{
        field: String,
        oldValue: mongoose.Schema.Types.Mixed,
        newValue: mongoose.Schema.Types.Mixed
    }],
    
    // Complete snapshot of submission at this version
    snapshot: {
        title: String,
        description: String,
        category: String,
        metadata: mongoose.Schema.Types.Mixed,
        images: [{
            cid: String,
            url: String,
            filename: String,
            uploadedAt: Date
        }],
        status: String,
        adminComments: [{
            adminId: String,
            message: String,
            createdAt: Date
        }]
    },
    
    // Media Changes
    uploadedImageCIDs: [{
        cid: String,
        action: {
            type: String,
            enum: ['ADDED', 'REMOVED', 'UNCHANGED']
        },
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    
    // Metadata
    createdBy: {
        type: String,
        required: true
    },
    createdByWallet: String,
    createdAt: {
        type: Date,
        default: Date.now
    },
    
    // Previous version reference
    previousVersionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SubmissionVersion'
    },
    
    // Resubmission context
    resubmissionReason: String,
    adminRequestedChanges: [{
        requestId: String,
        field: String,
        requestedChange: String,
        resolved: Boolean
    }]
    
}, { timestamps: true });

// Compound index for efficient version retrieval
SubmissionVersionSchema.index({ submissionId: 1, versionNumber: -1 });
SubmissionVersionSchema.index({ createdAt: -1 });

// Methods
SubmissionVersionSchema.methods.getDiff = function() {
    return this.updatedFields;
};

SubmissionVersionSchema.methods.compareWith = async function(otherVersionId) {
    const otherVersion = await this.model('SubmissionVersion').findById(otherVersionId);
    if (!otherVersion) return null;
    
    const diff = [];
    const fields = ['title', 'description', 'category', 'metadata'];
    
    fields.forEach(field => {
        if (JSON.stringify(this.snapshot[field]) !== JSON.stringify(otherVersion.snapshot[field])) {
            diff.push({
                field,
                current: this.snapshot[field],
                previous: otherVersion.snapshot[field]
            });
        }
    });
    
    return diff;
};

// Statics
SubmissionVersionSchema.statics.getVersionHistory = async function(submissionId) {
    return this.find({ submissionId })
        .sort({ versionNumber: -1 })
        .lean();
};

SubmissionVersionSchema.statics.getLatestVersion = async function(submissionId) {
    return this.findOne({ submissionId })
        .sort({ versionNumber: -1 })
        .lean();
};

SubmissionVersionSchema.statics.createNewVersion = async function(submissionId, changes, creator) {
    const latestVersion = await this.getLatestVersion(submissionId);
    const newVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;
    
    const version = new this({
        submissionId,
        versionNumber: newVersionNumber,
        changeType: newVersionNumber === 1 ? 'INITIAL' : 'UPDATE',
        updatedFields: changes.updatedFields || [],
        snapshot: changes.snapshot,
        uploadedImageCIDs: changes.uploadedImageCIDs || [],
        createdBy: creator.id,
        createdByWallet: creator.wallet,
        previousVersionId: latestVersion?._id,
        resubmissionReason: changes.resubmissionReason,
        adminRequestedChanges: changes.adminRequestedChanges || []
    });
    
    await version.save();
    return version;
};

const SubmissionVersionModel = mongoose.model("SubmissionVersion", SubmissionVersionSchema);
export default SubmissionVersionModel;

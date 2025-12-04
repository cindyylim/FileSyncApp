import mongoose from 'mongoose';

const fileChunkSchema = new mongoose.Schema({
    partNumber: {
        type: Number,
        required: true,
    },
    etag: {
        type: String,
        required: true,
    },
    size: {
        type: Number,
        required: true,
    },
    s3Key: {
        type: String,
        required: true,
    },
    fingerprint: {
        type: String, // SHA-256 hash of chunk content
    },
}, { _id: false });

const fileSchema = new mongoose.Schema({
    filename: {
        type: String,
        required: [true, 'Filename is required'],
        trim: true,
    },
    originalName: {
        type: String,
        required: true,
    },
    size: {
        type: Number,
        required: [true, 'File size is required'],
    },
    mimeType: {
        type: String,
        required: true,
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    path: {
        type: String,
        default: '/',
        index: true,
    },
    // S3-specific metadata
    s3Bucket: {
        type: String,
        required: true,
    },
    s3Key: {
        type: String,
        required: true,
        unique: true,
    },
    uploadId: {
        type: String, // For multipart uploads in progress
    },
    chunks: [fileChunkSchema],
    // File versioning
    version: {
        type: Number,
        default: 1,
    },
    isDeleted: {
        type: Boolean,
        default: false,
    },
    // Hashing for deduplication
    hash: {
        type: String, // SHA-256 hash of file content
        index: true,
    },
    // Compression metadata
    isCompressed: {
        type: Boolean,
        default: false,
    },
    originalSize: {
        type: Number, // Original uncompressed size (for display)
    },
    // Upload status
    uploadStatus: {
        type: String,
        enum: ['pending', 'uploading', 'completed', 'failed'],
        default: 'pending',
    },
}, {
    timestamps: true, // createdAt, updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});

// Compound index for efficient user file queries
fileSchema.index({ owner: 1, isDeleted: 1, createdAt: -1 });
fileSchema.index({ owner: 1, path: 1 });

/**
 * Get full S3 object key
 */
fileSchema.methods.getS3Key = function () {
    return this.s3Key;
};


const File = mongoose.model('File', fileSchema);

export default File;

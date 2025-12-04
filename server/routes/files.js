import express from 'express';
import {
    CreateMultipartUploadCommand,
    CompleteMultipartUploadCommand,
    AbortMultipartUploadCommand,
    DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { UploadPartCommand } from '@aws-sdk/client-s3';
import { s3Client, S3_CONFIG } from '../config/s3.js';
import { authenticateToken } from '../middleware/auth.js';
import File from '../models/File.js';
import User from '../models/User.js';
import crypto from 'crypto';

const router = express.Router();

/**
 * GET /api/files
 * List user's files with pagination
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const files = await File.find({
            owner: req.user._id,
            isDeleted: false,
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .select('-chunks'); // Don't return chunk details in list view

        const total = await File.countDocuments({
            owner: req.user._id,
            isDeleted: false,
        });

        res.json({
            files,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('List files error:', error);
        res.status(500).json({ error: 'Server error while fetching files' });
    }
});

/**
 * POST /api/files/init-upload
 * Initialize multipart upload to S3
 */
router.post('/init-upload', authenticateToken, async (req, res) => {
    try {
        const { filename, size, mimeType, path = '/', isCompressed = false, originalSize } = req.body;

        if (!filename || !size || !mimeType) {
            return res.status(400).json({
                error: 'Please provide filename, size, and mimeType'
            });
        }

        // Check storage quota
        const user = await User.findById(req.user._id);
        if (!user.hasStorageSpace(size)) {
            return res.status(403).json({
                error: 'Storage quota exceeded'
            });
        }

        // Generate unique S3 key
        const fileId = new mongoose.Types.ObjectId();
        const s3Key = `users/${req.user._id}/${fileId}/${filename}`;

        // Create multipart upload in S3
        const createCommand = new CreateMultipartUploadCommand({
            Bucket: S3_CONFIG.BUCKET_NAME,
            Key: s3Key,
            ContentType: mimeType,
            Metadata: {
                userId: req.user._id.toString(),
                originalName: filename,
            },
        });

        const multipartUpload = await s3Client.send(createCommand);

        // Create file document in MongoDB
        const file = new File({
            _id: fileId,
            filename,
            originalName: filename,
            size,
            mimeType,
            owner: req.user._id,
            path,
            s3Bucket: S3_CONFIG.BUCKET_NAME,
            s3Key,
            uploadId: multipartUpload.UploadId,
            uploadStatus: 'uploading',
            isCompressed,
            originalSize: isCompressed ? originalSize : size,
        });

        await file.save();

        res.status(201).json({
            fileId: file._id,
            uploadId: multipartUpload.UploadId,
            s3Key,
            chunkSize: S3_CONFIG.CHUNK_SIZE,
            message: 'Upload initialized successfully',
        });
    } catch (error) {
        console.error('Init upload error:', error);
        res.status(500).json({ error: 'Server error while initializing upload' });
    }
});

/**
 * POST /api/files/presigned-url
 * Get pre-signed URL for uploading a chunk
 */
router.post('/presigned-url', authenticateToken, async (req, res) => {
    try {
        const { fileId, partNumber, uploadId } = req.body;

        if (!fileId || !partNumber || !uploadId) {
            return res.status(400).json({
                error: 'Please provide fileId, partNumber, and uploadId'
            });
        }

        // Verify file belongs to user
        const file = await File.findOne({
            _id: fileId,
            owner: req.user._id,
            uploadId,
        });

        if (!file) {
            return res.status(404).json({ error: 'File not found or unauthorized' });
        }

        // Generate pre-signed URL for this part
        const command = new UploadPartCommand({
            Bucket: S3_CONFIG.BUCKET_NAME,
            Key: file.s3Key,
            UploadId: uploadId,
            PartNumber: partNumber,
        });

        const presignedUrl = await getSignedUrl(s3Client, command, {
            expiresIn: S3_CONFIG.PRESIGNED_URL_EXPIRY,
        });

        res.json({
            presignedUrl,
            partNumber,
        });
    } catch (error) {
        console.error('Presigned URL error:', error);
        res.status(500).json({ error: 'Server error while generating presigned URL' });
    }
});

/**
 * POST /api/files/complete-upload
 * Complete multipart upload
 */
router.post('/complete-upload', authenticateToken, async (req, res) => {
    try {
        const { fileId, uploadId, parts, hash } = req.body;

        if (!fileId || !uploadId || !parts || !Array.isArray(parts)) {
            return res.status(400).json({
                error: 'Please provide fileId, uploadId, and parts array'
            });
        }

        // Verify file belongs to user
        const file = await File.findOne({
            _id: fileId,
            owner: req.user._id,
            uploadId,
        });

        if (!file) {
            return res.status(404).json({ error: 'File not found or unauthorized' });
        }

        // Complete multipart upload in S3
        const completeCommand = new CompleteMultipartUploadCommand({
            Bucket: S3_CONFIG.BUCKET_NAME,
            Key: file.s3Key,
            UploadId: uploadId,
            MultipartUpload: {
                Parts: parts.map(part => ({
                    ETag: part.etag,
                    PartNumber: part.partNumber,
                })),
            },
        });

        await s3Client.send(completeCommand);

        // Update file document
        file.chunks = parts.map(part => ({
            partNumber: part.partNumber,
            etag: part.etag,
            size: part.size || 0,
            s3Key: file.s3Key,
            fingerprint: part.fingerprint, // Store chunk fingerprint
        }));
        file.uploadStatus = 'completed';
        file.uploadId = undefined; // Clear upload ID
        file.hash = hash;

        await file.save(); // This will trigger CDC event!

        await User.findByIdAndUpdate(
            req.user._id,
            { $inc: { storageUsed: file.size } },
            { new: true } // returns the updated document
        );

        res.json({
            message: 'Upload completed successfully',
            file: {
                id: file._id,
                filename: file.filename,
                size: file.size,
                mimeType: file.mimeType,
                createdAt: file.createdAt,
            },
            user: {
                storageUsed: req.user.storageUsed,
                storageQuota: req.user.storageQuota,
            },
        });
    } catch (error) {
        console.error('Complete upload error:', error);

        // Try to abort the multipart upload on error
        try {
            const abortCommand = new AbortMultipartUploadCommand({
                Bucket: S3_CONFIG.BUCKET_NAME,
                Key: file.s3Key,
                UploadId: uploadId,
            });
            await s3Client.send(abortCommand);
        } catch (abortError) {
            console.error('Abort upload error:', abortError);
        }

        res.status(500).json({ error: 'Server error while completing upload' });
    }
});

/**
 * GET /api/files/:id/upload-status
 * Get upload status for resumable uploads
 */
router.get('/:id/upload-status', authenticateToken, async (req, res) => {
    try {
        const file = await File.findOne({
            _id: req.params.id,
            owner: req.user._id,
        });

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Return upload status and uploaded chunks
        res.json({
            uploadStatus: file.uploadStatus,
            uploadId: file.uploadId,
            uploadedChunks: file.chunks.map(chunk => ({
                partNumber: chunk.partNumber,
                fingerprint: chunk.fingerprint,
                etag: chunk.etag,
                size: chunk.size,
            })),
        });
    } catch (error) {
        console.error('Get upload status error:', error);
        res.status(500).json({ error: 'Server error while fetching upload status' });
    }
});

/**
 * GET /api/files/:id
 * Get file metadata
 */
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const file = await File.findOne({
            _id: req.params.id,
            owner: req.user._id,
            isDeleted: false,
        });

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        res.json({ file });
    } catch (error) {
        console.error('Get file error:', error);
        res.status(500).json({ error: 'Server error while fetching file' });
    }
});

/**
 * GET /api/files/:id/download
 * Get pre-signed URL for downloading file
 */
router.get('/:id/download', authenticateToken, async (req, res) => {
    try {
        const file = await File.findOne({
            _id: req.params.id,
            owner: req.user._id,
            isDeleted: false,
            uploadStatus: 'completed',
        });

        if (!file) {
            return res.status(404).json({ error: 'File not found or not ready' });
        }

        // Generate pre-signed URL for download
        const command = new GetObjectCommand({
            Bucket: S3_CONFIG.BUCKET_NAME,
            Key: file.s3Key,
            ResponseContentDisposition: `attachment; filename="${file.originalName}"`,
        });

        const presignedUrl = await getSignedUrl(s3Client, command, {
            expiresIn: S3_CONFIG.PRESIGNED_URL_EXPIRY,
        });

        res.json({
            downloadUrl: presignedUrl,
            filename: file.originalName,
            expiresIn: S3_CONFIG.PRESIGNED_URL_EXPIRY,
        });
    } catch (error) {
        console.error('Download file error:', error);
        res.status(500).json({ error: 'Server error while generating download URL' });
    }
});

/**
 * DELETE /api/files/:id
 * Delete file
 */
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const file = await File.findOne({
            _id: req.params.id,
            owner: req.user._id,
            isDeleted: false,
        });

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Delete from S3
        if (file.uploadStatus === 'completed') {
            const deleteCommand = new DeleteObjectCommand({
                Bucket: S3_CONFIG.BUCKET_NAME,
                Key: file.s3Key,
            });
            await s3Client.send(deleteCommand);
        }

        // Delete from MongoDB
        await File.findByIdAndDelete(req.params.id);
        await User.findByIdAndUpdate(
            req.user._id,
            { $inc: { storageUsed: -file.size } },
            { new: true } // returns the updated document
        );

        res.json({
            message: 'File deleted successfully',
            user: {
                storageUsed: req.user.storageUsed,
                storageQuota: req.user.storageQuota,
            },
        });
    } catch (error) {
        console.error('Delete file error:', error);
        res.status(500).json({ error: 'Server error while deleting file' });
    }
});

// Fix import for GetObjectCommand
import { GetObjectCommand } from '@aws-sdk/client-s3';
import mongoose from 'mongoose';

export default router;

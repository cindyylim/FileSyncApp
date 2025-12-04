import { S3Client } from '@aws-sdk/client-s3';
/**
 * Initialize AWS S3 Client
 */
export const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

/**
 * S3 configuration constants
 */
export const S3_CONFIG = {
    BUCKET_NAME: process.env.S3_BUCKET_NAME,
    CHUNK_SIZE: 5 * 1024 * 1024, // 5MB minimum for S3 multipart
    MAX_FILE_SIZE: 5 * 1024 * 1024 * 1024, // 5GB max
    PRESIGNED_URL_EXPIRY: 3600, // 1 hour in seconds
};


import crypto from 'crypto-js';

/**
 * Chunk size for S3 multipart upload (5MB minimum)
 */
export const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Split file into chunks
 */
export const chunkFile = (file) => {
    const chunks = [];
    let start = 0;

    while (start < file.size) {
        const end = Math.min(start + CHUNK_SIZE, file.size);
        chunks.push(file.slice(start, end));
        start = end;
    }

    return chunks;
};

/**
 * Calculate SHA-256 hash of file
 */
export const calculateFileHash = async (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            const wordArray = crypto.lib.WordArray.create(e.target.result);
            const hash = crypto.SHA256(wordArray).toString();
            resolve(hash);
        };

        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
};

/**
 * Calculate SHA-256 hash of a chunk (Blob)
 */
export const calculateChunkHash = async (chunk) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            const wordArray = crypto.lib.WordArray.create(e.target.result);
            const hash = crypto.SHA256(wordArray).toString();
            resolve(hash);
        };

        reader.onerror = reject;
        reader.readAsArrayBuffer(chunk);
    });
};

/**
 * Format file size for display
 */
export const formatFileSize = (bytes) => {
    if (bytes === undefined || bytes === null || isNaN(bytes)) return '0 Bytes';
    if (bytes <= 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Get file icon based on MIME type
 */
export const getFileIcon = (mimeType) => {
    if (!mimeType) return '📄';

    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.startsWith('video/')) return '🎥';
    if (mimeType.startsWith('audio/')) return '🎵';
    if (mimeType.includes('pdf')) return '📕';
    if (mimeType.includes('zip') || mimeType.includes('archive')) return '🗜️';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return '📊';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📽️';
    if (mimeType.includes('text')) return '📄';

    return '📎';
};

/**
 * Get file extension
 */
export const getFileExtension = (filename) => {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop().toUpperCase() : '';
};

/**
 * Format date for display
 */
export const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
};

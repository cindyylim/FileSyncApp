import React from 'react';
import useAuthStore from '../../stores/authStore';
import { fileAPI } from '../../services/api';
import { formatFileSize, formatDate, getFileIcon, getFileExtension } from '../../utils/fileUtils';
import pako from 'pako';
import './FileList.css';

function FileList({ files, onFileDeleted }) {
    const { user, setUser } = useAuthStore();
    const [deleting, setDeleting] = React.useState(null);

    const handleDownload = async (file) => {
        try {
            const fileId = file.id || file._id;
            const response = await fileAPI.download(fileId);
            const { downloadUrl } = response.data;

            // Fetch file from S3
            const fileResponse = await fetch(downloadUrl);
            const blob = await fileResponse.blob();

            // Decompress if needed
            let finalBlob = blob;
            if (file.isCompressed) {
                const arrayBuffer = await blob.arrayBuffer();
                const decompressed = pako.ungzip(new Uint8Array(arrayBuffer));
                finalBlob = new Blob([decompressed], { type: file.mimeType });
            }

            // Download the file
            const url = window.URL.createObjectURL(finalBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Download error:', error);
            alert('Failed to download file');
        }
    };

    const handleDelete = async (file) => {
        if (!confirm(`Are you sure you want to delete "${file.filename}"?`)) {
            return;
        }

        const fileId = file.id || file._id;
        setDeleting(fileId);

        try {
            const response = await fileAPI.delete(fileId);

            // Update user storage in store if provided
            if (response.data.user) {
                if (user) {
                    setUser({
                        ...user,
                        storageUsed: response.data.user.storageUsed,
                        storageQuota: response.data.user.storageQuota
                    });
                }
            }

            if (onFileDeleted) {
                onFileDeleted(fileId);
            }
        } catch (error) {
            console.error('Delete error:', error);
            alert('Failed to delete file');
        } finally {
            setDeleting(null);
        }
    };

    if (!files || files.length === 0) {
        return (
            <div className="file-list-empty glass-card">
                <div className="empty-icon">📭</div>
                <p className="empty-text">No files yet</p>
                <p className="empty-subtext">Upload your first file to get started</p>
            </div>
        );
    }

    return (
        <div className="file-list">
            {files.map((file) => (
                <div key={file.id || file._id} className="file-item glass-card fade-in">
                    <div className="file-icon">
                        {getFileIcon(file.mimeType)}
                        {getFileExtension(file.filename) && (
                            <span className="file-extension">{getFileExtension(file.filename)}</span>
                        )}
                    </div>

                    <div className="file-info">
                        <div className="file-name">{file.filename}</div>
                        <div className="file-meta">
                            <span>{formatFileSize(file.size)}</span>
                            <span>•</span>
                            <span>{formatDate(file.createdAt)}</span>
                        </div>
                    </div>

                    <div className="file-actions">
                        <button
                            className="btn-icon"
                            onClick={() => handleDownload(file)}
                            title="Download"
                        >
                            ⬇️
                        </button>
                        <button
                            className="btn-icon btn-icon-danger"
                            onClick={() => handleDelete(file)}
                            disabled={deleting === file.id}
                            title="Delete"
                        >
                            {deleting === file.id ? '⏳' : '🗑️'}
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}

export default FileList;

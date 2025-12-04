import React, { useState, useEffect } from 'react';
import useAuthStore from '../stores/authStore';
import FileList from '../components/FileManager/FileList';
import FileUpload from '../components/FileManager/FileUpload';
import SyncIndicator from '../components/FileManager/SyncIndicator';
import { fileAPI } from '../services/api';
import { onFileChange, offFileChange } from '../services/syncService';
import { formatFileSize } from '../utils/fileUtils';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

function Dashboard() {
    const navigate = useNavigate();
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user, logout } = useAuthStore();
    const [lastSync, setLastSync] = useState(null);

    // Load files
    const loadFiles = async () => {
        try {
            const response = await fileAPI.list();
            console.log(response.data.files);
            setFiles(response.data.files);
        } catch (error) {
            console.error('Error loading files:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFiles();
    }, []);

    // Listen for CDC file changes
    useEffect(() => {
        const handleFileChange = (data) => {
            console.log('File change received:', data);
            setLastSync(new Date());

            if (data.type === 'insert' && data.file.uploadStatus === 'completed') {
                // New file uploaded
                setFiles((prev) => [data.file, ...prev]);
            } else if (data.type === 'update') {
                // File updated
                setFiles((prev) =>
                    prev.map((f) => ((f.id || f._id) === (data.file.id || data.file._id) ? { ...f, ...data.file } : f))
                );
            } else if (data.type === 'delete' || data.file.isDeleted) {
                // File deleted
                setFiles((prev) => prev.filter((f) => (f.id || f._id) !== (data.file.id || data.file._id)));
            }
        };

        onFileChange(handleFileChange);

        return () => {
            offFileChange();
        };
    }, []);

    const handleLogout = async () => {
        try {
            await authAPI.logout();
            logout();
            navigate('/login');
        } catch (error) {
            console.error('Logout error:', error);
            // Force logout on error
            logout();
            navigate('/login');
        }
    };

    const handleFileDeleted = (fileId) => {
        setFiles((prev) => prev.filter((f) => f.id !== fileId));
    };

    const handleUploadComplete = () => {
        // Reload files after upload
        loadFiles();
    };

    return (
        <div className="dashboard">
            <header className="dashboard-header glass-card">
                <div className="header-left">
                    <h1 className="logo">☁️ File Sync App</h1>
                    <SyncIndicator lastSync={lastSync} />
                </div>


                <div className="header-right">
                    {user && (
                        <div className="user-info">
                            <div className="user-avatar">{user.username[0].toUpperCase()}</div>
                            <div className="user-details">
                                <div className="user-name">{user.username}</div>
                                <div className="user-storage">
                                    {formatFileSize(user.storageUsed || 0)} / {formatFileSize(user.storageQuota || 5 * 1024 * 1024 * 1024)}
                                </div>
                            </div>
                        </div>
                    )}
                    <button className="btn btn-secondary" onClick={handleLogout}>
                        Logout
                    </button>
                </div>
            </header>

            <main className="dashboard-content">
                <div className="content-header">
                    <div>
                        <h2>My Files</h2>
                        <p className="content-subtitle">
                            {files.length} {files.length === 1 ? 'file' : 'files'}
                        </p>
                    </div>
                </div>

                <FileUpload onUploadComplete={handleUploadComplete} />

                {loading ? (
                    <div className="loading-container">
                        <div className="spinner" />
                        <p>Loading files...</p>
                    </div>
                ) : (
                    <FileList files={files} onFileDeleted={handleFileDeleted} />
                )}
            </main>
        </div >
    );
}

export default Dashboard;

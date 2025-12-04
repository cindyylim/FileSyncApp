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
    const [sharedFiles, setSharedFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingShared, setLoadingShared] = useState(false);
    const [activeTab, setActiveTab] = useState('my-files');
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

    // Load shared files
    const loadSharedFiles = async () => {
        setLoadingShared(true);
        try {
            const response = await fileAPI.getShared();
            console.log(response.data.files);
            setSharedFiles(response.data.files);
        } catch (error) {
            console.error('Error loading shared files:', error);
        } finally {
            setLoadingShared(false);
        }
    };

    useEffect(() => {
        loadFiles();
        if (activeTab === 'shared-files') {
            loadSharedFiles();
        }
    }, [activeTab]);

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
        setFiles((prev) => prev.filter((f) => (f.id || f._id) !== fileId));
        setSharedFiles((prev) => prev.filter((f) => (f.id || f._id) !== fileId));
    };

    const handleUploadComplete = () => {
        // Reload files after upload
        loadFiles();
    };

    const currentFiles = activeTab === 'my-files' ? files : sharedFiles;
    const currentLoading = activeTab === 'my-files' ? loading : loadingShared;
    const currentFileCount = currentFiles.length;

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
                    <div className="tabs">
                        <button
                            className={`tab-button ${activeTab === 'my-files' ? 'active' : ''}`}
                            onClick={() => setActiveTab('my-files')}
                        >
                            My Files
                        </button>
                        <button
                            className={`tab-button ${activeTab === 'shared-files' ? 'active' : ''}`}
                            onClick={() => setActiveTab('shared-files')}
                        >
                            Shared with Me
                        </button>
                    </div>
                    <div>
                        <h2>{activeTab === 'my-files' ? 'My Files' : 'Shared with Me'}</h2>
                        <p className="content-subtitle">
                            {currentFileCount} {currentFileCount === 1 ? 'file' : 'files'}
                        </p>
                    </div>
                </div>

                {activeTab === 'my-files' && <FileUpload onUploadComplete={handleUploadComplete} />}

                {currentLoading ? (
                    <div className="loading-container">
                        <div className="spinner" />
                        <p>Loading {activeTab === 'my-files' ? 'files' : 'shared files'}...</p>
                    </div>
                ) : (
                    <FileList
                        files={currentFiles}
                        onFileDeleted={handleFileDeleted}
                        showOwner={activeTab === 'shared-files'}
                    />
                )}
            </main>
        </div >
    );
}

export default Dashboard;

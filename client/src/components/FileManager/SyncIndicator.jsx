import React, { useEffect } from 'react';
import { getSocket } from '../../services/syncService';
import './SyncIndicator.css';

function SyncIndicator({ lastSync }) {
    const [status, setStatus] = React.useState('disconnected');

    useEffect(() => {
        const socket = getSocket();

        if (!socket) {
            setStatus('disconnected');
            return;
        }

        const handleConnect = () => setStatus('connected');
        const handleDisconnect = () => setStatus('disconnected');
        const handleReconnecting = () => setStatus('reconnecting');

        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        socket.on('reconnecting', handleReconnecting);

        // Set initial status
        setStatus(socket.connected ? 'connected' : 'disconnected');

        return () => {
            socket.off('connect', handleConnect);
            socket.off('disconnect', handleDisconnect);
            socket.off('reconnecting', handleReconnecting);
        };
    }, []);

    const getStatusInfo = () => {
        switch (status) {
            case 'connected':
                return { icon: '🟢', text: 'Synced', color: 'var(--color-success)' };
            case 'reconnecting':
                return { icon: '🟡', text: 'Reconnecting...', color: 'var(--color-warning)' };
            case 'disconnected':
                return { icon: '🔴', text: 'Offline', color: 'var(--color-error)' };
            default:
                return { icon: '⚫', text: 'Unknown', color: 'var(--color-text-tertiary)' };
        }
    };

    const statusInfo = getStatusInfo();

    return (
        <div className="sync-indicator">
            <div className="sync-status" style={{ color: statusInfo.color }}>
                <span className="sync-icon">{statusInfo.icon}</span>
                <span className="sync-text">{statusInfo.text}</span>
            </div>
            {lastSync && status === 'connected' && (
                <div className="last-sync">
                    Last synced: {new Date(lastSync).toLocaleTimeString()}
                </div>
            )}
        </div>
    );
}

export default SyncIndicator;

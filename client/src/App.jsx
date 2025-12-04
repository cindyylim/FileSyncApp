import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import Dashboard from './pages/Dashboard';
import { initSocket, disconnectSocket } from './services/syncService';
import useAuthStore from './stores/authStore';

function App() {
    const { isAuthenticated, checkAuth, loading } = useAuthStore();

    useEffect(() => {
        checkAuth();
    }, []);

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    // Protected Route wrapper
    const ProtectedRoute = ({ children }) => {
        return isAuthenticated() ? children : <Navigate to="/login" />;
    };
    return (
        <Router>
            <Routes>
                <Route
                    path="/"
                    element={
                        isAuthenticated() ? (
                            <Navigate to="/dashboard" />
                        ) : (
                            <Navigate to="/login" />
                        )
                    }
                />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute>
                            <Dashboard />
                        </ProtectedRoute>
                    }
                />
            </Routes>
        </Router>
    );
}

export default App;

import React, { useState } from 'react';
import useAuthStore from '../../stores/authStore';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../../services/api';
import { initSocket } from '../../services/syncService';
import './Auth.css';

function Register() {
    const navigate = useNavigate();
    const setUser = useAuthStore((state) => state.setUser);
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Validate passwords match
        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);

        try {
            const { confirmPassword, ...registerData } = formData;
            const response = await authAPI.register(registerData);
            const { user } = response.data;

            // Store user in store
            setUser(user);

            // Initialize socket connection
            initSocket();

            // Redirect to dashboard
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.error || 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card glass-card fade-in">
                <div className="auth-header">
                    <h1>Create Account</h1>
                    <p>Start storing and syncing your files</p>
                </div>

                {error && (
                    <div className="error-message slide-up">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="username" className="form-label">Username</label>
                        <input
                            type="text"
                            id="username"
                            name="username"
                            className="input"
                            placeholder="johndoe"
                            value={formData.username}
                            onChange={handleChange}
                            required
                            minLength={3}
                            maxLength={30}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="email" className="form-label">Email</label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            className="input"
                            placeholder="you@example.com"
                            value={formData.email}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password" className="form-label">Password</label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            className="input"
                            placeholder="••••••••"
                            value={formData.password}
                            onChange={handleChange}
                            required
                            minLength={6}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmPassword" className="form-label">Confirm Password</label>
                        <input
                            type="password"
                            id="confirmPassword"
                            name="confirmPassword"
                            className="input"
                            placeholder="••••••••"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            required
                            minLength={6}
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary btn-full"
                        disabled={loading}
                    >
                        {loading ? 'Creating account...' : 'Sign Up'}
                    </button>
                </form>

                <div className="auth-footer">
                    <p>
                        Already have an account?{' '}
                        <Link to="/login" className="auth-link">
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default Register;

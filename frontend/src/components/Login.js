import React, { useState } from 'react';
import api from '../api';
import '../styles/Auth.css';
import {
  Compass,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  KeyRound
} from 'lucide-react';

function Login({ onLoginSuccess, onSwitchToRegister }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = password || '';

    if (!cleanEmail || !cleanPassword) {
      setError('Please provide both email and password.');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/api/auth/login', {
        email: cleanEmail,
        password: cleanPassword
      });

      if (response.data.success) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        onLoginSuccess(response.data.user, response.data.token);
      }
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        (err.message ? err.message : 'Invalid email or password. Please try again.');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const fillDemoAccount = () => {
    setEmail('ravi@example.com');
    setPassword('password123');
    setError('');
  };

  return (
    <div className="auth-page-wrapper">
      <div className="auth-split-card">
        {/* Left Hero Panel */}
        <div className="auth-hero-panel">
          <div className="auth-brand-header">
            <div className="brand-logo-wrap">
              <Compass size={24} color="#ffffff" />
            </div>
            <h1>VISTA Travel</h1>
          </div>

          <div className="auth-hero-middle">
            <h2>Plan Trips with Real-World Costs</h2>
            <p>Generate intelligent travel plans with dynamic fuel and toll calculations, real-world hotel benchmarks, and optimized route itineraries.</p>
            <ul className="auth-perks-list">
              <li>
                <CheckCircle2 size={16} />
                <span>Personalized itineraries for solo, friends, and family trips</span>
              </li>
              <li>
                <CheckCircle2 size={16} />
                <span>Real-world location-based fuel, toll & stay cost calculations</span>
              </li>
              <li>
                <CheckCircle2 size={16} />
                <span>Interactive map routing & weather-fit activities</span>
              </li>
            </ul>
          </div>

          <div className="auth-quote-box">
            <p>Calculations reference official NHAI FASTag rates, current state fuel tariffs, and verified hotel benchmarks.</p>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="auth-form-panel">
          <div className="auth-form-header">
            <span className="eyebrow-badge">
              <Sparkles size={12} />
              Welcome Back
            </span>
            <h3>Log In to Your Account</h3>
            <p>Access your saved itineraries and plan new adventures.</p>
          </div>

          {error && (
            <div className="error-alert" style={{ marginBottom: '18px' }}>
              <AlertCircle size={18} className="error-alert-icon" />
              <div className="error-alert-content">
                <p>{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label>Email Address</label>
              <div className="input-with-icon">
                <Mail size={16} className="input-icon" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="student@university.edu"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Password</label>
              <div className="password-input-wrap input-with-icon">
                <Lock size={16} className="input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={loading} style={{ minHeight: '48px', fontSize: '15px' }}>
              <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
              <ArrowRight size={16} />
            </button>

            <button
              type="button"
              onClick={fillDemoAccount}
              style={{
                background: 'transparent',
                border: '1px dashed #cbd5e1',
                borderRadius: '8px',
                padding: '8px 12px',
                color: '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '13px',
                marginTop: '10px'
              }}
            >
              <KeyRound size={14} />
              <span>Fill Demo Credentials (ravi@example.com)</span>
            </button>
          </form>

          <p className="auth-switch-prompt">
            Don't have an account yet?{' '}
            <button type="button" onClick={onSwitchToRegister} className="auth-switch-link">
              Create free account
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;

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
  ShieldCheck,
  CheckCircle2,
  AlertCircle
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
    setLoading(true);

    try {
      const response = await api.post('/api/auth/login', {
        email,
        password
      });

      if (response.data.success) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        onLoginSuccess(response.data.user, response.data.token);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
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
            <h2>Plan Student Trips Without the Guesswork</h2>
            <p>Generate smart, budget-conscious travel plans with intelligent weather routing, transport optimization, and real student discounts.</p>
            <ul className="auth-perks-list">
              <li>
                <CheckCircle2 size={16} />
                <span>Personalized itineraries for solo & group trips</span>
              </li>
              <li>
                <CheckCircle2 size={16} />
                <span>Automatic student discounts on transit & stays</span>
              </li>
              <li>
                <CheckCircle2 size={16} />
                <span>Interactive map routing & weather-fit activities</span>
              </li>
            </ul>
          </div>

          <div className="auth-quote-box">
            <p>"VISTA makes budget planning so straightforward. Saved ₹4,000 on my Goa roadtrip!"</p>
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
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={loading} style={{ minHeight: '48px', fontSize: '15px' }}>
              <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
              <ArrowRight size={16} />
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

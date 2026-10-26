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

  // Password Recovery States
  const [viewMode, setViewMode] = useState('login'); // 'login' | 'forgot' | 'verify-otp' | 'new-password'
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [infoMessage, setInfoMessage] = useState('');

  const resetAllStates = () => {
    setError('');
    setInfoMessage('');
    setLoading(false);
  };

  const handleSwitchMode = (mode) => {
    resetAllStates();
    setViewMode(mode);
  };

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

  const handleForgotPasswordRequest = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');

    const cleanEmail = (resetEmail || email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid registered email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/api/auth/forgot-password', { email: cleanEmail });
      setResetEmail(cleanEmail);
      setInfoMessage(res.data?.message || 'If an account exists with this email, a 6-digit verification code has been dispatched.');
      setViewMode('verify-otp');
      setResendCooldown(30);
      const timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to request password reset. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyResetOtp = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');

    const cleanOtp = (resetOtp || '').trim();
    if (!cleanOtp || cleanOtp.length < 6) {
      setError('Please enter the 6-digit verification code from your email.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/api/auth/verify-reset-otp', {
        email: resetEmail,
        otp: cleanOtp
      });

      if (res.data.success && res.data.resetToken) {
        setResetToken(res.data.resetToken);
        setInfoMessage('Code verified successfully. Please enter your new password.');
        setViewMode('new-password');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid or expired verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');

    if (!newPassword || newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match. Please verify your new password.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/api/auth/reset-password', {
        email: resetEmail,
        resetToken,
        newPassword,
        confirmPassword: confirmNewPassword
      });

      if (res.data.success) {
        setInfoMessage('Your password has been changed successfully. You can now log in.');
        setEmail(resetEmail);
        setPassword('');
        setViewMode('login');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update password. Your reset session may have expired.');
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
        {viewMode === 'forgot' ? (
          <div className="auth-form-panel">
            <div className="auth-form-header">
              <span className="eyebrow-badge">
                <Lock size={12} />
                Password Recovery
              </span>
              <h3>Reset Your Password</h3>
              <p>Enter your registered email address and we'll send a 6-digit verification code.</p>
            </div>

            {error && (
              <div className="error-alert" style={{ marginBottom: '18px' }}>
                <AlertCircle size={18} className="error-alert-icon" />
                <div className="error-alert-content">
                  <p>{error}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleForgotPasswordRequest} className="auth-form">
              <div className="form-group">
                <label>Registered Email Address</label>
                <div className="input-with-icon">
                  <Mail size={16} className="input-icon" />
                  <input
                    id="forgot-password-email-input"
                    type="email"
                    value={resetEmail || email}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    placeholder="student@university.edu"
                    autoFocus
                  />
                </div>
              </div>

              <button
                id="forgot-password-submit-btn"
                type="submit"
                className="btn-primary"
                disabled={loading}
                style={{ minHeight: '48px', fontSize: '15px' }}
              >
                <span>{loading ? 'Sending Code...' : 'Send Verification Code'}</span>
                <ArrowRight size={16} />
              </button>

              <div style={{ textAlign: 'center', marginTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => handleSwitchMode('login')}
                  className="btn-secondary-link"
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          </div>
        ) : viewMode === 'verify-otp' ? (
          <div className="auth-form-panel">
            <div className="auth-form-header">
              <span className="eyebrow-badge">
                <Mail size={12} />
                Step 2 of 3
              </span>
              <h3>Enter Verification Code</h3>
              <p>We sent a 6-digit code to <strong>{resetEmail}</strong>. Code expires in 10 minutes.</p>
            </div>

            {infoMessage && (
              <div className="auth-notice-card info">
                <Sparkles size={16} />
                <div>{infoMessage}</div>
              </div>
            )}

            {error && (
              <div className="error-alert" style={{ marginBottom: '18px' }}>
                <AlertCircle size={18} className="error-alert-icon" />
                <div className="error-alert-content">
                  <p>{error}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleVerifyResetOtp} className="auth-form">
              <div className="form-group" style={{ textAlign: 'center' }}>
                <label style={{ display: 'block', marginBottom: '8px' }}>6-Digit OTP Code</label>
                <div className="otp-input-wrap">
                  <input
                    id="reset-otp-input"
                    type="text"
                    className="otp-input-field"
                    value={resetOtp}
                    onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="••••••"
                    maxLength={6}
                    autoFocus
                    required
                  />
                </div>
              </div>

              <button
                id="verify-reset-otp-btn"
                type="submit"
                className="btn-primary"
                disabled={loading || resetOtp.length < 6}
                style={{ minHeight: '48px', fontSize: '15px' }}
              >
                <span>{loading ? 'Verifying...' : 'Verify Code'}</span>
                <ArrowRight size={16} />
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={handleForgotPasswordRequest}
                  disabled={resendCooldown > 0}
                  className="btn-secondary-link"
                >
                  {resendCooldown > 0 ? `Resend Code in ${resendCooldown}s` : 'Resend Code'}
                </button>

                <button
                  type="button"
                  onClick={() => handleSwitchMode('login')}
                  className="btn-secondary-link"
                  style={{ color: '#64748b' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        ) : viewMode === 'new-password' ? (
          <div className="auth-form-panel">
            <div className="auth-form-header">
              <span className="eyebrow-badge">
                <Lock size={12} />
                Step 3 of 3
              </span>
              <h3>Create New Password</h3>
              <p>Choose a secure password with at least 8 characters.</p>
            </div>

            {error && (
              <div className="error-alert" style={{ marginBottom: '18px' }}>
                <AlertCircle size={18} className="error-alert-icon" />
                <div className="error-alert-content">
                  <p>{error}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleResetPasswordSubmit} className="auth-form">
              <div className="form-group">
                <label>New Password</label>
                <div className="password-input-wrap input-with-icon">
                  <Lock size={16} className="input-icon" />
                  <input
                    id="reset-new-password-input"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    placeholder="Minimum 8 characters"
                    autoFocus
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Confirm New Password</label>
                <div className="password-input-wrap input-with-icon">
                  <Lock size={16} className="input-icon" />
                  <input
                    id="reset-confirm-password-input"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    required
                    placeholder="Re-enter new password"
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

              <button
                id="reset-password-save-btn"
                type="submit"
                className="btn-primary"
                disabled={loading}
                style={{ minHeight: '48px', fontSize: '15px' }}
              >
                <span>{loading ? 'Updating Password...' : 'Save Password & Sign In'}</span>
                <ArrowRight size={16} />
              </button>

              <div style={{ textAlign: 'center', marginTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => handleSwitchMode('login')}
                  className="btn-secondary-link"
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="auth-form-panel">
            <div className="auth-form-header">
              <span className="eyebrow-badge">
                <Sparkles size={12} />
                Welcome Back
              </span>
              <h3>Log In to Your Account</h3>
              <p>Access your saved itineraries and plan new adventures.</p>
            </div>

            {infoMessage && (
              <div className="auth-notice-card success">
                <CheckCircle2 size={16} />
                <div>{infoMessage}</div>
              </div>
            )}

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
                    id="login-email-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="student@university.edu"
                  />
                </div>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ margin: 0 }}>Password</label>
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('forgot')}
                    className="forgot-password-link"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="password-input-wrap input-with-icon">
                  <Lock size={16} className="input-icon" />
                  <input
                    id="login-password-input"
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

              <button id="login-submit-btn" type="submit" className="btn-primary" disabled={loading} style={{ minHeight: '48px', fontSize: '15px' }}>
                <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
                <ArrowRight size={16} />
              </button>

              <button
                id="demo-login-btn"
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
              <button id="switch-to-register-btn" type="button" onClick={onSwitchToRegister} className="auth-switch-link">
                Create free account
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Login;

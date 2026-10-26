import React, { useState } from 'react';
import api from '../api';
import '../styles/Auth.css';
import {
  Compass,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

function Register({ onRegisterSuccess, onSwitchToLogin }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    companionType: 'solo'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [verificationPending, setVerificationPending] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [infoMessage, setInfoMessage] = useState('');
  const [pendingAuthData, setPendingAuthData] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleResendVerification = async () => {
    if (resendCooldown > 0 || !verificationEmail) return;
    setError('');
    setInfoMessage('');
    try {
      const res = await api.post('/api/auth/resend-verification', { email: verificationEmail });
      setInfoMessage(res.data?.message || 'A fresh 6-digit verification code has been dispatched to your email.');
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
      setError(err.response?.data?.error || 'Unable to resend verification code. Please wait a moment.');
    }
  };

  const handleVerifyEmail = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');

    const cleanCode = (verificationCode || '').trim();
    if (!cleanCode || cleanCode.length < 6) {
      setError('Please enter the 6-digit verification code sent to your email.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/api/auth/verify-email', {
        email: verificationEmail,
        code: cleanCode
      });

      if (res.data.success) {
        const authToken = res.data.token || pendingAuthData?.token;
        const authUser = res.data.user || pendingAuthData?.user;
        if (authToken) {
          localStorage.setItem('token', authToken);
        }
        if (authUser) {
          localStorage.setItem('user', JSON.stringify(authUser));
        }
        onRegisterSuccess(authUser, authToken);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid or expired verification code. Please check your email.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');

    const cleanName = (formData.name || '').trim();
    const cleanEmail = (formData.email || '').trim().toLowerCase();
    const cleanPassword = formData.password || '';
    const cleanConfirm = formData.confirmPassword || '';

    if (!cleanName || !cleanEmail || !cleanPassword) {
      setError('Please fill in all required fields (Name, Email, Password).');
      return;
    }

    if (cleanPassword !== cleanConfirm) {
      setError('Passwords do not match. Please verify your passwords.');
      return;
    }

    if (cleanPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/api/auth/register', {
        name: cleanName,
        email: cleanEmail,
        password: cleanPassword,
        passwordConfirm: cleanConfirm,
        confirmPassword: cleanConfirm,
        travelCompanionType: formData.companionType || 'solo'
      });

      if (response.data.success) {
        if (response.data.requireVerification) {
          setVerificationEmail(cleanEmail);
          setPendingAuthData({
            token: response.data.token,
            user: response.data.user
          });
          setVerificationPending(true);
          setInfoMessage('We sent a 6-digit verification code to your email. Please enter it below.');
        } else {
          localStorage.setItem('token', response.data.token);
          localStorage.setItem('user', JSON.stringify(response.data.user));
          onRegisterSuccess(response.data.user, response.data.token);
        }
      }
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        (err.message ? err.message : 'Registration failed. Please try again.');
      setError(msg);
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
            <h2>Create Your Travel Account</h2>
            <p>Save your itineraries, synchronize custom routes across devices, and manage rental reservations.</p>
            <ul className="auth-perks-list">
              <li>
                <CheckCircle2 size={16} />
                <span>Save and organize custom itineraries</span>
              </li>
              <li>
                <CheckCircle2 size={16} />
                <span>Export directly to PDF and calendar</span>
              </li>
              <li>
                <CheckCircle2 size={16} />
                <span>Weather suitability and route feasibility checks</span>
              </li>
            </ul>
          </div>

          <div className="auth-quote-box">
            <p>Itemized fuel, toll, and hotel estimates based on public tariffs and verified regional benchmarks.</p>
          </div>
        </div>

        {/* Right Form Panel */}
        {verificationPending ? (
          <div className="auth-form-panel">
            <div className="auth-form-header">
              <span className="eyebrow-badge">
                <Mail size={12} />
                Verification Required
              </span>
              <h3>Verify Your Email Address</h3>
              <p>
                We sent a 6-digit verification code to <strong>{verificationEmail}</strong>. Enter it below to activate your account.
              </p>
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

            <form onSubmit={handleVerifyEmail} className="auth-form">
              <div className="form-group" style={{ textAlign: 'center' }}>
                <label style={{ display: 'block', marginBottom: '8px' }}>Enter 6-Digit Verification Code</label>
                <div className="otp-input-wrap">
                  <input
                    id="register-verification-code-input"
                    type="text"
                    className="otp-input-field"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="••••••"
                    maxLength={6}
                    autoFocus
                    required
                  />
                </div>
              </div>

              <button
                id="register-verify-code-btn"
                type="submit"
                className="btn-primary"
                disabled={loading || verificationCode.length < 6}
                style={{ minHeight: '48px', fontSize: '15px' }}
              >
                <span>{loading ? 'Verifying...' : 'Verify & Continue'}</span>
                <ArrowRight size={16} />
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resendCooldown > 0}
                  className="btn-secondary-link"
                >
                  {resendCooldown > 0 ? `Resend Code in ${resendCooldown}s` : 'Resend Verification Code'}
                </button>

                <button
                  type="button"
                  onClick={() => { setVerificationPending(false); setError(''); }}
                  className="btn-secondary-link"
                  style={{ color: '#64748b' }}
                >
                  Edit Information
                </button>
              </div>
            </form>

            <p className="auth-switch-prompt">
              Already verified?{' '}
              <button id="switch-to-login-btn" type="button" onClick={onSwitchToLogin} className="auth-switch-link">
                Sign in here
              </button>
            </p>
          </div>
        ) : (
          <div className="auth-form-panel">
            <div className="auth-form-header">
              <span className="eyebrow-badge">
                <Sparkles size={12} />
                Get Started
              </span>
              <h3>Create Your VISTA Account</h3>
              <p>Set up your profile to personalize future itineraries.</p>
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
                <label>Full Name</label>
                <div className="input-with-icon">
                  <User size={16} className="input-icon" />
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    placeholder="e.g. Maya Sharma"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Email Address</label>
                <div className="input-with-icon">
                  <Mail size={16} className="input-icon" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    placeholder="traveler@example.com"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Default Travel Style</label>
                <select
                  name="companionType"
                  value={formData.companionType}
                  onChange={handleChange}
                >
                  <option value="solo">Solo Traveler</option>
                  <option value="couple">Couple</option>
                  <option value="friends">Friends Squad</option>
                  <option value="family">Family</option>
                </select>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Password</label>
                  <div className="password-input-wrap input-with-icon">
                    <Lock size={16} className="input-icon" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      placeholder="At least 8 chars"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Confirm Password</label>
                  <div className="password-input-wrap input-with-icon">
                    <Lock size={16} className="input-icon" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      required
                      placeholder="Repeat password"
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
              </div>

              <button id="register-submit-btn" type="submit" className="btn-primary" disabled={loading} style={{ minHeight: '48px', fontSize: '15px' }}>
                <span>{loading ? 'Creating Account...' : 'Create Account'}</span>
                <ArrowRight size={16} />
              </button>
            </form>

            <p className="auth-switch-prompt">
              Already have an account?{' '}
              <button id="switch-to-login-btn" type="button" onClick={onSwitchToLogin} className="auth-switch-link">
                Log in here
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Register;

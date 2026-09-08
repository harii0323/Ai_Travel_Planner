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
  GraduationCap,
  Users,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

function Register({ onRegisterSuccess, onSwitchToLogin }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    age: '',
    studentId: '',
    companionType: 'solo'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/api/auth/register', {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        passwordConfirm: formData.confirmPassword,
        travelCompanionType: formData.companionType
      });

      if (response.data.success) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        onRegisterSuccess(response.data.user, response.data.token);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
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
            <h2>Join Thousands of Student Explorers</h2>
            <p>Unlock custom AI travel routes, split group budgets, and discover hidden gems suited for your wallet.</p>
            <ul className="auth-perks-list">
              <li>
                <CheckCircle2 size={16} />
                <span>Save unlimited custom itineraries</span>
              </li>
              <li>
                <CheckCircle2 size={16} />
                <span>Export directly to PDF and calendar</span>
              </li>
              <li>
                <CheckCircle2 size={16} />
                <span>Real-time weather suitability checks</span>
              </li>
            </ul>
          </div>

          <div className="auth-quote-box">
            <p>⚡ 100% Free for students & independent budget travelers.</p>
          </div>
        </div>

        {/* Right Form Panel */}
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
                  placeholder="student@university.edu"
                />
              </div>
            </div>

            <div className="form-grid-2">
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

              <div className="form-group">
                <label>Student ID (Optional)</label>
                <input
                  type="text"
                  name="studentId"
                  value={formData.studentId}
                  onChange={handleChange}
                  placeholder="For discounts"
                />
              </div>
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
                    placeholder="At least 6 chars"
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
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={loading} style={{ minHeight: '48px', fontSize: '15px' }}>
              <span>{loading ? 'Creating Account...' : 'Register & Start Exploring'}</span>
              <ArrowRight size={16} />
            </button>
          </form>

          <p className="auth-switch-prompt">
            Already have an account?{' '}
            <button type="button" onClick={onSwitchToLogin} className="auth-switch-link">
              Log in here
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;

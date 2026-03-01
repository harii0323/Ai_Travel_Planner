import React, { useState } from 'react';
import axios from 'axios';
import '../styles/Auth.css';

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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
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
      const response = await axios.post('http://localhost:5000/api/auth/register', {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        age: parseInt(formData.age),
        studentId: formData.studentId || null,
        travelPreferences: {
          companionType: formData.companionType,
          budget: 'budget-friendly',
          interests: []
        }
      });

      if (response.data.success) {
        // Auto-login after registration
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
    <div className="auth-container">
      <div className="auth-card">
        <h2>✈️ Student Travel Planner</h2>
        <h3>Create New Account</h3>

        {error && <div className="error-alert">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Full Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="John Doe"
            />
          </div>

          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="your@email.com"
            />
          </div>

          <div className="form-group">
            <label>Age</label>
            <input
              type="number"
              name="age"
              value={formData.age}
              onChange={handleChange}
              min="16"
              max="120"
              placeholder="18"
            />
          </div>

          <div className="form-group">
            <label>Student ID (Optional)</label>
            <input
              type="text"
              name="studentId"
              value={formData.studentId}
              onChange={handleChange}
              placeholder="For student discounts"
            />
          </div>

          <div className="form-group">
            <label>Travel Companion Type</label>
            <select
              name="companionType"
              value={formData.companionType}
              onChange={handleChange}
            >
              <option value="solo">Solo Traveler</option>
              <option value="couple">Couple</option>
              <option value="friends">Friends Group</option>
              <option value="family">Family</option>
            </select>
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="At least 6 characters"
            />
          </div>

          <div className="form-group">
            <label>Confirm Password</label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              placeholder="Re-enter password"
            />
          </div>

          <button type="submit" className="btn-register" disabled={loading}>
            {loading ? 'Creating Account...' : 'Register'}
          </button>
        </form>

        <p className="switch-auth">
          Already have an account?{' '}
          <button type="button" onClick={onSwitchToLogin} className="link-btn">
            Login here
          </button>
        </p>
      </div>
    </div>
  );
}

export default Register;

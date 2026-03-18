import React, { useState } from 'react';
import axios from 'axios';
import '../styles/Profile.css';

function Profile({ user, onProfileUpdate }) {
  const [formData, setFormData] = useState({
    name: user?.name || '',
    age: user?.age || '',
    studentId: user?.studentId || '',
    companionType: user?.travelPreferences?.companionType || 'solo',
    budget: user?.travelPreferences?.budget || 'budget-friendly',
    interests: user?.travelPreferences?.interests || ['adventure', 'culture']
  });

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleInterestToggle = (interest) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest]
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');

    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const response = await axios.put(
        'http://localhost:5000/api/auth/profile',
        {
          name: formData.name,
          age: parseInt(formData.age),
          studentId: formData.studentId || null,
          travelPreferences: {
            companionType: formData.companionType,
            budget: formData.budget,
            interests: formData.interests
          }
        },
        config
      );

      if (response.data.success) {
        const updatedUser = response.data.user;
        localStorage.setItem('user', JSON.stringify(updatedUser));
        onProfileUpdate(updatedUser);
        
        setEditing(false);
        setMessage('Profile updated successfully!');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      setMessage(error.response?.data?.error || 'Error updating profile');
    } finally {
      setSaving(false);
    }
  };

  const interests = [
    { id: 'adventure', label: '🏔️ Adventure' },
    { id: 'culture', label: '🏛️ Culture' },
    { id: 'beach', label: '🏖️ Beach' },
    { id: 'food', label: '🍜 Food & Cuisine' },
    { id: 'nightlife', label: '🌙 Nightlife' },
    { id: 'nature', label: '🌿 Nature' },
    { id: 'history', label: '📚 History' },
    { id: 'shopping', label: '🛍️ Shopping' }
  ];

  return (
    <div className="profile-container">
      <header className="profile-header">
        <h2>👤 Your Profile</h2>
        <p>Manage your account and travel preferences</p>
      </header>

      {message && <div className={`alert ${message.includes('successfully') ? 'success' : 'error'}`}>{message}</div>}

      <div className="profile-card">
        <div className="profile-section">
          <h3>Basic Information</h3>
          
          {!editing ? (
            <div className="info-display">
              <div className="info-item">
                <label>Name</label>
                <p>{formData.name}</p>
              </div>
              <div className="info-item">
                <label>Email</label>
                <p>{user?.email}</p>
              </div>
              <div className="info-item">
                <label>Age</label>
                <p>{formData.age || 'Not specified'}</p>
              </div>
              <div className="info-item">
                <label>Student ID</label>
                <p>{formData.studentId || '(Unlocked student discounts!)'}</p>
              </div>
            </div>
          ) : (
            <div className="info-edit">
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
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
                />
              </div>

              <div className="form-group">
                <label>Student ID (Optional)</label>
                <input
                  type="text"
                  name="studentId"
                  value={formData.studentId}
                  onChange={handleChange}
                  placeholder="For additional discounts"
                />
              </div>
            </div>
          )}
        </div>

        <div className="profile-section">
          <h3>Travel Preferences</h3>

          {!editing ? (
            <div className="prefs-display">
              <div className="pref-item">
                <label>Travel Style</label>
                <p>
                  <span className="badge">{formData.companionType}</span>
                </p>
              </div>
              <div className="pref-item">
                <label>Budget Preference</label>
                <p>
                  <span className="badge">{formData.budget.replace('-', ' ')}</span>
                </p>
              </div>
              <div className="pref-item">
                <label>Interests</label>
                <div className="interest-badges">
                  {formData.interests.map(interest => {
                    const intInfo = interests.find(i => i.id === interest);
                    return (
                      <span key={interest} className="badge interest">
                        {intInfo?.label || interest}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="prefs-edit">
              <div className="form-group">
                <label>Travel Companion Type</label>
                <select
                  name="companionType"
                  value={formData.companionType}
                  onChange={handleChange}
                >
                  <option value="solo">Solo Traveler 🚶</option>
                  <option value="couple">Couple 💑</option>
                  <option value="friends">Friends Group 👥</option>
                  <option value="family">Family 👨‍👩‍👧‍👦</option>
                </select>
              </div>

              <div className="form-group">
                <label>Budget Preference</label>
                <select
                  name="budget"
                  value={formData.budget}
                  onChange={handleChange}
                >
                  <option value="budget-friendly">Budget-Friendly (Under ₹500/day)</option>
                  <option value="moderate">Moderate (₹500-1500/day)</option>
                  <option value="comfortable">Comfortable (₹1500-3000/day)</option>
                  <option value="luxury">Luxury (₹3000+/day)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Travel Interests (Select all that apply)</label>
                <div className="interest-selector">
                  {interests.map(interest => (
                    <label key={interest.id} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.interests.includes(interest.id)}
                        onChange={() => handleInterestToggle(interest.id)}
                      />
                      <span>{interest.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="profile-actions">
          {!editing ? (
            <button
              className="btn-primary"
              onClick={() => setEditing(true)}
            >
              Edit Profile
            </button>
          ) : (
            <>
              <button
                className="btn-primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                className="btn-secondary"
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
            </>
          )}
        </div>

        <div className="profile-info-box">
          <h4>💡 About Your Preferences</h4>
          <p>
            Your travel preferences help us personalize itineraries with:
          </p>
          <ul>
            <li>✈️ Activities matched to your travel style</li>
            <li>💰 Budget allocation optimized for your preferences</li>
            <li>👥 Group recommendations based on companion type</li>
            <li>🎯 Destination suggestions matching your interests</li>
            <li>🎓 Student discounts if you have a valid student ID</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default Profile;

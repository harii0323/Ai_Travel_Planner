import React, { useState } from 'react';
import api from '../api';
import '../styles/Profile.css';
import {
  User,
  Compass,
  Wallet,
  Sparkles,
  ShieldCheck,
  Check,
  Edit2,
  Save,
  X,
  GraduationCap,
  Heart,
  Trees,
  Camera,
  Utensils,
  Landmark,
  Coffee
} from 'lucide-react';

const INTEREST_OPTIONS = [
  { id: 'adventure', label: 'Adventure', icon: '🧗' },
  { id: 'culture', label: 'Culture & Heritage', icon: '🏛️' },
  { id: 'beach', label: 'Beaches & Ocean', icon: '🏖️' },
  { id: 'food', label: 'Food & Cuisine', icon: '🍲' },
  { id: 'nightlife', label: 'Nightlife & Social', icon: '✨' },
  { id: 'nature', label: 'Nature & Forests', icon: '🌲' },
  { id: 'history', label: 'History & Forts', icon: '🏰' },
  { id: 'photography', label: 'Photography', icon: '📸' },
  { id: 'shopping', label: 'Local Bazaars', icon: '🛍️' }
];

function Profile({ user, onProfileUpdate, addToast }) {
  const [formData, setFormData] = useState({
    name: user?.name || '',
    age: user?.age || '',
    studentId: user?.studentId || '',
    companionType: user?.travelPreferences?.companionType || 'solo',
    budget: user?.travelPreferences?.budget || 'budget-friendly',
    interests: user?.travelPreferences?.interests || ['adventure', 'culture', 'nature']
  });

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleInterestToggle = (id) => {
    if (!editing) return;
    setFormData((prev) => ({
      ...prev,
      interests: prev.interests.includes(id)
        ? prev.interests.filter((i) => i !== id)
        : [...prev.interests, id]
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const response = await api.put(
        '/api/auth/profile',
        {
          name: formData.name,
          age: parseInt(formData.age) || null,
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
        onProfileUpdate(updatedUser);
        setEditing(false);
        if (addToast) addToast('Profile & travel preferences saved! ✨', 'success');
      }
    } catch (error) {
      if (addToast) addToast(error.response?.data?.error || 'Error updating profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const initials = formData.name
    ? formData.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'VI';

  return (
    <div className="profile-container">
      <header className="profile-header">
        <span className="eyebrow-badge">
          <Sparkles size={13} />
          Account & Vibe
        </span>
        <h2>Traveler Profile</h2>
        <p>Personalize your travel persona, student discounts, and activity preferences.</p>
      </header>

      <div className="profile-card">
        {/* Traveler Persona Banner */}
        <div className="profile-persona-banner">
          <div className="profile-big-avatar">{initials}</div>
          <div className="profile-persona-info">
            <h3>{formData.name || 'Student Traveler'}</h3>
            <p>{user?.email}</p>
            <div className="profile-badges-row">
              <span className="persona-pill style">
                <Compass size={13} />
                {formData.companionType ? `${formData.companionType.toUpperCase()} EXPLORER` : 'SOLO EXPLORER'}
              </span>
              <span className="persona-pill student">
                <GraduationCap size={13} />
                {formData.studentId ? 'STUDENT DISCOUNT VERIFIED' : 'STUDENT TIER'}
              </span>
            </div>
          </div>
        </div>

        {/* Basic Info Section */}
        <div className="profile-section">
          <h4>
            <User size={18} color="#14b8a6" />
            Personal Details
          </h4>

          {!editing ? (
            <div className="profile-fields-grid">
              <div className="profile-field-item">
                <label>Full Name</label>
                <span>{formData.name || 'Not provided'}</span>
              </div>
              <div className="profile-field-item">
                <label>Email Address</label>
                <span>{user?.email}</span>
              </div>
              <div className="profile-field-item">
                <label>Age</label>
                <span>{formData.age ? `${formData.age} years old` : 'Not specified'}</span>
              </div>
              <div className="profile-field-item">
                <label>Student ID</label>
                <span>{formData.studentId || 'Enabled for student discounts'}</span>
              </div>
            </div>
          ) : (
            <div className="profile-fields-grid">
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter full name"
                />
              </div>

              <div className="form-group">
                <label>Age</label>
                <input
                  type="number"
                  name="age"
                  value={formData.age}
                  onChange={handleChange}
                  placeholder="e.g. 21"
                />
              </div>

              <div className="form-group">
                <label>Student ID (Optional)</label>
                <input
                  type="text"
                  name="studentId"
                  value={formData.studentId}
                  onChange={handleChange}
                  placeholder="College ID number"
                />
              </div>
            </div>
          )}
        </div>

        {/* Travel Preferences Section */}
        <div className="profile-section">
          <h4>
            <Compass size={18} color="#f59e0b" />
            Default Travel Preferences
          </h4>

          {!editing ? (
            <div className="profile-fields-grid">
              <div className="profile-field-item">
                <label>Default Travel Style</label>
                <span style={{ textTransform: 'capitalize' }}>{formData.companionType}</span>
              </div>
              <div className="profile-field-item">
                <label>Budget Level</label>
                <span style={{ textTransform: 'capitalize' }}>{formData.budget.replace('-', ' ')}</span>
              </div>
            </div>
          ) : (
            <div className="profile-fields-grid">
              <div className="form-group">
                <label>Preferred Travel Style</label>
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
                <label>Budget Tier</label>
                <select
                  name="budget"
                  value={formData.budget}
                  onChange={handleChange}
                >
                  <option value="budget-friendly">Budget Friendly (Under ₹1,500/day)</option>
                  <option value="moderate">Moderate (₹1,500 - 3,500/day)</option>
                  <option value="comfortable">Comfortable (₹3,500 - 6,000/day)</option>
                </select>
              </div>
            </div>
          )}

          {/* Interest Chips */}
          <div style={{ marginTop: '10px' }}>
            <label style={{ display: 'block', color: 'var(--muted)', fontSize: '13px', fontWeight: 700, marginBottom: '10px' }}>
              Favorite Travel Interests {editing && '(Click to toggle)'}:
            </label>
            <div className="profile-interests-chips">
              {INTEREST_OPTIONS.map((item) => {
                const selected = formData.interests.includes(item.id);
                return (
                  <div
                    key={item.id}
                    className={`profile-interest-pill ${selected ? 'selected' : ''}`}
                    onClick={() => handleInterestToggle(item.id)}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                    {selected && <Check size={14} />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Student Discount Verification Box */}
        <div className="profile-section" style={{ borderBottom: 'none' }}>
          <div className="student-perks-box">
            <div className="student-perks-left">
              <GraduationCap size={32} color="#f59e0b" />
              <div>
                <h5>Student Travel Perks Active</h5>
                <p>Enjoy automatic 15% to 30% savings calculated on hostels, state buses, and museum tickets.</p>
              </div>
            </div>
            <span className="persona-pill student">ACTIVE PERKS</span>
          </div>
        </div>

        {/* Profile Action Footer */}
        <div className="profile-actions-footer">
          {!editing ? (
            <button className="btn-primary" onClick={() => setEditing(true)}>
              <Edit2 size={16} />
              <span>Edit Preferences</span>
            </button>
          ) : (
            <>
              <button
                className="btn-primary"
                onClick={handleSave}
                disabled={saving}
              >
                <Save size={16} />
                <span>{saving ? 'Saving...' : 'Save Changes'}</span>
              </button>
              <button
                className="btn-secondary"
                onClick={() => setEditing(false)}
              >
                <X size={16} />
                <span>Cancel</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Profile;

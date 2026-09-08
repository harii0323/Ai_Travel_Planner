import React, { useState, useEffect } from 'react';
import api from '../api';
import '../styles/History.css';
import {
  Compass,
  Calendar,
  Wallet,
  Users,
  Search,
  Eye,
  Copy,
  Trash2,
  Sparkles,
  MapPin,
  Clock,
  Plus
} from 'lucide-react';

function History({ onSelectItinerary, addToast, onStartNewTrip }) {
  const [itineraries, setItineraries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchItineraries();
  }, []);

  const fetchItineraries = async () => {
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const response = await api.get('/api/history', config);
      setItineraries(response.data.itineraries || []);
    } catch (error) {
      console.error('Error fetching itineraries:', error);
      if (addToast) addToast('Error loading travel history', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, destination) => {
    if (window.confirm(`Are you sure you want to delete the plan for ${destination || 'this destination'}?`)) {
      try {
        const token = localStorage.getItem('token');
        const config = { headers: { Authorization: `Bearer ${token}` } };

        await api.delete(`/api/history/${id}`, config);
        setItineraries((prev) => prev.filter((it) => (it.id || it._id) !== id));
        if (addToast) addToast('Itinerary deleted', 'info');
      } catch (error) {
        console.error('Error deleting itinerary:', error);
        if (addToast) addToast('Failed to delete itinerary', 'error');
      }
    }
  };

  const handleDuplicate = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const response = await api.post(`/api/history/duplicate/${id}`, {}, config);
      if (response.data.itinerary) {
        setItineraries((prev) => [response.data.itinerary, ...prev]);
        if (addToast) addToast('Trip plan duplicated! 📋', 'success');
      }
    } catch (error) {
      console.error('Error duplicating itinerary:', error);
      if (addToast) addToast('Could not duplicate itinerary', 'error');
    }
  };

  const handleStatusUpdate = async (id, status) => {
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const response = await api.put(`/api/history/${id}`, { status }, config);
      setItineraries((prev) =>
        prev.map((it) => ((it.id || it._id) === id ? response.data.itinerary || { ...it, status } : it))
      );
      if (addToast) addToast(`Trip marked as ${status}`, 'info');
    } catch (error) {
      console.error('Error updating itinerary:', error);
    }
  };

  const getFilteredAndSortedItineraries = () => {
    let list = itineraries;

    // Filter by status
    if (filter !== 'all') {
      list = list.filter((it) => it.status === filter);
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((it) => {
        const dest = (it.destination || '').toLowerCase();
        const desc = (it.description || '').toLowerCase();
        const tags = (it.tags || []).join(' ').toLowerCase();
        return dest.includes(q) || desc.includes(q) || tags.includes(q);
      });
    }

    // Sort
    return [...list].sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return new Date(b.createdAt) - new Date(a.createdAt);
        case 'oldest':
          return new Date(a.createdAt) - new Date(b.createdAt);
        case 'budget-high':
          return (b.budget || 0) - (a.budget || 0);
        case 'budget-low':
          return (a.budget || 0) - (b.budget || 0);
        case 'destination':
          return (a.destination || '').localeCompare(b.destination || '');
        default:
          return 0;
      }
    });
  };

  const filteredList = getFilteredAndSortedItineraries();

  // Status counts
  const counts = {
    all: itineraries.length,
    saved: itineraries.filter((i) => i.status === 'saved').length,
    completed: itineraries.filter((i) => i.status === 'completed').length,
    draft: itineraries.filter((i) => i.status === 'draft').length
  };

  if (loading) {
    return (
      <div className="history-container">
        <div className="loading-container">
          <h3>Loading your travel portfolio...</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="history-container">
      <header className="history-header">
        <span className="eyebrow-badge">
          <Sparkles size={13} />
          Travel Archive
        </span>
        <h2>Your Saved Adventures</h2>
        <p>Review, duplicate, or customize all your generated travel plans anytime.</p>
      </header>

      {/* History Controls Bar */}
      <div className="history-controls-bar">
        <div className="history-search-input">
          <Search size={16} className="input-icon" style={{ left: '14px' }} />
          <input
            type="text"
            placeholder="Search trips by destination, tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="history-filter-pills">
          <button
            type="button"
            className={`history-pill ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({counts.all})
          </button>
          <button
            type="button"
            className={`history-pill ${filter === 'saved' ? 'active' : ''}`}
            onClick={() => setFilter('saved')}
          >
            Saved ({counts.saved})
          </button>
          <button
            type="button"
            className={`history-pill ${filter === 'completed' ? 'active' : ''}`}
            onClick={() => setFilter('completed')}
          >
            Completed ({counts.completed})
          </button>
          <button
            type="button"
            className={`history-pill ${filter === 'draft' ? 'active' : ''}`}
            onClick={() => setFilter('draft')}
          >
            Drafts ({counts.draft})
          </button>
        </div>

        <select
          className="history-sort-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="recent">Most Recent</option>
          <option value="oldest">Oldest First</option>
          <option value="budget-high">Budget (High to Low)</option>
          <option value="budget-low">Budget (Low to High)</option>
          <option value="destination">Destination (A-Z)</option>
        </select>
      </div>

      {filteredList.length === 0 ? (
        <div className="history-empty-state">
          <div className="history-empty-icon">
            <Compass size={32} />
          </div>
          <h3>No travel plans match your filter</h3>
          <p>Ready to explore a new city or mountain escape? Build a custom plan in seconds.</p>
          {onStartNewTrip && (
            <button className="btn-primary" onClick={onStartNewTrip}>
              <Plus size={16} />
              <span>Create New Plan</span>
            </button>
          )}
        </div>
      ) : (
        <div className="history-cards-grid">
          {filteredList.map((item) => {
            const id = item.id || item._id;
            return (
              <div key={id} className="history-card">
                <div className="history-card-header">
                  <div className="history-card-title">
                    <h3>{item.destination}</h3>
                    <span className="history-card-date">
                      <Clock size={12} />
                      Created {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <span className={`status-pill status-${item.status || 'saved'}`}>
                    {item.status || 'Saved'}
                  </span>
                </div>

                <div className="history-meta-grid">
                  <div className="history-meta-item">
                    <Wallet size={14} color="#f59e0b" />
                    <span>
                      Budget: <strong>₹{item.budget?.toLocaleString('en-IN')}</strong>
                    </span>
                  </div>

                  <div className="history-meta-item">
                    <Calendar size={14} color="#14b8a6" />
                    <span>
                      Duration: <strong>{item.totalDays || item.numberOfDays || 1} Days</strong>
                    </span>
                  </div>

                  <div className="history-meta-item">
                    <Users size={14} color="#38bdf8" />
                    <span>
                      Travelers: <strong>{item.numberOfTravelers || 1}</strong>
                    </span>
                  </div>

                  <div className="history-meta-item">
                    <MapPin size={14} color="#10b981" />
                    <span>
                      Type: <strong>{item.travelCompanionType || 'Solo'}</strong>
                    </span>
                  </div>
                </div>

                {item.tags && item.tags.length > 0 && (
                  <div className="history-tags">
                    {item.tags.map((tag, idx) => (
                      <span key={idx} className="history-tag-pill">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="history-card-actions">
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ minHeight: '36px', padding: '0 14px', fontSize: '13px' }}
                    onClick={() => onSelectItinerary(id)}
                  >
                    <Eye size={14} />
                    <span>View Plan</span>
                  </button>

                  <select
                    className="history-status-dropdown"
                    value={item.status || 'saved'}
                    onChange={(e) => handleStatusUpdate(id, e.target.value)}
                  >
                    <option value="saved">Saved</option>
                    <option value="completed">Completed</option>
                    <option value="draft">Draft</option>
                    <option value="archived">Archived</option>
                  </select>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      className="btn-icon-action"
                      onClick={() => handleDuplicate(id)}
                      title="Duplicate plan"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      type="button"
                      className="btn-icon-action delete"
                      onClick={() => handleDelete(id, item.destination)}
                      title="Delete plan"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default History;

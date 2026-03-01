import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/History.css';

function History({ onSelectItinerary }) {
  const [itineraries, setItineraries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');

  useEffect(() => {
    fetchItineraries();
  }, []);

  const fetchItineraries = async () => {
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const response = await axios.get('http://localhost:5000/api/history', config);
      setItineraries(response.data.itineraries || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching itineraries:', error);
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this itinerary?')) {
      try {
        const token = localStorage.getItem('token');
        const config = { headers: { Authorization: `Bearer ${token}` } };

        await axios.delete(`http://localhost:5000/api/history/${id}`, config);
        setItineraries(itineraries.filter(it => it._id !== id));
      } catch (error) {
        console.error('Error deleting itinerary:', error);
      }
    }
  };

  const handleDuplicate = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const response = await axios.post(`http://localhost:5000/api/history/duplicate/${id}`, {}, config);
      setItineraries([response.data.itinerary, ...itineraries]);
    } catch (error) {
      console.error('Error duplicating itinerary:', error);
    }
  };

  const handleStatusUpdate = async (id, status) => {
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const response = await axios.put(`http://localhost:5000/api/history/${id}`, { status }, config);
      
      setItineraries(itineraries.map(it => it._id === id ? response.data.itinerary : it));
    } catch (error) {
      console.error('Error updating itinerary:', error);
    }
  };

  const getFilteredAndSortedItineraries = () => {
    let filtered = itineraries;

    // Filter by status
    if (filter !== 'all') {
      filtered = filtered.filter(it => it.status === filter);
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return new Date(b.createdAt) - new Date(a.createdAt);
        case 'oldest':
          return new Date(a.createdAt) - new Date(b.createdAt);
        case 'budget-high':
          return b.budget - a.budget;
        case 'budget-low':
          return a.budget - b.budget;
        case 'destination':
          return a.destination.localeCompare(b.destination);
        default:
          return 0;
      }
    });

    return sorted;
  };

  if (loading) {
    return <div className="history-loading">Loading your travel plans...</div>;
  }

  const filteredItineraries = getFilteredAndSortedItineraries();

  return (
    <div className="history-container">
      <header className="history-header">
        <h2>📚 Your Travel Plans</h2>
        <p>Manage and organize all your saved itineraries</p>
      </header>

      <div className="history-controls">
        <div className="control-group">
          <label>Filter by Status:</label>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All Plans</option>
            <option value="draft">Drafts</option>
            <option value="saved">Saved</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <div className="control-group">
          <label>Sort by:</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="recent">Most Recent</option>
            <option value="oldest">Oldest First</option>
            <option value="budget-high">Budget (High to Low)</option>
            <option value="budget-low">Budget (Low to High)</option>
            <option value="destination">Destination (A-Z)</option>
          </select>
        </div>
      </div>

      {filteredItineraries.length === 0 ? (
        <div className="empty-state">
          <h3>No travel plans found</h3>
          <p>Create your first itinerary to get started!</p>
        </div>
      ) : (
        <div className="history-grid">
          {filteredItineraries.map(itinerary => (
            <div key={itinerary._id} className="itinerary-card">
              <div className="card-header">
                <div>
                  <h3>{itinerary.destination}</h3>
                  <p className="card-date">
                    Created: {new Date(itinerary.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className={`status-badge status-${itinerary.status}`}>
                  {itinerary.status.toUpperCase()}
                </span>
              </div>

              <div className="card-details">
                <div className="detail-row">
                  <span className="label">Budget:</span>
                  <span className="value">${itinerary.budget.toLocaleString()}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Duration:</span>
                  <span className="value">{itinerary.numberOfDays} days</span>
                </div>
                <div className="detail-row">
                  <span className="label">Travelers:</span>
                  <span className="value">{itinerary.numberOfTravelers} {itinerary.travelCompanionType}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Travel Date:</span>
                  <span className="value">
                    {itinerary.plannedTravelDate 
                      ? new Date(itinerary.plannedTravelDate).toLocaleDateString()
                      : 'Not set'}
                  </span>
                </div>
              </div>

              {itinerary.description && (
                <div className="card-description">
                  <p>{itinerary.description}</p>
                </div>
              )}

              <div className="card-tags">
                {itinerary.tags && itinerary.tags.map((tag, idx) => (
                  <span key={idx} className="tag">{tag}</span>
                ))}
              </div>

              <div className="card-actions">
                <button 
                  className="btn-small btn-view"
                  onClick={() => onSelectItinerary(itinerary._id)}
                >
                  View Details
                </button>

                <select
                  className="status-dropdown"
                  value={itinerary.status}
                  onChange={(e) => handleStatusUpdate(itinerary._id, e.target.value)}
                >
                  <option value="draft">Draft</option>
                  <option value="saved">Saved</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>

                <button
                  className="btn-small btn-duplicate"
                  onClick={() => handleDuplicate(itinerary._id)}
                  title="Create a copy of this plan"
                >
                  Duplicate
                </button>

                <button
                  className="btn-small btn-delete"
                  onClick={() => handleDelete(itinerary._id)}
                  title="Delete this plan"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default History;

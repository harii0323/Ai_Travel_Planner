import React, { useState, useEffect } from 'react';
import api from '../api';
import '../styles/Dashboard.css';

function Dashboard({ user, onStartPlanning, onViewHistory }) {
  const [statistics, setStatistics] = useState({
    totalPlans: 0,
    savedPlans: 0,
    completedTrips: 0,
    averageBudget: 0
  });
  const [recentPlans, setRecentPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const token = localStorage.getItem('token');
        const config = { headers: { Authorization: `Bearer ${token}` } };

        // Fetch user's itineraries
        const response = await api.get('/api/history', config);
        const plans = response.data.itineraries || [];

        // Calculate statistics
        const stats = {
          totalPlans: plans.length,
          savedPlans: plans.filter(p => p.status === 'saved').length,
          completedTrips: plans.filter(p => p.status === 'completed').length,
          averageBudget: plans.length > 0 
            ? Math.round(plans.reduce((sum, p) => sum + p.budget, 0) / plans.length)
            : 0
        };

        setStatistics(stats);

        // Get 3 most recent plans
        const recent = plans.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 3);
        setRecentPlans(recent);

        setLoading(false);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return <div className="dashboard-loading">Loading dashboard...</div>;
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <p className="eyebrow">Trip command center</p>
        <h1>Welcome, {user?.name}</h1>
        <p>Plan affordable routes, review saved ideas, and keep every itinerary within reach.</p>
      </header>

      <section className="statistics-grid">
        <div className="stat-card">
          <div className="stat-icon">📋</div>
          <div className="stat-content">
            <h3>{statistics.totalPlans}</h3>
            <p>Total plans</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">💾</div>
          <div className="stat-content">
            <h3>{statistics.savedPlans}</h3>
            <p>Saved plans</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">✓</div>
          <div className="stat-content">
            <h3>{statistics.completedTrips}</h3>
            <p>Completed trips</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">💵</div>
          <div className="stat-content">
            <h3>₹{statistics.averageBudget.toLocaleString('en-IN')}</h3>
            <p>Average budget</p>
          </div>
        </div>
      </section>

      <section className="dashboard-section">
        <div className="section-header">
          <h2>Quick actions</h2>
        </div>
        <div className="action-buttons">
          <button className="btn-primary" onClick={onStartPlanning}>
            Create new plan
          </button>
          <button className="btn-secondary" onClick={onViewHistory}>
            View all plans
          </button>
        </div>
      </section>

      {recentPlans.length > 0 && (
        <section className="dashboard-section">
          <div className="section-header">
            <h2>Recent plans</h2>
            <button className="view-all" onClick={onViewHistory}>View all</button>
          </div>

          <div className="recent-plans-list">
            {recentPlans.map(plan => (
              <div key={plan.id || plan._id} className="plan-card">
                <div className="plan-header">
                  <h3>{plan.destination}</h3>
                  <span className={`status-badge status-${plan.status}`}>
                    {plan.status.toUpperCase()}
                  </span>
                </div>

                <div className="plan-details">
                  <p><strong>Budget:</strong> ₹{plan.budget.toLocaleString('en-IN')}</p>
                  <p><strong>Duration:</strong> {plan.totalDays || plan.numberOfDays} days</p>
                  <p><strong>Type:</strong> {plan.travelCompanionType}</p>
                  {plan.plannedTravelDate && (
                    <p><strong>Planned Date:</strong> {new Date(plan.plannedTravelDate).toLocaleDateString()}</p>
                  )}
                </div>

                <div className="plan-actions">
                  <button className="btn-small btn-view">View</button>
                  <button className="btn-small btn-duplicate">Duplicate</button>
                  <button className="btn-small btn-delete">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="dashboard-section info-section">
        <h2>Travel tips for {user?.travelPreferences?.companionType || 'solo'} travelers</h2>
        <div className="tips-grid">
          <div className="tip-card">
            <h4>Pack smart</h4>
            <p>Bring a lightweight backpack (40-50L) and only pack 5-7 pairs of clothes. Mix and match outfits!</p>
          </div>
          <div className="tip-card">
            <h4>Budget hacking</h4>
            <p>Use free walking tours, cook your own meals, and travel during shoulder seasons for better prices.</p>
          </div>
          <div className="tip-card">
            <h4>Local experiences</h4>
            <p>Stay in local neighborhoods, eat where locals eat, and use public transport instead of taxis.</p>
          </div>
          <div className="tip-card">
            <h4>Documentation</h4>
            <p>Keep digital copies of your passport, visas, and insurance. Share with a trusted friend.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Dashboard;

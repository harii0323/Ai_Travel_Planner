import React, { useState, useEffect } from 'react';
import api from '../api';
import '../styles/Dashboard.css';
import {
  Compass,
  Calendar,
  BookmarkCheck,
  CheckCircle2,
  Wallet,
  Sparkles,
  ArrowRight,
  MapPin,
  Users,
  Eye,
  Copy,
  Trash2,
  Lightbulb,
  ShieldCheck,
  Zap,
  TrendingUp,
  Clock
} from 'lucide-react';

const POPULAR_PRESETS = [
  {
    id: 'goa',
    destination: 'Goa',
    startLocation: 'Mumbai',
    emoji: '🏖️',
    title: 'Goa Coastal Getaway',
    description: 'Beaches, vibrant sunsets, watersports, and beachside cafes.',
    budget: 6500,
    days: 4,
    companion: 'friends',
    tag: 'Beach & Parties',
    activities: 'nature, food, relaxation',
    transport: 'train',
    accommodation: 'hostel'
  },
  {
    id: 'manali',
    destination: 'Manali, Himachal Pradesh',
    startLocation: 'Delhi',
    emoji: '🏔️',
    title: 'Manali Alpine Adventure',
    description: 'Snow peaks, Solang valley adventures, waterfalls & cozy cafes.',
    budget: 8000,
    days: 5,
    companion: 'friends',
    tag: 'Mountains & Snow',
    activities: 'adventure, trekking, photography',
    transport: 'bus',
    accommodation: 'homestay'
  },
  {
    id: 'jaipur',
    destination: 'Jaipur, Rajasthan',
    startLocation: 'Delhi',
    emoji: '🏰',
    title: 'Jaipur Royal Heritage',
    description: 'Amer fort, Hawa Mahal, bustling bazaars, and authentic cuisine.',
    budget: 4500,
    days: 3,
    companion: 'solo',
    tag: 'Culture & Heritage',
    activities: 'cultural, food, photography',
    transport: 'train',
    accommodation: 'budgetHotel'
  },
  {
    id: 'kerala',
    destination: 'Munnar & Alleppey, Kerala',
    startLocation: 'Bangalore',
    emoji: '🌴',
    title: 'Kerala Backwaters & Tea Hills',
    description: 'Lush tea estates, calm houseboats, and serene nature trails.',
    budget: 9500,
    days: 5,
    companion: 'couple',
    tag: 'Nature & Serenity',
    activities: 'nature, relaxation, photography',
    transport: 'train',
    accommodation: 'homestay'
  },
  {
    id: 'rishikesh',
    destination: 'Rishikesh, Uttarakhand',
    startLocation: 'Delhi',
    emoji: '🌊',
    title: 'Rishikesh Rapids & Camp',
    description: 'White-water rafting, cliff jumping, riverside camping & yoga vibes.',
    budget: 5000,
    days: 3,
    companion: 'friends',
    tag: 'Rafting & Camping',
    activities: 'adventure, camping, trekking',
    transport: 'bus',
    accommodation: 'hostel'
  },
  {
    id: 'ladakh',
    destination: 'Leh Ladakh',
    startLocation: 'Chandigarh',
    emoji: '🏍️',
    title: 'Ladakh High Altitude Circuit',
    description: 'Pangong Tso, high passes, monasteries, and rugged landscapes.',
    budget: 16000,
    days: 7,
    companion: 'friends',
    tag: 'Epic Roadtrip',
    activities: 'adventure, photography, camping',
    transport: 'ownTransport',
    accommodation: 'budgetHotel'
  }
];

function Dashboard({ user, onStartPlanning, onViewHistory, onSelectItinerary, addToast }) {
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

        const response = await api.get('/api/history', config);
        const plans = response.data.itineraries || [];

        const stats = {
          totalPlans: plans.length,
          savedPlans: plans.filter((p) => p.status === 'saved').length,
          completedTrips: plans.filter((p) => p.status === 'completed').length,
          averageBudget:
            plans.length > 0
              ? Math.round(plans.reduce((sum, p) => sum + (p.budget || 0), 0) / plans.length)
              : 0
        };

        setStatistics(stats);
        const recent = plans.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 4);
        setRecentPlans(recent);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const handleDeletePlan = async (id, destination) => {
    if (window.confirm(`Delete plan for ${destination || 'this destination'}?`)) {
      try {
        const token = localStorage.getItem('token');
        await api.delete(`/api/history/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setRecentPlans((prev) => prev.filter((p) => (p.id || p._id) !== id));
        setStatistics((prev) => ({
          ...prev,
          totalPlans: Math.max(0, prev.totalPlans - 1)
        }));
        if (addToast) addToast('Trip plan deleted', 'info');
      } catch (err) {
        if (addToast) addToast('Failed to delete plan', 'error');
      }
    }
  };

  const handleDuplicatePlan = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const response = await api.post(`/api/history/duplicate/${id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.itinerary) {
        setRecentPlans((prev) => [response.data.itinerary, ...prev].slice(0, 4));
        setStatistics((prev) => ({ ...prev, totalPlans: prev.totalPlans + 1 }));
        if (addToast) addToast('Plan duplicated successfully! 📋', 'success');
      }
    } catch (err) {
      if (addToast) addToast('Could not duplicate plan', 'error');
    }
  };

  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });

  const spotlightTrip = recentPlans.find((p) => p.status === 'saved' || p.plannedTravelDate) || recentPlans[0];

  return (
    <div className="dashboard-container">
      {/* Dynamic Hero Banner */}
      <section className="dashboard-hero">
        <div className="dashboard-hero-content">
          <div className="hero-date-badge">
            <Sparkles size={13} />
            <span>{todayFormatted} • AI Travel Assistant</span>
          </div>
          <h1>
            {getTimeGreeting()}, {user?.name?.split(' ')[0] || 'Explorer'}! ✈️
          </h1>
          <p>
            Where is your curiosity leading you next? Create budget-optimized student itineraries with smart weather routing in seconds.
          </p>
        </div>
        <div className="dashboard-hero-actions">
          <button className="btn-primary" onClick={() => onStartPlanning()}>
            <Compass size={17} />
            <span>Plan New Trip</span>
          </button>
          <button className="btn-secondary" onClick={onViewHistory}>
            <Calendar size={16} />
            <span>View All Plans</span>
          </button>
        </div>
      </section>

      {/* Statistics Cards */}
      <section className="statistics-grid">
        <div className="stat-card">
          <div className="stat-icon-wrap stat-icon-plans">
            <Compass size={22} />
          </div>
          <div className="stat-content">
            <h3>{loading ? '...' : statistics.totalPlans}</h3>
            <p>Total Itineraries</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrap stat-icon-saved">
            <BookmarkCheck size={22} />
          </div>
          <div className="stat-content">
            <h3>{loading ? '...' : statistics.savedPlans}</h3>
            <p>Saved Trips</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrap stat-icon-done">
            <CheckCircle2 size={22} />
          </div>
          <div className="stat-content">
            <h3>{loading ? '...' : statistics.completedTrips}</h3>
            <p>Completed Trips</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrap stat-icon-budget">
            <Wallet size={22} />
          </div>
          <div className="stat-content">
            <h3>₹{loading ? '0' : statistics.averageBudget.toLocaleString('en-IN')}</h3>
            <p>Average Budget</p>
          </div>
        </div>
      </section>

      {/* Main Dashboard Layout */}
      <div className="dashboard-grid-layout">
        <div className="dashboard-main-col">
          {/* Featured Spotlight Trip */}
          {spotlightTrip && (
            <div className="spotlight-card">
              <span className="spotlight-badge">
                <Sparkles size={12} />
                Featured Plan
              </span>
              <h3 className="spotlight-title">Adventure in {spotlightTrip.destination}</h3>
              <div className="spotlight-details">
                <div className="spotlight-item">
                  <Wallet size={14} color="#f59e0b" />
                  <span>₹{spotlightTrip.budget?.toLocaleString('en-IN')}</span>
                </div>
                <div className="spotlight-item">
                  <Calendar size={14} color="#14b8a6" />
                  <span>{spotlightTrip.totalDays || spotlightTrip.numberOfDays || 3} Days</span>
                </div>
                <div className="spotlight-item">
                  <Users size={14} color="#38bdf8" />
                  <span>{spotlightTrip.travelCompanionType || 'Solo'}</span>
                </div>
              </div>
              <button
                className="btn-primary"
                onClick={() => onSelectItinerary(spotlightTrip.id || spotlightTrip._id)}
              >
                <Eye size={15} />
                <span>Open Itinerary Details</span>
              </button>
            </div>
          )}

          {/* 1-Click Popular Destination Presets */}
          <section className="presets-section">
            <div className="section-header">
              <h2>
                <Sparkles size={18} color="#14b8a6" />
                Popular Student Escapes
              </h2>
              <span style={{ fontSize: '13px', color: 'var(--muted)' }}>1-click prefill</span>
            </div>

            <div className="presets-grid">
              {POPULAR_PRESETS.map((preset) => (
                <div
                  key={preset.id}
                  className="preset-card"
                  onClick={() => onStartPlanning(preset)}
                >
                  <div className="preset-header">
                    <span className="preset-emoji">{preset.emoji}</span>
                    <span className="preset-budget-tag">~₹{preset.budget.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="preset-body">
                    <h4>{preset.title}</h4>
                    <p>{preset.description}</p>
                  </div>
                  <div className="preset-footer">
                    <span className="preset-tag">{preset.tag}</span>
                    <span className="preset-btn">
                      Plan <ArrowRight size={13} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Recent Plans */}
          {recentPlans.length > 0 && (
            <section className="recent-plans-section">
              <div className="section-header">
                <h2>
                  <Clock size={18} color="#f59e0b" />
                  Recent Travel Plans
                </h2>
                <button className="btn-secondary" style={{ minHeight: '34px', padding: '0 12px', fontSize: '12px' }} onClick={onViewHistory}>
                  View all ({statistics.totalPlans})
                </button>
              </div>

              <div className="recent-plans-list">
                {recentPlans.map((plan) => {
                  const planId = plan.id || plan._id;
                  return (
                    <div key={planId} className="recent-plan-card">
                      <div className="plan-info">
                        <div className="plan-title-row">
                          <h4>{plan.destination}</h4>
                          <span className={`status-pill status-${plan.status || 'saved'}`}>
                            {plan.status || 'Saved'}
                          </span>
                        </div>
                        <div className="plan-meta-row">
                          <div className="plan-meta-item">
                            <Wallet size={13} />
                            <span>₹{plan.budget?.toLocaleString('en-IN')}</span>
                          </div>
                          <div className="plan-meta-item">
                            <Calendar size={13} />
                            <span>{plan.totalDays || plan.numberOfDays || 1} days</span>
                          </div>
                          <div className="plan-meta-item">
                            <Users size={13} />
                            <span>{plan.travelCompanionType || 'Solo'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="plan-actions-group">
                        <button
                          className="btn-primary"
                          style={{ minHeight: '36px', padding: '0 14px', fontSize: '13px' }}
                          onClick={() => onSelectItinerary(planId)}
                          title="View itinerary"
                        >
                          <Eye size={14} />
                          <span>View</span>
                        </button>
                        <button
                          className="btn-icon-action"
                          onClick={() => handleDuplicatePlan(planId)}
                          title="Duplicate plan"
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          className="btn-icon-action delete"
                          onClick={() => handleDeletePlan(planId, plan.destination)}
                          title="Delete plan"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* Sidebar Info & Travel Hacks */}
        <div className="dashboard-side-col">
          <div className="tips-sidebar-card">
            <h3>
              <Lightbulb size={18} color="#f59e0b" />
              Smart Travel Hacks
            </h3>
            <div className="tips-accordion">
              <div className="tip-accordion-item">
                <div className="tip-header">
                  <Zap size={14} />
                  <span>Student ID Discounts</span>
                </div>
                <p>Carry a college ID or ISIC card to get up to 30% off museum entries, trains, and monuments.</p>
              </div>

              <div className="tip-accordion-item">
                <div className="tip-header">
                  <ShieldCheck size={14} />
                  <span>Off-Peak Shoulder Dates</span>
                </div>
                <p>Traveling right before or after peak season slashes hotel & homestay rates by 40-50%.</p>
              </div>

              <div className="tip-accordion-item">
                <div className="tip-header">
                  <Compass size={14} />
                  <span>Local Public Transit</span>
                </div>
                <p>Use local state buses, shared jeeps, and metro passes instead of private cabs to stay well within budget.</p>
              </div>
            </div>
          </div>

          <div className="quick-stats-widget">
            <h4>💡 Travel Tip of the Day</h4>
            <ul>
              <li>
                <Sparkles size={14} />
                <span>Pack light (under 7kg) to skip check-in luggage fees.</span>
              </li>
              <li>
                <Sparkles size={14} />
                <span>Book train berths 15-30 days ahead for confirmed sleeper seats.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;

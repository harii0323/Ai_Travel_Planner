import React, { useState, useEffect } from 'react';
import api from './api';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import History from './components/History';
import Profile from './components/Profile';
import ItineraryForm from './components/ItineraryForm';
import ItineraryDisplay from './components/ItineraryDisplay';
import { 
  LayoutDashboard, 
  Compass, 
  History as HistoryIcon, 
  User as UserIcon, 
  LogOut, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  X,
  MapPin,
  PlaneTakeoff
} from 'lucide-react';
import './App.css';

function App() {
  // Authentication State
  const [authMode, setAuthMode] = useState(null); // 'login', 'register', null (checking)
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Navigation State
  const [currentPage, setCurrentPage] = useState('dashboard'); // dashboard, planner, history, profile
  const [selectedItineraryId, setSelectedItineraryId] = useState(null);
  const [plannerPreset, setPlannerPreset] = useState(null);

  // Planner State
  const [itinerary, setItinerary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Global Toasts State
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Check if user is already logged in on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
        setIsAuthenticated(true);

        // Set up Axios interceptor to include token in all requests
        api.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
      } catch (err) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    } else {
      setAuthMode('login');
    }
  }, []);

  const handleLoginSuccess = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    setIsAuthenticated(true);
    setAuthMode(null);
    setCurrentPage('dashboard');

    // Set up Axios default header
    api.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
    addToast(`Welcome back, ${userData?.name?.split(' ')[0] || 'Traveler'}! ✈️`, 'success');
  };

  const handleRegisterSuccess = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    setIsAuthenticated(true);
    setAuthMode(null);
    setCurrentPage('dashboard');

    // Set up Axios default header
    api.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
    addToast('Account created successfully! Welcome to VISTA 🎉', 'success');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
    setAuthMode('login');
    setCurrentPage('dashboard');

    // Remove Axios default header
    delete api.defaults.headers.common['Authorization'];
    addToast('You have been logged out safely.', 'info');
  };

  const handleProfileUpdate = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
    addToast('Profile preferences updated!', 'success');
  };

  const handleStartPlanning = (preset = null) => {
    setPlannerPreset(preset || null);
    setSelectedItineraryId(null);
    setItinerary(null);
    setCurrentPage('planner');
  };

  const handlePlannerSubmit = async (formData) => {
    setLoading(true);
    setError(null);
    setItinerary(null);

    try {
      const res = await api.post('/api/itinerary/generate', {
        ...formData,
        travelCompanionType: formData.travelCompanionType || user?.travelPreferences?.companionType || 'solo',
        numberOfTravelers: formData.numberOfTravelers || 1
      });
      // The backend wraps the itinerary in an "itinerary" field for /generate
      const planData = res.data.itinerary || res.data;
      setItinerary(planData);
      addToast(`Itinerary generated for ${formData.destination || 'your trip'}! 🗺️`, 'success');
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error || 'Failed to fetch itinerary. Please try again.';
      setError(errMsg);
      addToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectItinerary = async (id) => {
    setSelectedItineraryId(id);
    setCurrentPage('planner');
    setLoading(true);
    setError(null);
    setItinerary(null);

    try {
      const res = await api.get(`/api/history/${id}`);
      setItinerary(res.data.itinerary || res.data);
      addToast('Saved trip loaded!', 'info');
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error || 'Failed to load itinerary details. Please try again.';
      setError(errMsg);
      addToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Render Authentication Pages
  if (!isAuthenticated) {
    return (
      <>
        {authMode === 'register' ? (
          <Register
            onRegisterSuccess={handleRegisterSuccess}
            onSwitchToLogin={() => setAuthMode('login')}
          />
        ) : (
          <Login
            onLoginSuccess={handleLoginSuccess}
            onSwitchToRegister={() => setAuthMode('register')}
          />
        )}
        {/* Global Toasts */}
        <div className="toast-container">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast toast-${toast.type}`}>
              <div className="toast-icon">
                {toast.type === 'success' && <CheckCircle2 size={18} />}
                {toast.type === 'error' && <AlertCircle size={18} />}
                {toast.type === 'info' && <Info size={18} />}
              </div>
              <span className="toast-message">{toast.message}</span>
              <button className="toast-close" onClick={() => removeToast(toast.id)}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      </>
    );
  }

  const firstName = user?.name ? user.name.split(' ')[0] : 'Traveler';
  const userInitials = user?.name 
    ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'VI';

  // Render Authenticated App
  return (
    <div className="App">
      {/* Modern Glass Navigation Bar */}
      <nav className="app-navbar">
        <div className="navbar-content">
          <div className="navbar-brand" onClick={() => setCurrentPage('dashboard')}>
            <div className="brand-logo-wrap">
              <img 
                className="brand-logo" 
                src="/assets/vista-logo.png" 
                alt="VISTA logo" 
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.parentElement.innerHTML = '<span class="brand-logo-fallback">V</span>';
                }}
              />
            </div>
            <div className="brand-copy">
              <h1 className="brand-title">
                VISTA <span className="brand-badge">AI</span>
              </h1>
              <p className="brand-tagline">Smart student travel & budget planner</p>
            </div>
          </div>

          <div className="navbar-menu">
            <button
              className={`nav-item ${currentPage === 'dashboard' ? 'active' : ''}`}
              onClick={() => {
                setCurrentPage('dashboard');
                setItinerary(null);
              }}
            >
              <LayoutDashboard size={17} />
              <span>Dashboard</span>
            </button>
            <button
              className={`nav-item ${currentPage === 'planner' ? 'active' : ''}`}
              onClick={() => {
                setCurrentPage('planner');
                setItinerary(null);
                setSelectedItineraryId(null);
                setPlannerPreset(null);
              }}
            >
              <Compass size={17} />
              <span>Plan Trip</span>
            </button>
            <button
              className={`nav-item ${currentPage === 'history' ? 'active' : ''}`}
              onClick={() => {
                setCurrentPage('history');
              }}
            >
              <HistoryIcon size={17} />
              <span>History</span>
            </button>
            <button
              className={`nav-item ${currentPage === 'profile' ? 'active' : ''}`}
              onClick={() => {
                setCurrentPage('profile');
              }}
            >
              <UserIcon size={17} />
              <span>Profile</span>
            </button>
          </div>

          <div className="navbar-user">
            <div 
              className="user-chip" 
              onClick={() => setCurrentPage('profile')}
              title="View profile & travel style"
            >
              <div className="user-avatar">{userInitials}</div>
              <span className="user-greeting">{firstName}</span>
            </div>
            <button className="btn-logout" onClick={handleLogout} title="Log out of account">
              <LogOut size={15} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="app-main">
        {currentPage === 'dashboard' && (
          <Dashboard
            user={user}
            onStartPlanning={handleStartPlanning}
            onViewHistory={() => setCurrentPage('history')}
            onSelectItinerary={handleSelectItinerary}
            addToast={addToast}
          />
        )}

        {currentPage === 'planner' && (
          <div className="planner-container">
            <header className="planner-hero-header">
              <span className="eyebrow-badge">
                <Sparkles size={13} />
                AI Itinerary Engine
              </span>
              <h2>
                {selectedItineraryId 
                  ? 'Review & Customize Travel Plan' 
                  : 'Create Your Next Unforgettable Journey'}
              </h2>
              <p>
                {selectedItineraryId
                  ? 'Fine-tune your places, adjust timing, and export your ready-to-go travel schedule.'
                  : 'Tell us your budget, vibe, and dates. VISTA will craft a smart, weather-optimized, student-friendly route with realistic costs.'}
              </p>
            </header>

            <div className="planner-content">
              {!selectedItineraryId && (
                <ItineraryForm 
                  onSubmit={handlePlannerSubmit} 
                  initialPreset={plannerPreset}
                  userPreferences={user?.travelPreferences}
                />
              )}

              {loading && (
                <div className="loading-container">
                  <div className="ai-pulse-ring">
                    <div className="ai-pulse-icon">
                      <Sparkles size={24} />
                    </div>
                  </div>
                  <h3>Designing your custom itinerary...</h3>
                  <p>Analyzing routes, checking seasonal weather patterns, calculating student budgets, and curating top attractions.</p>
                  <div className="loading-progress-steps">
                    <span className="loading-step-chip active">
                      <MapPin size={13} /> Route mapping
                    </span>
                    <span className="loading-step-chip active">
                      <Sparkles size={13} /> Weather sync
                    </span>
                    <span className="loading-step-chip active">
                      <PlaneTakeoff size={13} /> Budget optimization
                    </span>
                  </div>
                </div>
              )}

              {error && (
                <div className="error-alert">
                  <AlertCircle size={22} className="error-alert-icon" />
                  <div className="error-alert-content">
                    <h3>Something went wrong</h3>
                    <p>{error}</p>
                  </div>
                  <button className="close" onClick={() => setError(null)}>
                    <X size={18} />
                  </button>
                </div>
              )}

              {itinerary && !loading && (
                <ItineraryDisplay 
                  data={itinerary} 
                  addToast={addToast}
                  onEditAnother={() => {
                    setSelectedItineraryId(null);
                    setItinerary(null);
                  }}
                />
              )}
            </div>
          </div>
        )}

        {currentPage === 'history' && (
          <History 
            onSelectItinerary={handleSelectItinerary} 
            addToast={addToast}
            onStartNewTrip={() => handleStartPlanning()}
          />
        )}

        {currentPage === 'profile' && (
          <Profile 
            user={user} 
            onProfileUpdate={handleProfileUpdate} 
            addToast={addToast}
          />
        )}
      </main>

      {/* Global Toast Notifications */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <div className="toast-icon">
              {toast.type === 'success' && <CheckCircle2 size={18} />}
              {toast.type === 'error' && <AlertCircle size={18} />}
              {toast.type === 'info' && <Info size={18} />}
            </div>
            <span className="toast-message">{toast.message}</span>
            <button className="toast-close" onClick={() => removeToast(toast.id)}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Modern Footer */}
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <Sparkles size={16} color="#14b8a6" />
            <span>VISTA AI Travel Planner</span>
          </div>
          <p>Plan smart. Travel farther. Built for budget-conscious students & adventurers.</p>
          <p className="disclaimer">
            Note: All estimated costs, routes, and weather suggestions are AI-generated based on current averages and student perks.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;

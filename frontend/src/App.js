import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import History from './components/History';
import Profile from './components/Profile';
import ItineraryForm from './components/ItineraryForm';
import ItineraryDisplay from './components/ItineraryDisplay';
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

  // Planner State
  const [itinerary, setItinerary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
        axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
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
    axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
  };

  const handleRegisterSuccess = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    setIsAuthenticated(true);
    setAuthMode(null);
    setCurrentPage('dashboard');

    // Set up Axios default header
    axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
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
    delete axios.defaults.headers.common['Authorization'];
  };

  const handleProfileUpdate = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const handlePlannerSubmit = async (formData) => {
    setLoading(true);
    setError(null);
    setItinerary(null);

    try {
      const res = await axios.post('http://localhost:5000/api/itinerary/generate', {
        ...formData,
        travelCompanionType: user?.travelPreferences?.companionType || 'solo',
        numberOfTravelers: formData.numberOfTravelers || 1
      });
      // The backend wraps the itinerary in an "itinerary" field for /generate
      setItinerary(res.data.itinerary || res.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to fetch itinerary. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Render Authentication Pages
  if (!isAuthenticated) {
    if (authMode === 'register') {
      return (
        <Register
          onRegisterSuccess={handleRegisterSuccess}
          onSwitchToLogin={() => setAuthMode('login')}
        />
      );
    }

    return (
      <Login
        onLoginSuccess={handleLoginSuccess}
        onSwitchToRegister={() => setAuthMode('register')}
      />
    );
  }

  // Render Authenticated App
  return (
    <div className="App">
      {/* Navigation Bar */}
      <nav className="app-navbar">
        <div className="navbar-content">
          <div className="navbar-brand">
            <h1 className="brand-title">✈️ Travel Planner</h1>
          </div>

          <div className="navbar-menu">
            <button
              className={`nav-item ${currentPage === 'dashboard' ? 'active' : ''}`}
              onClick={() => {
                setCurrentPage('dashboard');
                setItinerary(null);
              }}
            >
              📊 Dashboard
            </button>
            <button
              className={`nav-item ${currentPage === 'planner' ? 'active' : ''}`}
              onClick={() => {
                setCurrentPage('planner');
                setItinerary(null);
              }}
            >
              ✏️ Plan Trip
            </button>
            <button
              className={`nav-item ${currentPage === 'history' ? 'active' : ''}`}
              onClick={() => {
                setCurrentPage('history');
              }}
            >
              📚 History
            </button>
            <button
              className={`nav-item ${currentPage === 'profile' ? 'active' : ''}`}
              onClick={() => {
                setCurrentPage('profile');
              }}
            >
              👤 Profile
            </button>
          </div>

          <div className="navbar-user">
            <span className="user-greeting">Hi, {user?.name?.split(' ')[0]}!</span>
            <button className="btn-logout" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="app-main">
        {currentPage === 'dashboard' && (
          <Dashboard
            user={user}
            onStartPlanning={() => setCurrentPage('planner')}
            onViewHistory={() => setCurrentPage('history')}
          />
        )}

        {currentPage === 'planner' && (
          <div className="planner-container">
            <header className="planner-header">
              <h2>✏️ Create New Travel Plan</h2>
              <p>Let our AI create a personalized itinerary for your next adventure!</p>
            </header>

            <div className="planner-content">
              <ItineraryForm onSubmit={handlePlannerSubmit} />

              {loading && (
                <div className="loading-container">
                  <div className="spinner"></div>
                  <p>✨ Generating your personalized itinerary...</p>
                </div>
              )}

              {error && (
                <div className="error-alert">
                  <span className="close" onClick={() => setError(null)}>×</span>
                  <h3>❌ Error</h3>
                  <p>{error}</p>
                </div>
              )}

              {itinerary && !loading && <ItineraryDisplay data={itinerary} />}
            </div>
          </div>
        )}

        {currentPage === 'history' && (
          <History onSelectItinerary={(id) => {
            setSelectedItineraryId(id);
            setCurrentPage('planner');
          }} />
        )}

        {currentPage === 'profile' && (
          <Profile user={user} onProfileUpdate={handleProfileUpdate} />
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <p>💰 Plan Smart. Travel Farther. 🌍 Made for Budget-Conscious Students</p>
        <p className="disclaimer">Note: All costs are estimates. Actual prices may vary based on season and availability.</p>
      </footer>
    </div>
  );
}

export default App;
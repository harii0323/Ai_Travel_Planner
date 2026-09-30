import React, { useState, useEffect } from 'react';
import api from './api';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import History from './components/History';
import Profile from './components/Profile';
import ItineraryForm from './components/ItineraryForm';
import ItineraryDisplay from './components/ItineraryDisplay';
import SmartPlanningLoader from './components/SmartPlanningLoader';
import CarpoolModal from './components/CarpoolModal';
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
  PlaneTakeoff,
  Car,
  Users,
  Map,
  Search,
  Menu,
  ChevronRight
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

  // Responsive & Interactive Nav State (Requirement #21)
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCarpoolModalOpen, setIsCarpoolModalOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navigateAndScroll = (page, anchorId = null) => {
    setIsMobileMenuOpen(false);
    if (currentPage !== page) {
      setCurrentPage(page);
      if (anchorId) {
        setTimeout(() => {
          const el = document.getElementById(anchorId);
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 150);
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else if (anchorId) {
      const el = document.getElementById(anchorId);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

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
      {/* Modern Sticky Glass Navigation Bar with Scroll Blur & Shadow (Req #21) */}
      <nav className={`app-navbar ${isScrolled ? 'navbar-scrolled' : ''}`}>
        <div className="navbar-content">
          <div className="navbar-brand" onClick={() => navigateAndScroll('dashboard')}>
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
              <p className="brand-tagline">AI Travel Planner & Real-Time Cost Calculator</p>
            </div>
          </div>

          {/* Desktop Navigation Links (Req #21) */}
          <div className="navbar-menu">
            <button
              className={`nav-item ${currentPage === 'dashboard' ? 'active' : ''}`}
              onClick={() => navigateAndScroll('dashboard', 'destinations')}
            >
              <Search size={16} />
              <span>Explore</span>
            </button>
            <button
              className={`nav-item ${currentPage === 'planner' && !itinerary ? 'active' : ''}`}
              onClick={() => {
                setSelectedItineraryId(null);
                setItinerary(null);
                setPlannerPreset(null);
                navigateAndScroll('planner');
              }}
            >
              <Compass size={16} />
              <span>Plan Trip</span>
            </button>
            <button
              className={`nav-item ${currentPage === 'planner' && itinerary ? 'active' : ''}`}
              onClick={() => {
                if (itinerary) {
                  navigateAndScroll('planner');
                } else {
                  addToast('Create a trip first or load one from My Trips!', 'info');
                  navigateAndScroll('planner');
                }
              }}
            >
              <Map size={16} />
              <span>Itinerary</span>
            </button>
            <button
              className="nav-item"
              onClick={() => navigateAndScroll('dashboard', 'car-rental-section')}
            >
              <Car size={16} />
              <span>Cars</span>
            </button>
            <button
              className="nav-item"
              onClick={() => {
                setIsMobileMenuOpen(false);
                setIsCarpoolModalOpen(true);
              }}
            >
              <Users size={16} />
              <span>Carpool</span>
            </button>
            <button
              className={`nav-item ${currentPage === 'history' ? 'active' : ''}`}
              onClick={() => navigateAndScroll('history')}
            >
              <HistoryIcon size={16} />
              <span>My Trips</span>
            </button>
            <button
              className={`nav-item ${currentPage === 'profile' ? 'active' : ''}`}
              onClick={() => navigateAndScroll('profile')}
            >
              <UserIcon size={16} />
              <span>Profile</span>
            </button>
          </div>

          {/* User Status & Mobile Toggle */}
          <div className="navbar-user">
            <div 
              className="user-chip" 
              onClick={() => navigateAndScroll('profile')}
              title="View profile & travel style"
            >
              <div className="user-avatar">{userInitials}</div>
              <span className="user-greeting">{firstName}</span>
            </div>
            <button className="btn-logout" onClick={handleLogout} title="Log out of account">
              <LogOut size={15} />
              <span>Logout</span>
            </button>
            <button 
              className="btn-mobile-toggle" 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle navigation drawer"
            >
              {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Polished Animated Mobile Drawer Navigation (Req #21) */}
        {isMobileMenuOpen && (
          <div className="mobile-nav-drawer">
            <div className="mobile-nav-backdrop" onClick={() => setIsMobileMenuOpen(false)} />
            <div className="mobile-nav-pane">
              <div className="mobile-nav-header">
                <div className="user-chip" onClick={() => navigateAndScroll('profile')}>
                  <div className="user-avatar">{userInitials}</div>
                  <div className="mobile-user-meta">
                    <span className="user-greeting">{user?.name || 'Traveler'}</span>
                    <span className="user-subtext">{user?.email || 'Explorer Account'}</span>
                  </div>
                </div>
                <button className="mobile-nav-close" onClick={() => setIsMobileMenuOpen(false)}>
                  <X size={18} />
                </button>
              </div>

              <div className="mobile-nav-links">
                <button
                  className={`mobile-nav-item ${currentPage === 'dashboard' ? 'active' : ''}`}
                  onClick={() => navigateAndScroll('dashboard', 'destinations')}
                >
                  <div className="nav-item-icon-wrap"><Search size={18} /></div>
                  <span>Explore Destinations</span>
                  <ChevronRight size={16} className="nav-arrow" />
                </button>
                <button
                  className={`mobile-nav-item ${currentPage === 'planner' && !itinerary ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedItineraryId(null);
                    setItinerary(null);
                    setPlannerPreset(null);
                    navigateAndScroll('planner');
                  }}
                >
                  <div className="nav-item-icon-wrap"><Compass size={18} /></div>
                  <span>Plan Trip</span>
                  <ChevronRight size={16} className="nav-arrow" />
                </button>
                <button
                  className={`mobile-nav-item ${currentPage === 'planner' && itinerary ? 'active' : ''}`}
                  onClick={() => {
                    if (itinerary) {
                      navigateAndScroll('planner');
                    } else {
                      addToast('Create a trip first or load one from My Trips!', 'info');
                      navigateAndScroll('planner');
                    }
                  }}
                >
                  <div className="nav-item-icon-wrap"><Map size={18} /></div>
                  <span>Itinerary</span>
                  <ChevronRight size={16} className="nav-arrow" />
                </button>
                <button
                  className="mobile-nav-item"
                  onClick={() => navigateAndScroll('dashboard', 'car-rental-section')}
                >
                  <div className="nav-item-icon-wrap"><Car size={18} /></div>
                  <span>Car Rental (A6 Cars)</span>
                  <ChevronRight size={16} className="nav-arrow" />
                </button>
                <button
                  className="mobile-nav-item"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsCarpoolModalOpen(true);
                  }}
                >
                  <div className="nav-item-icon-wrap"><Users size={18} /></div>
                  <span>Carpool & Ride Sharing</span>
                  <ChevronRight size={16} className="nav-arrow" />
                </button>
                <button
                  className={`mobile-nav-item ${currentPage === 'history' ? 'active' : ''}`}
                  onClick={() => navigateAndScroll('history')}
                >
                  <div className="nav-item-icon-wrap"><HistoryIcon size={18} /></div>
                  <span>My Trips</span>
                  <ChevronRight size={16} className="nav-arrow" />
                </button>
                <button
                  className={`mobile-nav-item ${currentPage === 'profile' ? 'active' : ''}`}
                  onClick={() => navigateAndScroll('profile')}
                >
                  <div className="nav-item-icon-wrap"><UserIcon size={18} /></div>
                  <span>Profile & Preferences</span>
                  <ChevronRight size={16} className="nav-arrow" />
                </button>
              </div>

              <div className="mobile-nav-footer">
                <button className="btn-logout-full" onClick={handleLogout}>
                  <LogOut size={16} />
                  <span>Log Out of VISTA</span>
                </button>
              </div>
            </div>
          </div>
        )}
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
                  : 'Tell us your budget, vehicle, companions, and dates. VISTA will calculate real-world travel costs with fuel, tolls, and optimized routing.'}
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
                <SmartPlanningLoader 
                  destination={plannerPreset?.destination || 'your destination'} 
                  days={plannerPreset?.days || 5} 
                />
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
                  details={itinerary?.details}
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

      {/* Global Carpooling Network Modal (Requirement #19) */}
      {isCarpoolModalOpen && (
        <CarpoolModal
          isOpen={isCarpoolModalOpen}
          onClose={() => setIsCarpoolModalOpen(false)}
          addToast={addToast}
        />
      )}

      {/* Modern Footer */}
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <Sparkles size={16} color="#14b8a6" />
            <span>VISTA AI Travel Planner</span>
          </div>
          <p>Plan smart. Travel farther. Real-world route cost calculation and intelligent itinerary optimization.</p>
          <p className="disclaimer">
            Note: All estimated costs, tolls, and routes are calculated from real-world benchmarks (NHAI FASTag, IOCL/BPCL fuel tariffs, verified hotel benchmarks, and regional menus).
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;

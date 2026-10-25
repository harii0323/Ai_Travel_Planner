import React, { useState, useEffect } from 'react';
import api from '../api';
import '../styles/Dashboard.css';
import DestinationModal from './DestinationModal';
import CarpoolModal from './CarpoolModal';
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
  Clock,
  Car,
  Route,
  ChevronRight,
  KeyRound,
  ExternalLink,
  Layers,
  Fuel,
  Search,
  Filter,
  Star,
  Coffee,
  Check
} from 'lucide-react';

const POPULAR_DESTINATIONS = [
  {
    id: 'kerala',
    destination: 'Munnar & Alleppey, Kerala',
    startLocation: 'Bangalore',
    emoji: '🌴',
    title: 'Kerala Backwaters & Tea Valleys',
    description: 'Verdant rolling tea estates, serene private houseboats, spice plantations, and Ayurvedic retreats.',
    image: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=800&auto=format&fit=crop',
    budget: 9500,
    days: 5,
    companion: 'couple',
    tag: 'Serene Nature',
    category: 'Nature & Hills',
    rating: 4.9,
    bestSeason: 'Sep – Mar',
    distance: '480 km from Bangalore',
    activities: 'nature, relaxation, photography',
    transport: 'train',
    accommodation: 'homestay',
    highlights: ['Tea Museum & Lockhart Gap', 'Alleppey Backwaters Houseboat', 'Marari Beach Sunset', 'Kathakali Cultural Center']
  },
  {
    id: 'goa',
    destination: 'Goa',
    startLocation: 'Mumbai',
    emoji: '🏖️',
    title: 'Goa Golden Coast & Forts',
    description: 'Pristine beaches, Portuguese colonial architecture, watersports, beach shacks, and sunset cruises.',
    image: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800&auto=format&fit=crop',
    budget: 6500,
    days: 4,
    companion: 'friends',
    tag: 'Beach & Coastal',
    category: 'Beach & Culture',
    rating: 4.8,
    bestSeason: 'Nov – Feb',
    distance: '590 km from Mumbai',
    activities: 'nature, food, relaxation',
    transport: 'train',
    accommodation: 'hostel',
    highlights: ['Aguada & Chapora Forts', 'Anjuna & Palolem Beach', 'Old Goa Basilica', 'Mandovi River Cruise']
  },
  {
    id: 'manali',
    destination: 'Manali, Himachal Pradesh',
    startLocation: 'Delhi',
    emoji: '🏔️',
    title: 'Manali Alpine Wonderland',
    description: 'Snow-clad Himalayan peaks, Rohtang & Solang valley adventures, cedar forests, and vibrant cafes.',
    image: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800&auto=format&fit=crop',
    budget: 8500,
    days: 5,
    companion: 'friends',
    tag: 'High Mountains',
    category: 'Adventure & Snow',
    rating: 4.9,
    bestSeason: 'Oct – Jun',
    distance: '530 km from Delhi',
    activities: 'adventure, trekking, photography',
    transport: 'bus',
    accommodation: 'homestay',
    highlights: ['Solang Valley Paragliding', 'Atal Tunnel & Sissu Falls', 'Old Manali Apple Orchards', 'Hadimba Devi Temple']
  },
  {
    id: 'jaipur',
    destination: 'Jaipur, Rajasthan',
    startLocation: 'Delhi',
    emoji: '🏰',
    title: 'Jaipur Royal Pink City',
    description: 'Majestic hill forts, ornate Rajput palaces, vibrant textile bazaars, and legendary royal cuisine.',
    image: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=800&auto=format&fit=crop',
    budget: 4800,
    days: 3,
    companion: 'solo',
    tag: 'Royal Heritage',
    category: 'Culture & History',
    rating: 4.8,
    bestSeason: 'Oct – Mar',
    distance: '280 km from Delhi',
    activities: 'cultural, food, photography',
    transport: 'train',
    accommodation: 'budgetHotel',
    highlights: ['Amber Fort & Sheesh Mahal', 'Hawa Mahal & City Palace', 'Nahargarh Sunset Point', 'Johari Bazaar Jewellery']
  },
  {
    id: 'rishikesh',
    destination: 'Rishikesh, Uttarakhand',
    startLocation: 'Delhi',
    emoji: '🌊',
    title: 'Rishikesh Rapids & Yoga',
    description: 'White-water rafting along the emerald Ganga, Himalayan cliff jumps, riverside camping, and Ganga Aarti.',
    image: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800&auto=format&fit=crop',
    budget: 5200,
    days: 3,
    companion: 'friends',
    tag: 'River Adventure',
    category: 'Adventure & Wellness',
    rating: 4.7,
    bestSeason: 'Sep – Nov, Mar – May',
    distance: '240 km from Delhi',
    activities: 'adventure, camping, trekking',
    transport: 'bus',
    accommodation: 'hostel',
    highlights: ['Grade III/IV River Rafting', 'Triveni Ghat Evening Aarti', 'Beatles Ashram Murals', 'Neer Garh Waterfall Hike']
  },
  {
    id: 'ladakh',
    destination: 'Leh Ladakh',
    startLocation: 'Chandigarh',
    emoji: '🏍️',
    title: 'Ladakh High Pass Odyssey',
    description: 'World highest motorable passes, color-shifting Pangong Tso, Buddhist gompas, and desert mountain vistas.',
    image: 'https://images.unsplash.com/photo-1581793745862-99fde7fa73d2?w=800&auto=format&fit=crop',
    budget: 16500,
    days: 7,
    companion: 'friends',
    tag: 'Epic Road Trip',
    category: 'Road Trip & Heights',
    rating: 5.0,
    bestSeason: 'Jun – Sep',
    distance: '780 km from Chandigarh',
    activities: 'adventure, photography, camping',
    transport: 'ownTransport',
    accommodation: 'budgetHotel',
    highlights: ['Khardung La (17,982 ft)', 'Pangong Tso Camping', 'Nubra Valley Sand Dunes', 'Magnetic Hill & Sangam']
  },
  {
    id: 'varanasi',
    destination: 'Varanasi, Uttar Pradesh',
    startLocation: 'Delhi',
    emoji: '🛕',
    title: 'Varanasi Sacred Ghats & Heritage',
    description: 'Centuries-old Ganga ghats, evening Maha Aarti at Dashashwamedh, Sarnath Buddhist park, and silk weaving quarters.',
    image: 'https://images.unsplash.com/photo-1561361513-2d000a50f0dc?w=800&auto=format&fit=crop',
    budget: 4200,
    days: 3,
    companion: 'family',
    tag: 'Spiritual & Cultural',
    category: 'Culture & History',
    rating: 4.8,
    bestSeason: 'Oct – Mar',
    distance: '820 km from Delhi (Vande Bharat connected)',
    activities: 'culture, spiritual, food, photography',
    transport: 'train',
    accommodation: 'homestay',
    highlights: ['Dashashwamedh Ghat Evening Aarti', 'Sarnath Deer Park & Stupa', 'Sunrise Boat Ride on Ganges', 'Kashi Vishwanath Corridor']
  },
  {
    id: 'gokarna',
    destination: 'Gokarna, Karnataka',
    startLocation: 'Bangalore',
    emoji: '🌊',
    title: 'Gokarna Coastal Trail & Cliff Beaches',
    description: 'Pristine cliffside beaches, Om Beach rock formations, beach trekking between coves, and quiet seaside cafes.',
    image: 'https://images.unsplash.com/photo-1590523741831-ab7e8b8f9c7f?w=800&auto=format&fit=crop',
    budget: 5400,
    days: 3,
    companion: 'solo',
    tag: 'Coastal Trek',
    category: 'Beach & Culture',
    rating: 4.8,
    bestSeason: 'Oct – Mar',
    distance: '490 km from Bangalore',
    activities: 'beach, trekking, photography, relaxation',
    transport: 'train',
    accommodation: 'hostel',
    highlights: ['Om Beach to Kudle Beach Trek', 'Half Moon & Paradise Beach Coves', 'Mahabaleshwar Temple', 'Mirjan Fort Transit']
  }
];

const SAMPLE_ROUTES = [
  {
    from: 'Hyderabad',
    to: 'Kerala (Munnar)',
    distance: '1,020 km',
    duration: '18h drive / Direct Train',
    tolls: '₹950 FASTag',
    highlights: 'NH44 Expressway • Bangalore Transit • Western Ghats ascent'
  },
  {
    from: 'Delhi',
    to: 'Manali, HP',
    distance: '530 km',
    duration: '11h drive / AC Volvo',
    tolls: '₹480 FASTag',
    highlights: 'Chandigarh Bypass • Kiratpur-Nerchowk 4-lane • Beas River corridor'
  },
  {
    from: 'Mumbai',
    to: 'Goa (Panaji)',
    distance: '590 km',
    duration: '10h drive / Vande Bharat',
    tolls: '₹620 FASTag',
    highlights: 'Samruddhi Mahamarg link • Pune Expressway • Chorla Ghat'
  }
];

const CAR_FLEET_PREVIEWS = [
  {
    name: 'Maruti Suzuki Swift',
    type: 'Hatchback',
    seats: 5,
    fuel: 'Petrol (22.4 km/L)',
    pricePerDay: 1350,
    deposit: 3000,
    image: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=600&auto=format&fit=crop'
  },
  {
    name: 'Hyundai Creta SX',
    type: 'SUV',
    seats: 5,
    fuel: 'Diesel (19.1 km/L)',
    pricePerDay: 2400,
    deposit: 5000,
    image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600&auto=format&fit=crop'
  },
  {
    name: 'Toyota Innova Crysta',
    type: 'Premium MUV',
    seats: 7,
    fuel: 'Diesel (13.5 km/L)',
    pricePerDay: 3200,
    deposit: 6000,
    image: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=600&auto=format&fit=crop'
  },
  {
    name: 'Tata Nexon EV Long Range',
    type: 'Electric SUV',
    seats: 5,
    fuel: 'Electric (310 km Range)',
    pricePerDay: 2100,
    deposit: 4500,
    image: 'https://images.unsplash.com/photo-1563720223185-11003d516935?w=600&auto=format&fit=crop'
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

  // Interactive Modals State
  const [selectedDestinationForModal, setSelectedDestinationForModal] = useState(null);
  const [isCarpoolModalOpen, setIsCarpoolModalOpen] = useState(false);
  const [destinationFilter, setDestinationFilter] = useState('All');

  // Quick Inline Planner Inputs in Hero
  const [quickSearch, setQuickSearch] = useState({
    origin: 'Hyderabad',
    destination: 'Kerala',
    days: 5,
    budget: 15000,
    travelers: 2
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setLoading(false);
          return;
        }

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
      } catch (error) {
        if (error.response?.status === 401) {
          // Token expired or invalid; reset state for guest experience
          setStatistics({ totalPlans: 0, savedPlans: 0, completedTrips: 0, averageBudget: 0 });
          setRecentPlans([]);
        } else {
          console.warn('Dashboard data sync notice:', error.message);
        }
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

  const handleQuickPlanSubmit = (e) => {
    e.preventDefault();
    onStartPlanning({
      startLocation: quickSearch.origin,
      destination: quickSearch.destination,
      days: Number(quickSearch.days) || 4,
      budget: Number(quickSearch.budget) || 15000,
      numberOfTravelers: Number(quickSearch.travelers) || 2
    });
  };

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });

  const spotlightTrip = recentPlans.find((p) => p.status === 'saved' || p.plannedTravelDate) || recentPlans[0];

  const filteredDestinations = destinationFilter === 'All'
    ? POPULAR_DESTINATIONS
    : POPULAR_DESTINATIONS.filter(d => {
        if (destinationFilter === 'Solo & Couple') return d.companion === 'solo' || d.companion === 'couple';
        if (destinationFilter === 'Family & Group') return d.companion === 'friends' || d.companion === 'family';
        if (destinationFilter === 'Budget Trips') return (d.budget || 0) <= 6500;
        if (destinationFilter === 'Road Trips') return (d.tag || '').includes('Road') || d.transport === 'ownTransport';
        if (destinationFilter === 'Spiritual & Heritage') return (d.category || '').includes('Culture') || (d.category || '').includes('History') || (d.tag || '').includes('Spiritual');
        if (destinationFilter === 'Nature & Hills') return (d.category || '').includes('Nature') || (d.category || '').includes('Hills') || (d.category || '').includes('Snow');
        if (destinationFilter === 'Beach & Coastal') return (d.category || '').includes('Beach');
        return (d.category || '').includes(destinationFilter);
      });

  return (
    <div className="dashboard-container">
      {/* =========================================================================
          1. ADVANCED HERO SECTION (Requirement #6)
          ========================================================================= */}
      <section className="dashboard-hero">
        <div className="dashboard-hero-content">
          <div className="hero-date-badge">
            <Sparkles size={13} />
            <span>{todayFormatted} • Intelligent Travel Companion</span>
          </div>

          <h1 style={{ fontSize: 'clamp(30px, 4.5vw, 46px)', fontWeight: 900, lineHeight: 1.15, letterSpacing: '-0.02em', marginBottom: '14px' }}>
            Plan your route, compare estimated costs, and find worthwhile stops along the way.
          </h1>
          <p style={{ fontSize: '16px', color: 'var(--ink-muted, #786b60)', maxWidth: '640px', lineHeight: 1.6, marginBottom: '28px' }}>
            Calculate road-trip fuel tariffs, NHAI FASTag toll rates, verified accommodation benchmarks, and day-by-day itineraries tailored to your travel style.
          </p>

          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn-primary" onClick={() => onStartPlanning()} style={{ minHeight: '48px', padding: '0 26px', fontSize: '15px' }}>
              <Compass size={18} />
              <span>Plan My Trip</span>
            </button>
            <a href="#destinations" className="btn-secondary" style={{ minHeight: '48px', padding: '0 22px', fontSize: '15px' }}>
              <MapPin size={18} />
              <span>Explore Destinations</span>
            </a>
          </div>
        </div>

        {/* Floating Quick Planning Card inside Hero */}
        <div className="dashboard-hero-actions" style={{ maxWidth: '420px', width: '100%' }}>
          <form 
            onSubmit={handleQuickPlanSubmit}
            style={{
              background: '#ffffff',
              padding: '24px',
              borderRadius: 'var(--radius-md, 18px)',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--surface-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--surface-border)', paddingBottom: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--brand-primary, #c26d38)', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Zap size={14} /> Instant Itinerary Builder
              </span>
              <span style={{ fontSize: '11px', color: 'var(--ink-muted, #786b60)' }}>AI Engine</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ink-muted, #786b60)' }}>Where From?</label>
                <input
                  type="text"
                  value={quickSearch.origin}
                  onChange={(e) => setQuickSearch({ ...quickSearch, origin: e.target.value })}
                  style={{ width: '100%', minHeight: '38px', padding: '0 10px', fontSize: '13px', background: 'var(--surface-soft)', border: '1px solid var(--surface-border)', borderRadius: '8px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ink-muted, #786b60)' }}>Destination</label>
                <input
                  type="text"
                  value={quickSearch.destination}
                  onChange={(e) => setQuickSearch({ ...quickSearch, destination: e.target.value })}
                  style={{ width: '100%', minHeight: '38px', padding: '0 10px', fontSize: '13px', background: 'var(--surface-soft)', border: '1px solid var(--surface-border)', borderRadius: '8px' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ink-muted, #786b60)' }}>Days</label>
                <input
                  type="number"
                  min="1"
                  max="14"
                  value={quickSearch.days}
                  onChange={(e) => setQuickSearch({ ...quickSearch, days: e.target.value })}
                  style={{ width: '100%', minHeight: '38px', padding: '0 8px', fontSize: '13px', background: 'var(--surface-soft)', border: '1px solid var(--surface-border)', borderRadius: '8px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ink-muted, #786b60)' }}>Travelers</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={quickSearch.travelers}
                  onChange={(e) => setQuickSearch({ ...quickSearch, travelers: e.target.value })}
                  style={{ width: '100%', minHeight: '38px', padding: '0 8px', fontSize: '13px', background: 'var(--surface-soft)', border: '1px solid var(--surface-border)', borderRadius: '8px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ink-muted, #786b60)' }}>Budget (₹)</label>
                <input
                  type="number"
                  step="1000"
                  value={quickSearch.budget}
                  onChange={(e) => setQuickSearch({ ...quickSearch, budget: e.target.value })}
                  style={{ width: '100%', minHeight: '38px', padding: '0 8px', fontSize: '13px', background: 'var(--surface-soft)', border: '1px solid var(--surface-border)', borderRadius: '8px' }}
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ minHeight: '42px', marginTop: '6px', fontSize: '13px', display: 'flex', justifyContent: 'center' }}>
              <span>Generate Itinerary</span>
              <ArrowRight size={15} />
            </button>
          </form>
        </div>
      </section>

      {/* =========================================================================
          2. STATISTICS & LIVE COUNTERS
          ========================================================================= */}
      <section className="statistics-grid">
        <div className="stat-card">
          <div className="stat-icon-wrap trips">
            <Compass size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{loading ? '...' : statistics.totalPlans}</span>
            <span className="stat-label">Total Itineraries</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrap saved">
            <BookmarkCheck size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{loading ? '...' : statistics.savedPlans}</span>
            <span className="stat-label">Saved Trips</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrap completed">
            <CheckCircle2 size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{loading ? '...' : statistics.completedTrips}</span>
            <span className="stat-label">Completed Trips</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrap budget">
            <Wallet size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-value">₹{loading ? '0' : statistics.averageBudget.toLocaleString('en-IN')}</span>
            <span className="stat-label">Average Trip Budget</span>
          </div>
        </div>
      </section>

      {/* =========================================================================
          3. INTERACTIVE DESTINATION EXPLORER (Requirement #9)
          ========================================================================= */}
      <section id="destinations" style={{ marginBottom: '48px' }}>
        <div className="section-header-row">
          <div className="section-title-wrap">
            <span className="pill-badge pill-badge-brand" style={{ marginBottom: '6px' }}>
              <MapPin size={12} />
              <span>Interactive Discovery</span>
            </span>
            <h3>Popular Travel Destinations</h3>
            <p>Curated hotspots across India with verified benchmarks, attractions, and optimal routes.</p>
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {['All', 'Solo & Couple', 'Family & Group', 'Budget Trips', 'Road Trips', 'Spiritual & Heritage', 'Nature & Hills', 'Beach & Coastal'].map((filter) => (
              <button
                key={filter}
                className={`history-pill ${destinationFilter === filter ? 'active' : ''}`}
                onClick={() => setDestinationFilter(filter)}
                style={{ fontSize: '12px', padding: '5px 12px' }}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="presets-grid">
          {filteredDestinations.map((dest) => (
            <div
              key={dest.id}
              className="preset-card"
              style={{ backgroundImage: `url(${dest.image})` }}
              onClick={() => setSelectedDestinationForModal(dest)}
            >
              <div className="preset-top-badges">
                <span className="preset-badge">★ {dest.rating}</span>
                <span className="preset-tag">{dest.tag}</span>
              </div>

              <div className="preset-bottom-content">
                <span style={{ fontSize: '11px', color: '#fef08a', fontWeight: 800, textTransform: 'uppercase' }}>
                  {dest.bestSeason} • {dest.days} Days
                </span>
                <h4>{dest.title}</h4>
                <p>{dest.description}</p>
                <div className="preset-footer-row">
                  <span>~₹{dest.budget?.toLocaleString('en-IN')} est.</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#ffffff' }}>
                    Explore <ArrowRight size={13} />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* =========================================================================
          4. HOW AI PLANNING WORKS (Requirement #5)
          ========================================================================= */}
      <section style={{
        marginBottom: '48px',
        padding: '36px 40px',
        background: 'var(--surface-soft, #f4eee2)',
        borderRadius: 'var(--radius-lg, 24px)',
        border: '1px solid var(--surface-border)'
      }}>
        <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto 32px' }}>
          <span className="pill-badge pill-badge-brand" style={{ marginBottom: '8px' }}>
            <Sparkles size={12} />
            <span>Intelligent Architecture</span>
          </span>
          <h3 style={{ fontSize: '24px', fontWeight: 900, color: 'var(--ink-heading, #1c140e)' }}>
            How AI Travel Planning Works
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--ink-muted, #786b60)' }}>
            From your preliminary budget to an hour-by-hour route schedule optimized for traffic, tolls, and daylight.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '20px'
        }}>
          {[
            {
              step: '01',
              title: 'Express Preferences',
              desc: 'Select source city, dates, companions, vehicle type, and budget comfort ceiling.',
              icon: Compass
            },
            {
              step: '02',
              title: 'Highway & Toll Routing',
              desc: 'Algorithms compute exact NHAI FASTag toll plazas, fuel mileage, and optimal road corridors.',
              icon: Route
            },
            {
              step: '03',
              title: 'Visit Window Sync',
              desc: 'Arranges outdoor viewpoints for morning, museums for afternoons, and sunsets by dusk.',
              icon: Clock
            },
            {
              step: '04',
              title: 'Export & Travel',
              desc: 'Review interactive day timelines, customize stops, save to history, or export print-ready PDFs.',
              icon: CheckCircle2
            }
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <div 
                key={idx}
                style={{
                  padding: '22px',
                  background: '#ffffff',
                  borderRadius: 'var(--radius-md, 16px)',
                  border: '1px solid var(--surface-border)',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    background: 'var(--brand-gradient)',
                    color: '#ffffff',
                    display: 'grid',
                    placeItems: 'center'
                  }}>
                    <Icon size={20} />
                  </div>
                  <span style={{ fontSize: '20px', fontWeight: 900, color: 'rgba(194, 109, 56, 0.25)' }}>
                    {item.step}
                  </span>
                </div>
                <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--ink-heading, #1c140e)', marginBottom: '6px' }}>
                  {item.title}
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--ink-muted, #786b60)', lineHeight: 1.5 }}>
                  {item.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* =========================================================================
          5. INTERACTIVE ROUTE PREVIEW & MAP SHOWCASE (Requirement #10)
          ========================================================================= */}
      <section style={{ marginBottom: '48px' }}>
        <div className="section-header-row">
          <div className="section-title-wrap">
            <span className="pill-badge pill-badge-azure" style={{ marginBottom: '6px' }}>
              <Route size={12} />
              <span>Route Intelligence</span>
            </span>
            <h3>Interactive Highway Corridors</h3>
            <p>Real-world benchmark distances, highway toll charges, and waypoint transit stops.</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {SAMPLE_ROUTES.map((route, idx) => (
            <div 
              key={idx} 
              style={{
                padding: '24px',
                background: '#ffffff',
                border: '1px solid var(--surface-border)',
                borderRadius: 'var(--radius-md, 18px)',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '14px'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <strong style={{ fontSize: '16px', color: 'var(--ink-heading, #1c140e)' }}>{route.from}</strong>
                  <ArrowRight size={15} color="var(--brand-primary, #c26d38)" />
                  <strong style={{ fontSize: '16px', color: 'var(--brand-primary, #c26d38)' }}>{route.to}</strong>
                </div>

                <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--ink-muted, #786b60)', marginBottom: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700 }}>🚗 {route.distance}</span>
                  <span>⏱ {route.duration}</span>
                  <span style={{ color: 'var(--emerald-500, #10b981)', fontWeight: 700 }}>💳 {route.tolls}</span>
                </div>

                <p style={{ fontSize: '12px', color: 'var(--ink-muted, #786b60)', lineHeight: 1.4 }}>
                  {route.highlights}
                </p>
              </div>

              <button 
                type="button" 
                className="btn-secondary"
                onClick={() => onStartPlanning({ startLocation: route.from, destination: route.to.split(' ')[0] })}
                style={{ minHeight: '38px', fontSize: '12px', justifyContent: 'center' }}
              >
                <span>Plan This Route</span>
                <ChevronRight size={14} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* =========================================================================
          6. CAR RENTAL EXPERIENCE (Requirement #18)
          ========================================================================= */}
      <section id="car-rental-section" style={{ marginBottom: '48px' }}>
        <div className="section-header-row">
          <div className="section-title-wrap">
            <span className="pill-badge pill-badge-emerald" style={{ marginBottom: '6px' }}>
              <KeyRound size={12} />
              <span>Self-Drive Fleet</span>
            </span>
            <h3>Rental Vehicles from A6 Cars</h3>
            <p>Verified rental vehicles with transparent daily tariffs, security deposit terms, and direct pickup.</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
          {CAR_FLEET_PREVIEWS.map((car, idx) => (
            <div 
              key={idx}
              style={{
                background: '#ffffff',
                borderRadius: 'var(--radius-md, 16px)',
                overflow: 'hidden',
                border: '1px solid var(--surface-border)',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <div style={{ height: '150px', position: 'relative' }}>
                <img 
                  src={car.image} 
                  alt={car.name} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
                <span style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  background: 'rgba(0, 0, 0, 0.75)',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: '9999px'
                }}>
                  {car.type}
                </span>
              </div>

              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--ink-heading, #1c140e)' }}>
                    {car.name}
                  </h4>
                  <div style={{ display: 'flex', gap: '10px', fontSize: '12px', color: 'var(--ink-muted, #786b60)', marginTop: '4px' }}>
                    <span>👥 {car.seats} Seats</span>
                    <span>⛽ {car.fuel}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid var(--surface-border)' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--ink-muted, #786b60)' }}>Daily Tariff</span>
                    <strong style={{ display: 'block', fontSize: '16px', color: 'var(--brand-primary, #c26d38)' }}>
                      ₹{car.pricePerDay}/day
                    </strong>
                  </div>

                  <button 
                    type="button" 
                    className="btn-primary" 
                    style={{ minHeight: '36px', padding: '0 14px', fontSize: '12px' }}
                    onClick={() => {
                      onStartPlanning({ transport: 'selfDriveRentalCar' });
                      if (addToast) addToast(`Selected ${car.name} for your upcoming plan! 🚗`, 'info');
                    }}
                  >
                    Select Car
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* =========================================================================
          7. CARPOOLING EXPERIENCE — TRAVEL TOGETHER (Requirement #19)
          ========================================================================= */}
      <section id="carpool-section" style={{
        marginBottom: '48px',
        padding: '36px 40px',
        background: 'linear-gradient(135deg, #f7f2ea 0%, #fcf9f4 100%)',
        border: '1px solid var(--surface-border)',
        borderRadius: 'var(--radius-lg, 24px)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '28px',
        flexWrap: 'wrap'
      }}>
        <div style={{ maxWidth: '600px' }}>
          <span className="pill-badge pill-badge-emerald" style={{ marginBottom: '8px' }}>
            <Users size={12} />
            <span>Community Ride Sharing</span>
          </span>
          <h3 style={{ fontSize: '26px', fontWeight: 900, color: 'var(--ink-heading, #1c140e)', marginBottom: '8px' }}>
            Carpooling and Cost Sharing
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--ink-muted, #786b60)', lineHeight: 1.6 }}>
            Traveling along the same highway corridor? Connect with verified travelers to split fuel and NHAI FASTag toll expenses.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button 
            type="button" 
            className="btn-primary" 
            onClick={() => setIsCarpoolModalOpen(true)}
            style={{ minHeight: '44px', padding: '0 22px' }}
          >
            <Users size={16} />
            <span>Explore Carpools</span>
          </button>
        </div>
      </section>

      {/* =========================================================================
          8. RECENT PLANS & TRAVEL INSIGHTS
          ========================================================================= */}
      <div className="dashboard-layout-grid" style={{ marginBottom: '48px' }}>
        <div className="dashboard-left-col">
          <div className="section-header-row">
            <div className="section-title-wrap">
              <h3>Recent Travel Plans</h3>
              <p>Pick up right where you left off or duplicate existing trips.</p>
            </div>
            <button className="section-link" onClick={onViewHistory}>
              View All ({statistics.totalPlans}) <ArrowRight size={14} />
            </button>
          </div>

          <div className="recent-plans-grid">
            {recentPlans.length === 0 ? (
              <div className="empty-dashboard-state">
                <Compass size={32} color="var(--brand-primary, #c26d38)" />
                <h4>No itineraries created yet</h4>
                <p>Click "Start Planning" above to generate your very first AI travel plan.</p>
                <button className="btn-primary" onClick={() => onStartPlanning()}>
                  Start Planning
                </button>
              </div>
            ) : (
              recentPlans.map((plan) => {
                const planId = plan.id || plan._id;
                return (
                  <div key={planId} className="recent-plan-item">
                    <div className="plan-item-left">
                      <div className="plan-destination-avatar">
                        {plan.destination ? plan.destination.charAt(0) : 'T'}
                      </div>
                      <div className="plan-item-details">
                        <h4>{plan.destination}</h4>
                        <p>
                          {plan.totalDays || plan.numberOfDays || 3} Days • ₹{plan.budget?.toLocaleString('en-IN') || '7,500'} • {plan.travelCompanionType || 'Solo'}
                        </p>
                      </div>
                    </div>

                    <div className="plan-item-actions">
                      <button 
                        className="btn-primary" 
                        style={{ minHeight: '36px', padding: '0 16px', fontSize: '13px' }}
                        onClick={() => onSelectItinerary(planId)}
                      >
                        <Eye size={14} />
                        <span>View Plan</span>
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
              })
            )}
          </div>
        </div>

        {/* Right Column: Travel Hacks & Insights */}
        <div className="dashboard-right-col">
          <div className="travel-hacks-box">
            <h4>
              <Lightbulb size={18} color="#f59e0b" />
              Smart Travel Hacks
            </h4>
            <div className="hacks-list">
              <div className="hack-item">
                <h5><Zap size={14} color="var(--brand-primary, #c26d38)" /> Fast-Track Tolls</h5>
                <p>Keep your FASTag balance above ₹1,000 on intercity highway corridors to avoid penalty tariffs.</p>
              </div>
              <div className="hack-item">
                <h5><ShieldCheck size={14} color="var(--emerald-500, #10b981)" /> Shoulder Season Stays</h5>
                <p>Visiting popular hill stations like Munnar or Manali 10 days before peak seasons cuts accommodation by up to 45%.</p>
              </div>
              <div className="hack-item">
                <h5><Coffee size={14} color="var(--azure-500, #0284c7)" /> Regional Food Gems</h5>
                <p>Dine at verified local thali messes and highway dhabas for genuine regional cuisine at student-friendly prices.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          8. COST CALCULATION METHODOLOGY & VERIFIABLE SOURCES (Requirements #4 & #5)
          ========================================================================= */}
      <section style={{
        marginBottom: '48px',
        padding: '36px 40px',
        background: '#ffffff',
        borderRadius: 'var(--radius-lg, 24px)',
        border: '1px solid var(--surface-border)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ maxWidth: '680px', marginBottom: '28px' }}>
          <span className="pill-badge pill-badge-emerald" style={{ marginBottom: '8px' }}>
            <ShieldCheck size={12} />
            <span>Pricing Transparency</span>
          </span>
          <h3 style={{ fontSize: '24px', fontWeight: 900, color: 'var(--ink-heading, #1c140e)', marginBottom: '8px' }}>
            How Travel Costs Are Calculated
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--ink-muted, #786b60)', lineHeight: 1.6 }}>
            Every estimate is computed from explicit, itemized inputs and public benchmarks. We do not use arbitrary budget allocations or guessed numbers.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '20px',
          marginBottom: '24px'
        }}>
          <div style={{ padding: '18px', background: 'var(--surface-soft)', borderRadius: '14px', border: '1px solid var(--surface-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--brand-primary, #c26d38)', fontWeight: 800, fontSize: '14px' }}>
              <Fuel size={16} /> Fuel & EV Tariffs
            </div>
            <p style={{ fontSize: '12px', color: 'var(--ink-muted, #786b60)', lineHeight: 1.5, margin: 0 }}>
              Calculated using: <code>(Route km ÷ Vehicle Mileage) × State Tariff</code>. Fuel rates reference daily Indian Oil and BPCL state averages; EV charging uses 15–20 kWh per 100 km at public DC fast chargers.
            </p>
          </div>

          <div style={{ padding: '18px', background: 'var(--surface-soft)', borderRadius: '14px', border: '1px solid var(--surface-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--emerald-500, #10b981)', fontWeight: 800, fontSize: '14px' }}>
              <Route size={16} /> Highway FASTag Tolls
            </div>
            <p style={{ fontSize: '12px', color: 'var(--ink-muted, #786b60)', lineHeight: 1.5, margin: 0 }}>
              Corridor toll plazas are calculated from NHAI FASTag database schedules per vehicle class (Car/SUV ₹1.95/km baseline for national expressways).
            </p>
          </div>

          <div style={{ padding: '18px', background: 'var(--surface-soft)', borderRadius: '14px', border: '1px solid var(--surface-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--azure-500, #0284c7)', fontWeight: 800, fontSize: '14px' }}>
              <Layers size={16} /> Accommodations
            </div>
            <p style={{ fontSize: '12px', color: 'var(--ink-muted, #786b60)', lineHeight: 1.5, margin: 0 }}>
              Calculated by nights, rooms, and selected comfort tier based on median regional seasonal rates: Hostels (₹600–1,200), Budget Hotels (₹1,500–2,800), and Resorts (₹4,500+).
            </p>
          </div>

          <div style={{ padding: '18px', background: 'var(--surface-soft)', borderRadius: '14px', border: '1px solid var(--surface-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#8b5cf6', fontWeight: 800, fontSize: '14px' }}>
              <Coffee size={16} /> Food & Entry Fees
            </div>
            <p style={{ fontSize: '12px', color: 'var(--ink-muted, #786b60)', lineHeight: 1.5, margin: 0 }}>
              Explicit meal allowances per traveler per day (Budget ₹400–600, Standard ₹800–1,200) plus verified Archaeological Survey of India (ASI) monument tickets.
            </p>
          </div>
        </div>

        <div style={{ fontSize: '12px', color: 'var(--ink-muted, #786b60)', borderTop: '1px solid var(--surface-border)', paddingTop: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={14} color="#10b981" />
          <span>
            <strong>Disclaimer:</strong> Prices shown are calculated estimates from public schedules. Live fuel prices fluctuate daily and accommodation charges vary by season. We do not guarantee third-party commercial pricing.
          </span>
        </div>
      </section>

      {/* =========================================================================
          9. FINAL CALL TO ACTION (Requirement #3 & #5)
          ========================================================================= */}
      <section style={{
        padding: '50px 40px',
        background: 'var(--brand-gradient)',
        borderRadius: 'var(--radius-lg, 24px)',
        color: '#ffffff',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-lg)'
      }}>
        <h2 style={{ fontSize: 'clamp(26px, 3.8vw, 36px)', fontWeight: 900, marginBottom: '12px' }}>
          Ready to plan your trip?
        </h2>
        <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.92)', maxWidth: '580px', margin: '0 auto 24px', lineHeight: 1.6 }}>
          Enter your starting point, destination, and dates to calculate verified toll rates, fuel tariffs, and optimized day-by-day schedules.
        </p>
        <button 
          className="btn-secondary" 
          onClick={() => onStartPlanning()}
          style={{
            background: '#ffffff',
            color: 'var(--brand-primary, #c26d38)',
            border: 'none',
            fontSize: '15px',
            minHeight: '48px',
            padding: '0 28px',
            fontWeight: 800,
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
          }}
        >
          <Compass size={18} />
          <span>Plan My Trip</span>
        </button>
      </section>

      {/* Interactive Destination Modal */}
      {selectedDestinationForModal && (
        <DestinationModal
          destination={selectedDestinationForModal}
          onClose={() => setSelectedDestinationForModal(null)}
          onPlanTrip={(dest) => onStartPlanning(dest)}
        />
      )}

      {/* Interactive Carpool Modal */}
      {isCarpoolModalOpen && (
        <CarpoolModal
          isOpen={isCarpoolModalOpen}
          onClose={() => setIsCarpoolModalOpen(false)}
          addToast={addToast}
        />
      )}
    </div>
  );
}

export default Dashboard;

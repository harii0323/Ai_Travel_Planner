import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Car, 
  MapPin, 
  Calendar, 
  Wallet, 
  ShieldCheck, 
  Plus, 
  Search, 
  X, 
  CheckCircle2, 
  ArrowRight,
  Sparkles,
  Phone,
  Clock
} from 'lucide-react';

const INITIAL_CARPOOLS = [
  {
    id: 'cp-1',
    driver: 'Rahul Sharma',
    driverRating: 4.9,
    phone: '+91 98765 43210',
    origin: 'Bangalore (Silk Board)',
    destination: 'Coorg (Madikeri)',
    date: '2026-10-04',
    time: '06:00 AM',
    vehicle: 'Tata Nexon EV (AC)',
    totalSeats: 3,
    availableSeats: 2,
    costPerSeat: 450,
    tags: ['FASTag Included', 'Pet Friendly', 'Luggage Space']
  },
  {
    id: 'cp-2',
    driver: 'Ananya Verma',
    driverRating: 4.8,
    phone: '+91 98451 23456',
    origin: 'Delhi (Kashmere Gate)',
    destination: 'Manali, Himachal Pradesh',
    date: '2026-10-06',
    time: '08:30 PM',
    vehicle: 'Hyundai Creta (Diesel)',
    totalSeats: 4,
    availableSeats: 3,
    costPerSeat: 950,
    tags: ['Night Highway', 'Verified Driver', 'Music Playlist']
  },
  {
    id: 'cp-3',
    driver: 'Vikram Joshi',
    driverRating: 5.0,
    phone: '+91 97654 32109',
    origin: 'Mumbai (Vashi Plaza)',
    destination: 'Goa (Panaji)',
    date: '2026-10-05',
    time: '05:30 AM',
    vehicle: 'Toyota Innova Crysta',
    totalSeats: 6,
    availableSeats: 2,
    costPerSeat: 850,
    tags: ['Expressway Route', 'Breakfast Stops', 'FASTag']
  },
  {
    id: 'cp-4',
    driver: 'Pooja Reddy',
    driverRating: 4.9,
    phone: '+91 99887 76655',
    origin: 'Hyderabad (Gachibowli)',
    destination: 'Hampi, Karnataka',
    date: '2026-10-07',
    time: '07:00 AM',
    vehicle: 'Maruti Suzuki Baleno',
    totalSeats: 3,
    availableSeats: 1,
    costPerSeat: 550,
    tags: ['Heritage Squad', 'Chill Vibes', 'Split Tolls']
  }
];

function CarpoolModal({ isOpen, onClose, addToast }) {
  const [activeTab, setActiveTab] = useState('find'); // 'find' or 'offer'
  const [searchQuery, setSearchQuery] = useState('');
  const [carpools, setCarpools] = useState(() => {
    const saved = localStorage.getItem('vista_carpools');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return INITIAL_CARPOOLS;
  });

  const [joinedRides, setJoinedRides] = useState(() => {
    const saved = localStorage.getItem('vista_joined_rides');
    return saved ? JSON.parse(saved) : [];
  });

  // Offer a ride form
  const [offerForm, setOfferForm] = useState({
    origin: '',
    destination: '',
    date: '',
    time: '07:00 AM',
    vehicle: '',
    totalSeats: 3,
    costPerSeat: 500
  });

  useEffect(() => {
    localStorage.setItem('vista_carpools', JSON.stringify(carpools));
  }, [carpools]);

  useEffect(() => {
    localStorage.setItem('vista_joined_rides', JSON.stringify(joinedRides));
  }, [joinedRides]);

  if (!isOpen) return null;

  const handleJoinRide = (ride) => {
    if (joinedRides.includes(ride.id)) {
      if (addToast) addToast('You are already registered for this carpool!', 'info');
      return;
    }
    if (ride.availableSeats <= 0) {
      if (addToast) addToast('This ride is fully booked!', 'error');
      return;
    }

    setCarpools((prev) =>
      prev.map((c) =>
        c.id === ride.id ? { ...c, availableSeats: c.availableSeats - 1 } : c
      )
    );
    setJoinedRides((prev) => [...prev, ride.id]);
    if (addToast) {
      addToast(`🎉 Seat booked for ${ride.destination}! Driver will contact you.`, 'success');
    }
  };

  const handleCreateRide = (e) => {
    e.preventDefault();
    if (!offerForm.origin || !offerForm.destination || !offerForm.vehicle) {
      if (addToast) addToast('Please fill all required carpool details', 'error');
      return;
    }

    const newRide = {
      id: `cp-${Date.now()}`,
      driver: 'You (Host)',
      driverRating: 5.0,
      phone: '+91 Verified User',
      origin: offerForm.origin,
      destination: offerForm.destination,
      date: offerForm.date || new Date().toISOString().split('T')[0],
      time: offerForm.time,
      vehicle: offerForm.vehicle,
      totalSeats: Number(offerForm.totalSeats) || 3,
      availableSeats: Number(offerForm.totalSeats) || 3,
      costPerSeat: Number(offerForm.costPerSeat) || 500,
      tags: ['Verified Host', 'Split Fuel & Tolls']
    };

    setCarpools((prev) => [newRide, ...prev]);
    setActiveTab('find');
    if (addToast) {
      addToast('🚗 Your carpool ride has been published to travelers!', 'success');
    }
    setOfferForm({
      origin: '',
      destination: '',
      date: '',
      time: '07:00 AM',
      vehicle: '',
      totalSeats: 3,
      costPerSeat: 500
    });
  };

  const filteredRides = carpools.filter((ride) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      ride.origin.toLowerCase().includes(q) ||
      ride.destination.toLowerCase().includes(q) ||
      ride.driver.toLowerCase().includes(q)
    );
  });

  return (
    <div 
      className="carpool-modal-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(28, 20, 14, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'grid',
        placeItems: 'center',
        padding: '20px',
        overflowY: 'auto'
      }}
    >
      <div 
        className="carpool-modal-card glass-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '820px',
          background: 'var(--surface-card, #ffffff)',
          borderRadius: 'var(--radius-lg, 24px)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-xl)',
          animation: 'slideFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          border: '1px solid var(--surface-border)'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '24px 32px',
          background: 'linear-gradient(135deg, #ede3d2 0%, #f6efe2 60%, #fae8d4 100%)',
          borderBottom: '1px solid var(--surface-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <span className="pill-badge pill-badge-emerald" style={{ marginBottom: '8px' }}>
              <Users size={13} />
              <span>Eco-Friendly Travel Together</span>
            </span>
            <h2 style={{ fontSize: '24px', fontWeight: 900, color: 'var(--ink-heading, #1c140e)' }}>
              VISTA Carpooling Network
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--ink-muted, #786b60)' }}>
              Share road trips, split highway tolls & fuel costs, and travel with fellow verified travelers.
            </p>
          </div>

          <button 
            onClick={onClose}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: 'var(--surface-card, #ffffff)',
              color: 'var(--ink-muted, #786b60)',
              border: '1px solid var(--surface-border)',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-xs)'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Selector & Search Bar */}
        <div style={{
          padding: '16px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          borderBottom: '1px solid var(--surface-border)',
          flexWrap: 'wrap',
          background: 'var(--surface-soft, #f4eee2)'
        }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className={`itinerary-tab ${activeTab === 'find' ? 'active' : ''}`}
              onClick={() => setActiveTab('find')}
              style={{
                padding: '8px 16px',
                borderRadius: '9999px',
                border: '1px solid var(--surface-border)',
                background: activeTab === 'find' ? 'var(--brand-primary, #c26d38)' : '#ffffff',
                color: activeTab === 'find' ? '#ffffff' : 'var(--ink-body, #332820)',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              Find a Carpool ({filteredRides.length})
            </button>
            <button
              className={`itinerary-tab ${activeTab === 'offer' ? 'active' : ''}`}
              onClick={() => setActiveTab('offer')}
              style={{
                padding: '8px 16px',
                borderRadius: '9999px',
                border: '1px solid var(--surface-border)',
                background: activeTab === 'offer' ? 'var(--brand-primary, #c26d38)' : '#ffffff',
                color: activeTab === 'offer' ? '#ffffff' : 'var(--ink-body, #332820)',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              + Offer a Ride
            </button>
          </div>

          {activeTab === 'find' && (
            <div style={{ position: 'relative', width: '280px' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--ink-muted, #786b60)' }} />
              <input
                type="text"
                placeholder="Search city (e.g. Goa, Manali)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: '38px',
                  paddingLeft: '36px',
                  paddingRight: '12px',
                  background: '#ffffff',
                  border: '1px solid var(--surface-border)',
                  borderRadius: '9999px',
                  fontSize: '13px'
                }}
              />
            </div>
          )}
        </div>

        {/* Content Area */}
        <div style={{ padding: '24px 32px', maxHeight: '60vh', overflowY: 'auto' }}>
          {activeTab === 'find' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {filteredRides.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--ink-muted, #786b60)' }}>
                  No active rides match your search. Be the first to offer a ride!
                </div>
              ) : (
                filteredRides.map((ride) => {
                  const isJoined = joinedRides.includes(ride.id);

                  return (
                    <div 
                      key={ride.id}
                      style={{
                        padding: '20px',
                        background: '#ffffff',
                        border: '1px solid var(--surface-border)',
                        borderRadius: 'var(--radius-md, 16px)',
                        boxShadow: 'var(--shadow-sm)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '18px',
                        flexWrap: 'wrap',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                      }}
                    >
                      {/* Left Route & Driver Info */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '260px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--ink-heading, #1c140e)' }}>
                            {ride.origin}
                          </span>
                          <ArrowRight size={14} color="var(--brand-primary, #c26d38)" />
                          <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--brand-primary, #c26d38)' }}>
                            {ride.destination}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12px', color: 'var(--ink-muted, #786b60)', flexWrap: 'wrap' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar size={13} />
                            {ride.date} • {ride.time}
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Car size={13} />
                            {ride.vehicle}
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <ShieldCheck size={13} color="var(--emerald-500, #10b981)" />
                            {ride.driver} (★ {ride.driverRating})
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                          {ride.tags.map((tag, idx) => (
                            <span key={idx} style={{
                              padding: '2px 8px',
                              borderRadius: '9999px',
                              background: 'var(--surface-soft, #f4eee2)',
                              fontSize: '10px',
                              fontWeight: 700,
                              color: 'var(--ink-muted, #786b60)'
                            }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Right Price & Join CTA */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexShrink: 0 }}>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '11px', color: 'var(--ink-muted, #786b60)', textTransform: 'uppercase', fontWeight: 700 }}>
                            Cost per Seat
                          </span>
                          <strong style={{ display: 'block', fontSize: '20px', color: 'var(--brand-primary, #c26d38)', fontWeight: 900 }}>
                            ₹{ride.costPerSeat}
                          </strong>
                          <span style={{ fontSize: '11px', color: ride.availableSeats > 0 ? 'var(--emerald-500, #10b981)' : 'var(--rose-500, #ef4444)', fontWeight: 700 }}>
                            {ride.availableSeats > 0 ? `${ride.availableSeats} seats left` : 'Full'}
                          </span>
                        </div>

                        <button
                          type="button"
                          className={isJoined ? 'btn-secondary' : 'btn-primary'}
                          disabled={isJoined || ride.availableSeats <= 0}
                          onClick={() => handleJoinRide(ride)}
                          style={{
                            minHeight: '42px',
                            padding: '0 18px',
                            fontSize: '13px',
                            background: isJoined ? 'var(--emerald-soft)' : undefined,
                            color: isJoined ? '#047857' : undefined,
                            borderColor: isJoined ? 'rgba(16, 185, 129, 0.4)' : undefined
                          }}
                        >
                          {isJoined ? '✓ Joined' : 'Join Carpool'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* Offer a Ride Form */
            <form onSubmit={handleCreateRide} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>Pickup Location / City</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Bangalore (Koramangala)"
                    value={offerForm.origin}
                    onChange={(e) => setOfferForm({ ...offerForm, origin: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Destination City</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ooty, Tamil Nadu"
                    value={offerForm.destination}
                    onChange={(e) => setOfferForm({ ...offerForm, destination: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>Departure Date</label>
                  <input
                    type="date"
                    required
                    value={offerForm.date}
                    onChange={(e) => setOfferForm({ ...offerForm, date: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Departure Time</label>
                  <input
                    type="text"
                    placeholder="e.g. 06:30 AM"
                    value={offerForm.time}
                    onChange={(e) => setOfferForm({ ...offerForm, time: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>Vehicle Make & Model</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Hyundai Creta (AC)"
                    value={offerForm.vehicle}
                    onChange={(e) => setOfferForm({ ...offerForm, vehicle: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Available Seats</label>
                  <input
                    type="number"
                    min="1"
                    max="7"
                    value={offerForm.totalSeats}
                    onChange={(e) => setOfferForm({ ...offerForm, totalSeats: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Seat Contribution (₹)</label>
                  <input
                    type="number"
                    min="100"
                    step="50"
                    value={offerForm.costPerSeat}
                    onChange={(e) => setOfferForm({ ...offerForm, costPerSeat: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button type="button" className="btn-secondary" onClick={() => setActiveTab('find')}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Publish Carpool Ride
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default CarpoolModal;

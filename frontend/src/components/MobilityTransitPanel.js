import React, { useState, useEffect } from 'react';
import api from '../api';
import '../styles/MobilityTransitPanel.css';
import {
  Train,
  Bus,
  Clock,
  MapPin,
  Calendar,
  Sparkles,
  Ticket,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Search,
  CheckCircle2,
  Navigation,
  ArrowRight,
  Info
} from 'lucide-react';

export default function MobilityTransitPanel({
  initialOrigin = 'Hyderabad',
  initialDestination = 'Kerala',
  initialTravelers = 4,
  initialMode = 'train',
  initialDistanceKm = 1560,
  preloadedTransit = null
}) {
  const [origin, setOrigin] = useState(initialOrigin);
  const [destination, setDestination] = useState(initialDestination);
  const [travelers, setTravelers] = useState(initialTravelers || 1);
  const [activeSubTab, setActiveSubTab] = useState(initialMode === 'bus' ? 'bus' : 'train');
  const [selectedTrainClass, setSelectedTrainClass] = useState('3A');
  const [selectedBusClass, setSelectedBusClass] = useState('acSleeper');
  const [expandedStops, setExpandedStops] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transitData, setTransitData] = useState(preloadedTransit || null);
  const [activeFeeds, setActiveFeeds] = useState([]);
  const [loadingFeeds, setLoadingFeeds] = useState(false);
  const [customSearchOrigin, setCustomSearchOrigin] = useState(initialOrigin);
  const [customSearchDest, setCustomSearchDest] = useState(initialDestination);

  // Fetch transit recommendations from backend Mobility Database API
  const fetchTransitData = async (orig = origin, dest = destination, numTrav = travelers) => {
    setLoading(true);
    try {
      const res = await api.get('/api/itinerary/transit-routes', {
        params: {
          origin: orig,
          destination: dest,
          travelers: numTrav,
          distanceKm: initialDistanceKm
        }
      });
      if (res.data && res.data.success) {
        setTransitData(res.data);
      }
    } catch (err) {
      console.warn('Error fetching transit data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch active GTFS feeds catalog
  const fetchFeeds = async () => {
    setLoadingFeeds(true);
    try {
      const res = await api.get('/api/itinerary/mobility-feeds', {
        params: { country_code: 'IN' }
      });
      if (res.data && res.data.feeds) {
        setActiveFeeds(res.data.feeds);
      }
    } catch (err) {
      console.warn('Error fetching feeds:', err);
    } finally {
      setLoadingFeeds(false);
    }
  };

  useEffect(() => {
    if (!preloadedTransit) {
      fetchTransitData();
    }
    fetchFeeds();
  }, []);

  const formatINR = (value) => {
    if (value == null || Number.isNaN(Number(value))) return '-';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);
  };

  const trainData = transitData?.train;
  const busData = transitData?.bus;
  const localTransit = transitData?.localTransit;

  const currentTrain = trainData?.primaryRoute || trainData?.routes?.[0];
  const currentBus = busData?.primaryRoute || busData?.routes?.[0];

  // Train calculations
  const trainFarePerPerson = trainData?.faresByClass?.[selectedTrainClass]?.oneWay || trainData?.oneWayPerPerson || 2357;
  const trainRoundTripPerPerson = trainFarePerPerson * 2;
  const trainTotalGroupCost = trainRoundTripPerPerson * travelers;

  // Bus calculations
  const busFarePerPerson = busData?.faresByClass?.[selectedBusClass]?.oneWay || busData?.oneWayPerPerson || 2352;
  const busRoundTripPerPerson = busFarePerPerson * 2;
  const busTotalGroupCost = busRoundTripPerPerson * travelers;

  const handleCustomSearch = (e) => {
    e.preventDefault();
    if (!customSearchOrigin.trim() || !customSearchDest.trim()) return;
    setOrigin(customSearchOrigin.trim());
    setDestination(customSearchDest.trim());
    fetchTransitData(customSearchOrigin.trim(), customSearchDest.trim(), travelers);
  };

  return (
    <div className="mobility-transit-panel">
      {/* 1. Header Banner with Official Provenance */}
      <div className="mobility-header-banner">
        <div className="mobility-badge-strip">
          <div className="mobility-source-tag">
            <span className="live-dot" />
            <span>⚡ Powered by Mobility Database API</span>
          </div>
          <span className="mobility-source-pill">GTFS Schedule & Fares Specification</span>
          <span className="mobility-source-pill">Open Transit Data (mobilitydatabase.org)</span>
        </div>

        <div className="mobility-header-content">
          <div>
            <h3 className="mobility-title">
              🚆 Public Transit Routes & Fare Estimation Engine
            </h3>
            <p className="mobility-subtitle">
              Ground-truth route schedules, intermediate stations, and distance-based fare tariffs for{' '}
              <strong>{origin} ➔ {destination}</strong> ({travelers} {travelers === 1 ? 'Traveler' : 'Travelers'})
            </p>
          </div>

          <button
            type="button"
            className="mobility-refresh-btn"
            onClick={() => fetchTransitData(origin, destination, travelers)}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>{loading ? 'Refreshing GTFS...' : 'Refresh Feeds'}</span>
          </button>
        </div>

        {/* Corridor Recommendation Summary */}
        {transitData?.recommendedMode && (
          <div className="mobility-recommendation-bar">
            <Sparkles size={16} className="recom-icon" />
            <div>
              <span className="recom-label">
                Optimized Recommendation: <strong>{transitData.recommendedMode.toUpperCase()}</strong>
              </span>
              <span className="recom-text"> — {transitData.recommendationReason}</span>
            </div>
          </div>
        )}
      </div>

      {/* 2. Sub-Tab Mode Switcher */}
      <div className="mobility-mode-selector">
        <button
          type="button"
          className={`mobility-mode-btn ${activeSubTab === 'train' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('train')}
        >
          <Train size={18} />
          <span>Train Routes & Tariffs</span>
          <span className="mode-feed-tag">IRCTC GTFS (mdb-2867)</span>
        </button>

        <button
          type="button"
          className={`mobility-mode-btn ${activeSubTab === 'bus' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('bus')}
        >
          <Bus size={18} />
          <span>Intercity Bus Coaches</span>
          <span className="mode-feed-tag">State RTC (mdb-3361/1835)</span>
        </button>

        <button
          type="button"
          className={`mobility-mode-btn ${activeSubTab === 'local' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('local')}
        >
          <Navigation size={18} />
          <span>Destination Local Transit</span>
          <span className="mode-feed-tag">Metro & Ferries (mdb-1209)</span>
        </button>

        <button
          type="button"
          className={`mobility-mode-btn ${activeSubTab === 'explorer' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('explorer')}
        >
          <Search size={18} />
          <span>Corridor Explorer</span>
          <span className="mode-feed-tag">All Feeds</span>
        </button>
      </div>

      {/* 3. TRAIN ROUTES VIEW */}
      {activeSubTab === 'train' && (
        <div className="transit-view-card">
          {currentTrain ? (
            <div>
              {/* Primary Train Card Header */}
              <div className="route-main-hero">
                <div className="route-title-row">
                  <div>
                    <div className="service-number-tag">
                      TRAIN #{currentTrain.trainNumber}
                    </div>
                    <h4 className="service-name">{currentTrain.trainName}</h4>
                  </div>
                  <div className="service-feed-badge">
                    <CheckCircle2 size={14} color="#059669" />
                    <span>Mobility Database Feed: <strong>{currentTrain.feedId || 'mdb-2867'}</strong></span>
                  </div>
                </div>

                {/* Stations & Timing Ribbon */}
                <div className="schedule-ribbon">
                  <div className="station-box origin">
                    <span className="station-label">Boarding Station</span>
                    <span className="station-name">{currentTrain.originStation}</span>
                    <span className="station-time">{currentTrain.departureTime}</span>
                  </div>

                  <div className="duration-arrow">
                    <span className="duration-text"><Clock size={12} /> {currentTrain.duration}</span>
                    <div className="track-line" />
                    <span className="days-text">Runs: {currentTrain.operatingDays?.join(', ')}</span>
                  </div>

                  <div className="station-box dest">
                    <span className="station-label">Arrival Station</span>
                    <span className="station-name">{currentTrain.destinationStation}</span>
                    <span className="station-time">{currentTrain.arrivalTime}</span>
                  </div>
                </div>
              </div>

              {/* Interactive Travel Class Selector */}
              <div className="class-selection-section">
                <label className="section-label">
                  <Ticket size={15} /> Select Travel Class & Tariff Slab:
                </label>
                <div className="class-pill-grid">
                  {[
                    { id: '2S', label: '2S General Sitting', code: '2S' },
                    { id: 'SL', label: 'Sleeper Class (SL)', code: 'SL' },
                    { id: '3A', label: 'AC 3 Tier (3A)', code: '3A', badge: 'Recommended' },
                    { id: '2A', label: 'AC 2 Tier (2A)', code: '2A' },
                    { id: '1A', label: 'AC First Class (1A)', code: '1A' },
                    { id: 'CC', label: 'AC Chair Car (CC)', code: 'CC' }
                  ].map((cls) => {
                    const fare = trainData?.faresByClass?.[cls.id]?.oneWay;
                    if (!fare) return null;
                    const isSelected = selectedTrainClass === cls.id;

                    return (
                      <button
                        key={cls.id}
                        type="button"
                        className={`class-pill-btn ${isSelected ? 'selected' : ''}`}
                        onClick={() => setSelectedTrainClass(cls.id)}
                      >
                        <div className="pill-header">
                          <span className="pill-code">{cls.code}</span>
                          {cls.badge && <span className="pill-rec-tag">{cls.badge}</span>}
                        </div>
                        <div className="pill-label">{cls.label}</div>
                        <div className="pill-price">{formatINR(fare)} <small>/person</small></div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Real-Time Cost Estimation Summary Box */}
              <div className="fare-computation-box">
                <div className="fare-stat-group">
                  <div className="fare-stat">
                    <span className="stat-label">One-Way Fare (Per Traveler)</span>
                    <span className="stat-val">{formatINR(trainFarePerPerson)}</span>
                    <span className="stat-sub">Distance Tariff + Reservation</span>
                  </div>
                  <div className="fare-stat">
                    <span className="stat-label">Round-Trip (Per Traveler)</span>
                    <span className="stat-val">{formatINR(trainRoundTripPerPerson)}</span>
                    <span className="stat-sub">Outbound + Return Corridor</span>
                  </div>
                  <div className="fare-stat total">
                    <span className="stat-label">Total Group Transit Cost ({travelers} Travelers)</span>
                    <span className="stat-val total">{formatINR(trainTotalGroupCost)}</span>
                    <span className="stat-sub">Authoritative Cost Summary</span>
                  </div>
                </div>

                <div className="fare-formula-note">
                  <Info size={14} />
                  <span>
                    Fares calculated using Indian Railways GTFS distance matrix ({currentTrain.distanceKm || 1560} km corridor).
                    Includes base telescopic rail tariff, reservation fee, superfast surcharge, and 5% GST.
                  </span>
                </div>
              </div>

              {/* Collapsible Intermediate Stations Route Timeline */}
              {currentTrain.intermediateStops && currentTrain.intermediateStops.length > 0 && (
                <div className="intermediate-stops-container">
                  <button
                    type="button"
                    className="stops-toggle-btn"
                    onClick={() => setExpandedStops(!expandedStops)}
                  >
                    <div className="stops-toggle-left">
                      <MapPin size={16} color="var(--brand-primary, #c26d38)" />
                      <span>
                        Intermediate Route Stations & Halts ({currentTrain.intermediateStops.length} Stations)
                      </span>
                    </div>
                    {expandedStops ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>

                  {expandedStops && (
                    <div className="stops-timeline-grid">
                      {currentTrain.intermediateStops.map((stop, sIdx) => (
                        <div key={sIdx} className="stop-item">
                          <span className="stop-index">{sIdx + 1}</span>
                          <span className="stop-name">{stop}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Alternative Trains on this corridor */}
              {trainData?.routes && trainData.routes.length > 1 && (
                <div className="alternative-services-box">
                  <h5 className="alt-title">Alternative Scheduled Trains on this Corridor:</h5>
                  <div className="alt-grid">
                    {trainData.routes.slice(1).map((altTrain, aIdx) => (
                      <div key={aIdx} className="alt-train-card">
                        <div className="alt-header">
                          <span className="alt-num">#{altTrain.trainNumber}</span>
                          <span className="alt-name">{altTrain.trainName}</span>
                        </div>
                        <div className="alt-timing">
                          <span>{altTrain.departureTime}</span>
                          <ArrowRight size={12} />
                          <span>{altTrain.arrivalTime}</span>
                          <span className="alt-dur">({altTrain.duration})</span>
                        </div>
                        <div className="alt-days">Runs: {altTrain.operatingDays?.join(', ')}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state">
              <p>No direct train schedule found for this corridor.</p>
            </div>
          )}
        </div>
      )}

      {/* 4. BUS ROUTES VIEW */}
      {activeSubTab === 'bus' && (
        <div className="transit-view-card">
          {currentBus ? (
            <div>
              {/* Primary Bus Card Header */}
              <div className="route-main-hero bus">
                <div className="route-title-row">
                  <div>
                    <div className="service-number-tag bus">
                      SERVICE #{currentBus.serviceNumber}
                    </div>
                    <h4 className="service-name">{currentBus.serviceName}</h4>
                    <span className="operator-sub">{currentBus.operator}</span>
                  </div>
                  <div className="service-feed-badge">
                    <CheckCircle2 size={14} color="#059669" />
                    <span>Mobility Database Feed: <strong>{currentBus.feedId || 'mdb-3361'}</strong></span>
                  </div>
                </div>

                {/* Terminals & Timing */}
                <div className="schedule-ribbon">
                  <div className="station-box origin">
                    <span className="station-label">Boarding Terminal</span>
                    <span className="station-name">{currentBus.originTerminal}</span>
                    <span className="station-time">{currentBus.departureTime}</span>
                  </div>

                  <div className="duration-arrow">
                    <span className="duration-text"><Clock size={12} /> {currentBus.duration}</span>
                    <div className="track-line bus" />
                    <span className="days-text">{currentBus.busType}</span>
                  </div>

                  <div className="station-box dest">
                    <span className="station-label">Dropoff Terminal</span>
                    <span className="station-name">{currentBus.destinationTerminal}</span>
                    <span className="station-time">{currentBus.arrivalTime}</span>
                  </div>
                </div>

                {/* Bus Amenities */}
                {currentBus.amenities && (
                  <div className="amenities-row">
                    {currentBus.amenities.map((amenity, amIdx) => (
                      <span key={amIdx} className="amenity-chip">✓ {amenity}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Bus Class Selector */}
              <div className="class-selection-section">
                <label className="section-label">
                  <Ticket size={15} /> Select Bus Service Category:
                </label>
                <div className="class-pill-grid">
                  {[
                    { id: 'express', label: 'Super Luxury / Non-AC Express', rate: '₹1.25/km' },
                    { id: 'acSemiSleeper', label: 'AC Semi-Sleeper Coach', rate: '₹1.65/km' },
                    { id: 'acSleeper', label: 'Multi-Axle AC Sleeper', rate: '₹2.10/km', badge: 'Recommended' }
                  ].map((cls) => {
                    const fare = busData?.faresByClass?.[cls.id]?.oneWay;
                    if (!fare) return null;
                    const isSelected = selectedBusClass === cls.id;

                    return (
                      <button
                        key={cls.id}
                        type="button"
                        className={`class-pill-btn ${isSelected ? 'selected' : ''}`}
                        onClick={() => setSelectedBusClass(cls.id)}
                      >
                        <div className="pill-header">
                          <span className="pill-code">{cls.rate}</span>
                          {cls.badge && <span className="pill-rec-tag">{cls.badge}</span>}
                        </div>
                        <div className="pill-label">{cls.label}</div>
                        <div className="pill-price">{formatINR(fare)} <small>/person</small></div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bus Fare Computation Box */}
              <div className="fare-computation-box">
                <div className="fare-stat-group">
                  <div className="fare-stat">
                    <span className="stat-label">One-Way Bus Fare</span>
                    <span className="stat-val">{formatINR(busFarePerPerson)}</span>
                    <span className="stat-sub">Toll & Stage Surcharges Included</span>
                  </div>
                  <div className="fare-stat">
                    <span className="stat-label">Round-Trip Per Traveler</span>
                    <span className="stat-val">{formatINR(busRoundTripPerPerson)}</span>
                    <span className="stat-sub">Return Seat Reserved</span>
                  </div>
                  <div className="fare-stat total">
                    <span className="stat-label">Total Group Bus Cost ({travelers} Travelers)</span>
                    <span className="stat-val total">{formatINR(busTotalGroupCost)}</span>
                    <span className="stat-sub">All Taxes Included</span>
                  </div>
                </div>

                <div className="fare-formula-note">
                  <Info size={14} />
                  <span>
                    Tariffs derived from state road transport corporation GTFS stages ({currentBus.distanceKm || 1120} km corridor).
                  </span>
                </div>
              </div>

              {/* Highway Halts */}
              {currentBus.intermediateStops && (
                <div className="intermediate-stops-container">
                  <div className="stops-header-static">
                    <MapPin size={16} color="#0284c7" />
                    <span>Highway Pickup Points & Refreshment Stops:</span>
                  </div>
                  <div className="stops-timeline-grid">
                    {currentBus.intermediateStops.map((stop, sIdx) => (
                      <div key={sIdx} className="stop-item">
                        <span className="stop-index bus">{sIdx + 1}</span>
                        <span className="stop-name">{stop}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state">
              <p>No intercity bus routes found for this corridor.</p>
            </div>
          )}
        </div>
      )}

      {/* 5. LOCAL DESTINATION TRANSIT VIEW */}
      {activeSubTab === 'local' && (
        <div className="transit-view-card">
          <div className="local-transit-intro">
            <h4>
              🚇 Destination Public Transit & Local Mobility: {localTransit?.destination || destination}
            </h4>
            <p>
              Integrated with municipal GTFS feeds from Mobility Database for cost-effective, eco-friendly local exploration:
            </p>
          </div>

          <div className="local-options-grid">
            {(localTransit?.localTransitOptions || []).map((opt, oIdx) => (
              <div key={oIdx} className="local-transit-card">
                <div className="local-card-top">
                  <span className="local-type-tag">{opt.type}</span>
                  <span className="local-feed-id">Feed: {opt.feedId}</span>
                </div>
                <h5 className="local-name">{opt.name}</h5>
                <div className="local-fare-badge">
                  <span>Fare: <strong>{opt.fareRange}</strong></span>
                </div>
                <div className="local-freq">
                  <Clock size={13} />
                  <span>Frequency: {opt.frequency}</span>
                </div>
                {opt.keyStations && (
                  <div className="local-stations">
                    <strong>Key Stations:</strong> {opt.keyStations.join(' • ')}
                  </div>
                )}
                {opt.keyStops && (
                  <div className="local-stations">
                    <strong>Key Stops:</strong> {opt.keyStops.join(' • ')}
                  </div>
                )}
                <div className="local-provider">
                  Provider: {opt.feedProvider} ({opt.database})
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. CORRIDOR EXPLORER & FEED REGISTRY VIEW */}
      {activeSubTab === 'explorer' && (
        <div className="transit-view-card">
          {/* Quick Route Test Form */}
          <div className="corridor-test-form">
            <h5>🔍 Test Any Origin & Destination Corridor in Mobility Database</h5>
            <form onSubmit={handleCustomSearch} className="test-form-row">
              <div className="input-group">
                <label>Origin City</label>
                <input
                  type="text"
                  value={customSearchOrigin}
                  onChange={(e) => setCustomSearchOrigin(e.target.value)}
                  placeholder="e.g. Mumbai, Delhi, Bangalore"
                />
              </div>
              <div className="input-group">
                <label>Destination</label>
                <input
                  type="text"
                  value={customSearchDest}
                  onChange={(e) => setCustomSearchDest(e.target.value)}
                  placeholder="e.g. Goa, Agra, Jaipur"
                />
              </div>
              <button type="submit" className="test-search-btn" disabled={loading}>
                {loading ? <RefreshCw size={14} className="spin" /> : <Search size={14} />}
                <span>Fetch GTFS Routes & Costs</span>
              </button>
            </form>
          </div>

          {/* Active GTFS Feeds Table */}
          <div className="feeds-registry-box">
            <div className="feeds-reg-header">
              <h5>📡 Active GTFS Feeds Connected via Mobility Database API ({activeFeeds.length} Feeds)</h5>
              <a
                href="https://mobilitydatabase.org"
                target="_blank"
                rel="noreferrer"
                className="external-mdb-link"
              >
                <span>Browse Mobility Database</span>
                <ExternalLink size={13} />
              </a>
            </div>

            <div className="feeds-table-wrapper">
              <table className="feeds-table">
                <thead>
                  <tr>
                    <th>Feed ID</th>
                    <th>Transit Agency / Provider</th>
                    <th>Region / Municipality</th>
                    <th>Data Type</th>
                    <th>Verified Status</th>
                  </tr>
                </thead>
                <tbody>
                  {activeFeeds.map((feed) => (
                    <tr key={feed.id}>
                      <td>
                        <span className="feed-id-badge">{feed.id}</span>
                      </td>
                      <td>
                        <strong>{feed.provider}</strong>
                        {feed.feed_name && <div className="feed-name-sub">{feed.feed_name}</div>}
                      </td>
                      <td>
                        {feed.locations?.[0]?.municipality || feed.locations?.[0]?.subdivision_name || feed.locations?.[0]?.country || 'India'}
                      </td>
                      <td>
                        <span className="data-type-pill">{feed.data_type?.toUpperCase() || 'GTFS'}</span>
                      </td>
                      <td>
                        <span className="status-live-tag">
                          <CheckCircle2 size={12} /> Active Feed
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import api from '../api';
import '../styles/ItineraryDisplay.css';
import RouteMap from './RouteMap';
import {
  Compass,
  Calendar,
  Wallet,
  Printer,
  Share2,
  Bookmark,
  Check,
  Plus,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronUp,
  MapPin,
  Clock,
  Sparkles,
  CloudSun,
  Utensils,
  Layers,
  Bed,
  Plane,
  ShieldAlert,
  Search,
  Download,
  KeyRound,
  ExternalLink
} from 'lucide-react';

const buildDisplayItinerary = (input) => {
  const raw = input?.itinerary || input;
  if (!raw || raw.success) return raw;

  return {
    ...raw,
    success: true,
    summary: {
      destination: raw.destination,
      startLocation: raw.startLocation,
      startDate: raw.startDate,
      endDate: raw.endDate,
      totalDays: raw.totalDays,
      originalBudget: raw.budget,
      withinBudget: !raw.withoutBudget
    },
    details: {
      startLocation: raw.startLocation,
      accommodationType: raw.accommodation,
      transportMode: raw.transport,
      preferredActivities: Array.isArray(raw.activities) ? raw.activities.join(', ') : ''
    },
    estimatedCosts: raw.estimatedCosts || {
      total: raw.estimatedCost
    },
    dayPlans: raw.dayPlans || [],
    moneyTips: raw.moneyTips || [],
    climateIntelligence: raw.climateIntelligence || raw.recommendations?.climateIntelligence || {},
    recommendations: raw.recommendations || {}
  };
};

function ItineraryDisplay({ data, addToast, onEditAnother }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedDay, setExpandedDay] = useState(1);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [editableDayPlans, setEditableDayPlans] = useState([]);
  const [newPlaceByDay, setNewPlaceByDay] = useState({});
  const [editingActivity, setEditingActivity] = useState(null);
  const [editingActivityName, setEditingActivityName] = useState('');
  const [timelineSearch, setTimelineSearch] = useState('');

  const itinerary = buildDisplayItinerary(data);
  const rawDayPlans = itinerary?.dayPlans;

  useEffect(() => {
    setEditableDayPlans(Array.isArray(rawDayPlans) ? rawDayPlans : []);
    setNewPlaceByDay({});
    setEditingActivity(null);
    setEditingActivityName('');
    setSaveStatus('idle');
    if (rawDayPlans?.length > 0) {
      setExpandedDay(rawDayPlans[0].day);
    }
  }, [rawDayPlans]);

  if (!itinerary || !itinerary.success) {
    return (
      <div className="error-container">
        <h2>Error generating itinerary</h2>
        <p>{itinerary?.error || itinerary?.message || 'Unknown error occurred'}</p>
      </div>
    );
  }

  const {
    summary = {},
    estimatedCosts = {},
    dayPlans = [],
    moneyTips = [],
    costBreakdown = {},
    accommodationSuggestions,
    foodRecommendations,
    alternatives,
    warnings = [],
    route = {},
    transportation = {},
    tripPhases = {},
    climateIntelligence = {}
  } = itinerary;
  const rentalVehicle = itinerary.rentalVehicle || transportation.rentalVehicle;
  const rentalBooking = itinerary.rentalBooking || transportation.rentalBooking;
  const rentalDetails = transportation.rentalDetails;

  const recommendations = itinerary.recommendations || data?.recommendations || {};
  const displayedDayPlans = editableDayPlans.length > 0 ? editableDayPlans : dayPlans;

  const formatINR = (value) => {
    if (value == null || Number.isNaN(Number(value))) return '-';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);
  };

  const handleSavePlan = async () => {
    if (saveStatus === 'saving' || saveStatus === 'saved') return;

    setSaveStatus('saving');
    try {
      const token = localStorage.getItem('token');
      const titleParts = [summary.destination, summary.totalDays && `${summary.totalDays} day trip`].filter(Boolean);
      const itineraryData = {
        summary,
        details: itinerary.details || {},
        estimatedCosts,
        dayPlans: displayedDayPlans,
        moneyTips,
        climateIntelligence,
        recommendations: {
          ...recommendations,
          climateIntelligence
        },
        travelCompanionType: itinerary.travelCompanionType || itinerary.tripOverview?.travelCompanionType || 'solo',
        numberOfTravelers: itinerary.numberOfTravelers || itinerary.tripOverview?.numTravelers || 1
      };

      await api.post(
        '/api/itinerary/save',
        {
          title: titleParts.join(' - ') || 'Saved travel plan',
          description: `${summary.startLocation || itinerary.details?.startLocation || 'Trip'} to ${summary.destination || 'destination'}`,
          itineraryData,
          tags: [summary.destination].filter(Boolean)
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setSaveStatus('saved');
      // Confetti celebration 🎉
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
      if (addToast) addToast('Trip plan saved to your account! 🎉', 'success');
    } catch (error) {
      setSaveStatus('error');
      if (addToast) addToast(error.response?.data?.error || 'Could not save this plan.', 'error');
    }
  };

  const handleCopySummary = () => {
    const textLines = [
      `🌟 Travel Plan: ${summary.destination}`,
      `📅 Duration: ${summary.totalDays || 3} Days (${summary.startDate || ''} to ${summary.endDate || ''})`,
      `💰 Budget: ${formatINR(summary.originalBudget)} | Estimated: ${formatINR(estimatedCosts.total)}`,
      `👥 Travelers: ${itinerary.numberOfTravelers || 1} (${itinerary.travelCompanionType || 'Solo'})`,
      '',
      'Day Highlights:'
    ];

    displayedDayPlans.forEach((dp) => {
      const acts = (dp.activities || []).map((a) => a.name).join(', ');
      textLines.push(`• Day ${dp.day}: ${acts || dp.plan || 'Exploring'}`);
    });

    navigator.clipboard.writeText(textLines.join('\n'));
    if (addToast) addToast('Itinerary summary copied to clipboard! 📋', 'info');
  };

  const handleExportICS = () => {
    const title = `Trip to ${summary.destination}`;
    const desc = `Travel itinerary generated by VISTA. Total Budget: ${formatINR(summary.originalBudget)}`;
    const start = summary.startDate ? summary.startDate.replace(/-/g, '') : '20260901';
    const end = summary.endDate ? summary.endDate.replace(/-/g, '') : '20260905';

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//VISTA Travel Planner//EN',
      'BEGIN:VEVENT',
      `SUMMARY:${title}`,
      `DESCRIPTION:${desc}`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${end}`,
      `LOCATION:${summary.destination}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${summary.destination.replace(/[^a-zA-Z0-9]/g, '_')}_trip.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (addToast) addToast('Calendar event file (.ics) downloaded! 📅', 'success');
  };

  const handlePrint = () => {
    window.print();
  };

  // Activity In-Place Editor
  const handleAddPlace = (day) => {
    const name = (newPlaceByDay[day] || '').trim();
    if (!name) return;

    setEditableDayPlans((plans) =>
      plans.map((plan) => {
        if (plan.day !== day) return plan;
        return {
          ...plan,
          activities: [
            ...(plan.activities || []),
            { name, cost: 0, isCustom: true }
          ]
        };
      })
    );
    setNewPlaceByDay((current) => ({ ...current, [day]: '' }));
    if (addToast) addToast(`Added "${name}" to Day ${day}`, 'info');
  };

  const handleRemovePlace = (day, activityIndex) => {
    setEditableDayPlans((plans) =>
      plans.map((plan) => {
        if (plan.day !== day) return plan;
        return {
          ...plan,
          activities: (plan.activities || []).filter((_, idx) => idx !== activityIndex)
        };
      })
    );
    if (addToast) addToast('Activity removed from day plan', 'info');
  };

  const saveEditedPlace = () => {
    const name = editingActivityName.trim();
    if (!name || !editingActivity) return;

    setEditableDayPlans((plans) =>
      plans.map((plan) => {
        if (plan.day !== editingActivity.day) return plan;
        return {
          ...plan,
          activities: (plan.activities || []).map((activity, idx) =>
            idx === editingActivity.activityIndex ? { ...activity, name } : activity
          )
        };
      })
    );
    setEditingActivity(null);
    setEditingActivityName('');
    if (addToast) addToast('Place updated successfully', 'success');
  };

  // Budget calculations
  const totalCost = Number(estimatedCosts.total || 0);
  const origBudget = Number(summary.originalBudget || totalCost);
  const budgetRatio = origBudget > 0 ? (totalCost / origBudget) * 100 : 100;
  const isWithinBudget = totalCost <= origBudget;

  const filteredDays = timelineSearch
    ? displayedDayPlans.filter((dp) => {
        const text = `${dp.day} ${dp.plan || ''} ${(dp.activities || []).map((a) => a.name).join(' ')}`.toLowerCase();
        return text.includes(timelineSearch.toLowerCase());
      })
    : displayedDayPlans;

  return (
    <div className="itinerary-container">
      {/* Hero Header & Summary Banner */}
      <div className="itinerary-hero-banner">
        <div className="itinerary-hero-top">
          <div className="itinerary-title-group">
            <h2>{summary.destination} Expedition</h2>
            <p className="itinerary-subtitle">
              {summary.startLocation ? `From ${summary.startLocation} • ` : ''}
              {summary.totalDays} Days • {itinerary.travelCompanionType || 'Solo'} Traveler
            </p>
          </div>

          <div className="itinerary-action-toolbar">
            <button
              type="button"
              className={`btn-toolbar save-btn ${saveStatus === 'saved' ? 'saved' : ''}`}
              onClick={handleSavePlan}
              disabled={saveStatus === 'saving'}
            >
              {saveStatus === 'saved' ? <Check size={16} /> : <Bookmark size={16} />}
              <span>{saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Plan Saved' : 'Save Plan'}</span>
            </button>

            <button type="button" className="btn-toolbar" onClick={handleCopySummary} title="Copy shareable summary">
              <Share2 size={16} />
              <span>Share</span>
            </button>

            <button type="button" className="btn-toolbar" onClick={handleExportICS} title="Download calendar event">
              <Download size={16} />
              <span>Calendar</span>
            </button>

            <button type="button" className="btn-toolbar" onClick={handlePrint} title="Print or save as PDF">
              <Printer size={16} />
              <span>Print / PDF</span>
            </button>
          </div>
        </div>

        {/* Quick Stat Summary Cards */}
        <div className="hero-summary-grid">
          <div className="hero-summary-card">
            <span className="label">
              <Compass size={14} /> Destination
            </span>
            <span className="value">{summary.destination}</span>
          </div>

          <div className="hero-summary-card">
            <span className="label">
              <Calendar size={14} /> Duration
            </span>
            <span className="value">{summary.totalDays} Days</span>
          </div>

          <div className="hero-summary-card">
            <span className="label">
              <Wallet size={14} /> Total Budget
            </span>
            <span className="value">{formatINR(summary.originalBudget)}</span>
          </div>

          <div className="hero-summary-card">
            <span className="label">
              <Sparkles size={14} /> Estimated Cost
            </span>
            <span className={`value ${isWithinBudget ? 'within' : 'over'}`}>
              {formatINR(estimatedCosts.total)}
            </span>
          </div>
        </div>

        {/* Budget Utilization Meter */}
        <div className="budget-meter-strip">
          <div className="budget-meter-label-row">
            <span>
              Budget Health: {Math.round(budgetRatio)}% utilized ({formatINR(totalCost)} of {formatINR(origBudget)})
            </span>
            <span style={{ color: isWithinBudget ? '#a7f3d0' : '#fde68a' }}>
              {isWithinBudget ? '✅ On Track within Budget' : `⚠️ Exceeds by ${formatINR(totalCost - origBudget)}`}
            </span>
          </div>
          <div className="budget-progress-track">
            <div
              className={`budget-progress-fill ${isWithinBudget ? 'within' : 'over'}`}
              style={{ width: `${Math.min(budgetRatio, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Segmented Navigation Tabs */}
      <div className="itinerary-tabs">
        <button
          className={`itinerary-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <Compass size={16} />
          <span>Overview</span>
        </button>

        <button
          className={`itinerary-tab ${activeTab === 'timeline' ? 'active' : ''}`}
          onClick={() => setActiveTab('timeline')}
        >
          <Calendar size={16} />
          <span>Day Timeline & Edit ({displayedDayPlans.length})</span>
        </button>

        <button
          className={`itinerary-tab ${activeTab === 'route' ? 'active' : ''}`}
          onClick={() => setActiveTab('route')}
        >
          <MapPin size={16} />
          <span>Interactive Map</span>
        </button>

        <button
          className={`itinerary-tab ${activeTab === 'costs' ? 'active' : ''}`}
          onClick={() => setActiveTab('costs')}
        >
          <Wallet size={16} />
          <span>Cost Breakdown</span>
        </button>

        {climateIntelligence.enabled && (
          <button
            className={`itinerary-tab ${activeTab === 'weather' ? 'active' : ''}`}
            onClick={() => setActiveTab('weather')}
          >
            <CloudSun size={16} />
            <span>Weather Fit</span>
          </button>
        )}

        {Object.keys(recommendations).length > 0 && (
          <button
            className={`itinerary-tab ${activeTab === 'recommendations' ? 'active' : ''}`}
            onClick={() => setActiveTab('recommendations')}
          >
            <Utensils size={16} />
            <span>Food & Local Tips</span>
          </button>
        )}

        {alternatives && alternatives.length > 0 && (
          <button
            className={`itinerary-tab ${activeTab === 'alternatives' ? 'active' : ''}`}
            onClick={() => setActiveTab('alternatives')}
          >
            <Layers size={16} />
            <span>Alternatives</span>
          </button>
        )}
      </div>

      {/* Tab Content Panels */}
      <div className="tab-content-panel">
        {/* 1. OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <>
            {warnings.length > 0 && (
              <div className="error-alert" style={{ background: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.4)', color: '#fde68a' }}>
                <ShieldAlert size={20} color="#f59e0b" />
                <div className="error-alert-content">
                  <h3 style={{ color: '#fff' }}>Trip Advisory</h3>
                  {warnings.map((w, idx) => (
                    <p key={idx} style={{ color: '#fef3c7' }}>{w}</p>
                  ))}
                </div>
              </div>
            )}

            <div className="cost-highlights-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
              <div className="cost-highlight-card">
                <span className="category">Total Route</span>
                <span className="amount" style={{ fontSize: '16px' }}>{costBreakdown.totalDistanceKm || transportation.distance || 0} km</span>
              </div>
              <div className="cost-highlight-card">
                <span className="category">{transportation.isEV ? 'EV Charging' : 'Vehicle Fuel'}</span>
                <span className="amount">{formatINR(estimatedCosts.fuelCost || costBreakdown.transport?.fuelCost || 0)}</span>
              </div>
              <div className="cost-highlight-card">
                <span className="category">Highway Tolls</span>
                <span className="amount">{formatINR(estimatedCosts.tollCost || costBreakdown.transport?.tollCost || 0)}</span>
              </div>
              <div className="cost-highlight-card">
                <span className="category">Local Transit</span>
                <span className="amount">{formatINR(estimatedCosts.localTransport || costBreakdown.localTransport?.cost || 0)}</span>
              </div>
              <div className="cost-highlight-card">
                <span className="category">Accommodation</span>
                <span className="amount">{formatINR(estimatedCosts.accommodation)}</span>
              </div>
              <div className="cost-highlight-card">
                <span className="category">Food & Dining</span>
                <span className="amount">{formatINR(estimatedCosts.food)}</span>
              </div>
              <div className="cost-highlight-card">
                <span className="category">Entry Tickets</span>
                <span className="amount">{formatINR(estimatedCosts.activities)}</span>
              </div>
              <div className="cost-highlight-card total">
                <span className="category">Total Trip Cost</span>
                <span className="amount">{formatINR(estimatedCosts.total)}</span>
              </div>
              <div className="cost-highlight-card" style={{ borderColor: 'var(--brand, #c26d38)' }}>
                <span className="category">Per Person</span>
                <span className="amount" style={{ color: 'var(--brand, #c26d38)' }}>
                  {formatINR(costBreakdown.lineItemSummary?.costPerPerson || Math.round(estimatedCosts.total / Math.max(1, itinerary.numberOfTravelers || 1)))}
                </span>
              </div>
            </div>

            <div className="overview-cards-2">
              <div className="overview-box">
                <h4>
                  <Bed size={18} color="#38bdf8" />
                  Accommodation Strategy
                </h4>
                <p style={{ color: 'var(--ink)', fontSize: '14px' }}>
                  <strong>Type:</strong> {costBreakdown.accommodation?.type || 'Hostel / Budget Stay'} • {formatINR(costBreakdown.accommodation?.costPerNight || 0)} / night
                </p>
                {accommodationSuggestions && (
                  <ul className="overview-list">
                    {accommodationSuggestions.map((sugg, idx) => (
                      <li key={idx}>
                        <Sparkles size={14} />
                        <span>{sugg}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="overview-box">
                <h4>
                  <Utensils size={18} color="#f59e0b" />
                  Dining & Local Flavor
                </h4>
                <p style={{ color: 'var(--ink)', fontSize: '14px' }}>
                  <strong>Daily Food Budget:</strong> {formatINR(costBreakdown.food?.perPersonPerDay || 0)} per traveler
                </p>
                {foodRecommendations && (
                  <ul className="overview-list">
                    {foodRecommendations.map((food, idx) => (
                      <li key={idx}>
                        <Sparkles size={14} />
                        <span>{food}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {rentalVehicle && (
              <div className="rental-summary-panel">
                <div className="rental-summary-header">
                  <h4>
                    <KeyRound size={18} color="#14b8a6" />
                    Rental Car
                  </h4>
                  {rentalBooking?.bookingUrl && (
                    <a href={rentalBooking.bookingUrl} target="_blank" rel="noreferrer" className="btn-view-booking">
                      <ExternalLink size={14} />
                      View Booking
                    </a>
                  )}
                </div>

                <div className="rental-summary-grid">
                  <div>
                    <span>Vehicle</span>
                    <strong>{rentalVehicle.name}</strong>
                  </div>
                  <div>
                    <span>Pickup</span>
                    <strong>{rentalDetails?.pickupLocation || rentalVehicle.pickupLocation}</strong>
                    <small>{rentalDetails ? `${rentalDetails.pickupDate} ${rentalDetails.pickupTime}` : '-'}</small>
                  </div>
                  <div>
                    <span>Return</span>
                    <strong>{rentalDetails?.dropoffLocation || rentalVehicle.dropoffLocation}</strong>
                    <small>{rentalDetails ? `${rentalDetails.returnDate} ${rentalDetails.returnTime}` : '-'}</small>
                  </div>
                  <div>
                    <span>Estimated Cost</span>
                    <strong>{formatINR(rentalVehicle.estimatedTotalCost)}</strong>
                    <small>Deposit: {formatINR(rentalVehicle.securityDeposit)}</small>
                  </div>
                  <div>
                    <span>Booking ID</span>
                    <strong>{rentalBooking?.bookingId || rentalBooking?.referenceId || 'Pending'}</strong>
                    <small>{rentalBooking?.status || 'initiated'}</small>
                  </div>
                  <div>
                    <span>Capacity</span>
                    <strong>{rentalVehicle.seatingCapacity} seats</strong>
                    <small>{rentalVehicle.luggageCapacity} bags • {rentalVehicle.transmissionType}</small>
                  </div>
                </div>
              </div>
            )}

            {moneyTips && moneyTips.length > 0 && (
              <div className="overview-box">
                <h4>
                  <Sparkles size={18} color="#10b981" />
                  Smart Travel Optimization & Cost Saving Tips
                </h4>
                <ul className="overview-list">
                  {moneyTips.map((tip, idx) => (
                    <li key={idx}>
                      <Check size={15} color="#10b981" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {/* 2. TIMELINE & EDIT TAB */}
        {activeTab === 'timeline' && (
          <div>
            <div className="timeline-toolbar">
              <div className="timeline-search-box">
                <Search size={16} className="input-icon" style={{ left: '12px' }} />
                <input
                  type="text"
                  placeholder="Filter places in itinerary..."
                  value={timelineSearch}
                  onChange={(e) => setTimelineSearch(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ minHeight: '36px', fontSize: '12px' }}
                  onClick={() => setExpandedDay(expandedDay ? null : 1)}
                >
                  {expandedDay ? 'Collapse Days' : 'Expand First Day'}
                </button>
              </div>
            </div>

            <div className="timeline-days-stack">
              {filteredDays.map((dayPlan) => {
                const isExpanded = expandedDay === dayPlan.day;
                return (
                  <div key={dayPlan.day} className="day-timeline-card">
                    <div
                      className="day-timeline-header"
                      onClick={() => setExpandedDay(isExpanded ? null : dayPlan.day)}
                    >
                      <div className="day-header-left">
                        <div className="day-badge-circle">{dayPlan.day}</div>
                        <div className="day-title-text">
                          <h4>
                            Day {dayPlan.day} {dayPlan.phase ? `— ${dayPlan.phase}` : ''}
                          </h4>
                          <p>{dayPlan.date || `Schedule for Day ${dayPlan.day}`}</p>
                        </div>
                      </div>

                      <div className="day-header-right">
                        <span className="day-activity-count">
                          {dayPlan.activities?.length || 0} stops
                        </span>
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="day-body">
                        {dayPlan.plan && (
                          <div className="day-description-box">{dayPlan.plan}</div>
                        )}

                        <div className="places-list-section">
                          <h5>
                            <MapPin size={15} color="#14b8a6" />
                            Planned Stops & Activities
                          </h5>

                          <div className="places-interactive-list">
                            {(dayPlan.activities || []).map((activity, idx) => {
                              const isEditing =
                                editingActivity?.day === dayPlan.day &&
                                editingActivity?.activityIndex === idx;

                              if (isEditing) {
                                return (
                                  <div key={idx} className="activity-item-card">
                                    <input
                                      type="text"
                                      value={editingActivityName}
                                      onChange={(e) => setEditingActivityName(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') saveEditedPlace();
                                        if (e.key === 'Escape') setEditingActivity(null);
                                      }}
                                      autoFocus
                                      style={{
                                        flex: 1,
                                        padding: '6px 10px',
                                        background: 'var(--surface-soft)',
                                        border: '1px solid var(--brand-light)',
                                        borderRadius: '4px',
                                        color: '#fff'
                                      }}
                                    />
                                    <button
                                      type="button"
                                      className="btn-item-action"
                                      onClick={saveEditedPlace}
                                      style={{ background: 'var(--brand)', color: '#fff' }}
                                    >
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-item-action"
                                      onClick={() => setEditingActivity(null)}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                );
                              }

                              return (
                                <div key={idx} className="activity-item-card">
                                  <div className="activity-item-left">
                                    <span className="activity-item-name">{activity.name}</span>
                                    {activity.cost > 0 && (
                                      <span className="activity-item-cost">
                                        {formatINR(activity.cost)}
                                      </span>
                                    )}
                                  </div>

                                  <div className="activity-item-actions">
                                    <button
                                      type="button"
                                      className="btn-item-action"
                                      onClick={() => {
                                        setEditingActivity({ day: dayPlan.day, activityIndex: idx });
                                        setEditingActivityName(activity.name);
                                      }}
                                      title="Edit place name"
                                    >
                                      <Edit2 size={13} />
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-item-action delete"
                                      onClick={() => handleRemovePlace(dayPlan.day, idx)}
                                      title="Remove from itinerary"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Add Place Input */}
                          <div className="add-place-input-row">
                            <input
                              type="text"
                              placeholder="Add a custom stop (e.g., Cafe Bodega, Sunset Point)..."
                              value={newPlaceByDay[dayPlan.day] || ''}
                              onChange={(e) =>
                                setNewPlaceByDay((prev) => ({
                                  ...prev,
                                  [dayPlan.day]: e.target.value
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddPlace(dayPlan.day);
                              }}
                            />
                            <button
                              type="button"
                              className="btn-add-place"
                              onClick={() => handleAddPlace(dayPlan.day)}
                            >
                              <Plus size={15} /> Add
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. ROUTE MAP TAB */}
        {activeTab === 'route' && (
          <div>
            <RouteMap route={route} />
          </div>
        )}

        {/* 4. COSTS TAB - Comprehensive Real-World Breakdown */}
        {activeTab === 'costs' && (
          <div className="cost-breakdown-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Primary Transparent Cost Breakdown Summary */}
            <div className="cost-detail-box" style={{ background: 'var(--surface-raised, #1e293b)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4>
                  <Wallet size={18} color="#14b8a6" />
                  Itemized Travel Cost Calculation (Real-World Grounded Data)
                </h4>
                <span style={{ fontSize: '11px', background: 'rgba(20, 184, 166, 0.15)', color: '#14b8a6', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}>
                  Zero Synthetic Allocations
                </span>
              </div>

              <table className="cost-table">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '8px 0' }}>Cost Category</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px' }}>Calculation Basis / Route Specs</th>
                    <th style={{ textAlign: 'right', padding: '8px 0' }}>Estimated Cost</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Total Road-Trip Distance</strong></td>
                    <td style={{ color: 'var(--muted)' }}>Round trip via recommended highways & detours</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{costBreakdown.totalDistanceKm || transportation.distance || 0} km</td>
                  </tr>

                  <tr>
                    <td><strong>{transportation.isEV ? '⚡ EV Charging Cost' : '⛽ Vehicle Fuel Cost'}</strong></td>
                    <td style={{ color: 'var(--muted)' }}>
                      {transportation.isEV
                        ? `${transportation.evPlan?.totalEnergyNeededKwh || 0} kWh required • ${transportation.evPlan?.estimatedChargingStops || 0} highway fast-charge stops`
                        : `${costBreakdown.transport?.details?.fuelRequired || 0} L @ ~₹${costBreakdown.transport?.details?.fuelPricePerUnit || 100}/L (${costBreakdown.transport?.details?.mileage || 15} km/L)`}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {formatINR(estimatedCosts.fuelCost || costBreakdown.transport?.fuelCost || 0)}
                    </td>
                  </tr>

                  <tr>
                    <td><strong>🛣️ Highway Toll Charges (FASTag)</strong></td>
                    <td style={{ color: 'var(--muted)' }}>
                      {costBreakdown.transport?.details?.corridorName || 'NHAI National Highway network'}
                      {costBreakdown.transport?.details?.tollPlazasCount ? ` (${costBreakdown.transport.details.tollPlazasCount} toll plazas)` : ''}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {formatINR(estimatedCosts.tollCost || costBreakdown.transport?.tollCost || 0)}
                    </td>
                  </tr>

                  <tr>
                    <td><strong>🚤 Local Destination Transportation</strong></td>
                    <td style={{ color: 'var(--muted)' }}>
                      {costBreakdown.localTransport?.details?.recommendation || 'Local water ferries, autos, shuttle jeeps'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {formatINR(estimatedCosts.localTransport || costBreakdown.localTransport?.cost || 0)}
                    </td>
                  </tr>

                  <tr>
                    <td><strong>🏨 Accommodation & Stays</strong></td>
                    <td style={{ color: 'var(--muted)' }}>
                      {costBreakdown.accommodation?.roomsNeeded || Math.ceil((itinerary.numberOfTravelers || 1) / 2)} room(s) × {costBreakdown.accommodation?.numNights || (summary.totalDays ? summary.totalDays - 1 : 1)} night(s) ({costBreakdown.accommodation?.label || costBreakdown.accommodation?.type})
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {formatINR(estimatedCosts.accommodation)}
                    </td>
                  </tr>

                  <tr>
                    <td><strong>🍽️ Food & Dining Expenses</strong></td>
                    <td style={{ color: 'var(--muted)' }}>
                      {costBreakdown.food?.regionName || summary.destination} • {itinerary.numberOfTravelers || 1} travelers × {summary.totalDays || 1} days (@ ~{formatINR(costBreakdown.food?.dailyCostPerPerson || costBreakdown.food?.perPersonPerDay || 500)}/day)
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {formatINR(estimatedCosts.food)}
                    </td>
                  </tr>

                  <tr>
                    <td><strong>🎟️ Attraction Entry Tickets & Activities</strong></td>
                    <td style={{ color: 'var(--muted)' }}>
                      Verified tickets, boat rides, national parks, and monument permits
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {formatINR(estimatedCosts.activities)}
                    </td>
                  </tr>

                  <tr className="total-row" style={{ borderTop: '2px solid var(--border)', fontSize: '15px' }}>
                    <td><strong>Estimated Total Trip Cost</strong></td>
                    <td style={{ color: isWithinBudget ? '#10b981' : '#f59e0b' }}>
                      {isWithinBudget ? '✅ Fits within your budget' : `⚠️ Exceeds budget by ${formatINR(totalCost - origBudget)}`}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--brand, #c26d38)', fontSize: '17px' }}>
                      {formatINR(estimatedCosts.total)}
                    </td>
                  </tr>

                  <tr>
                    <td><strong>Cost Per Person</strong></td>
                    <td style={{ color: 'var(--muted)' }}>For group of {itinerary.numberOfTravelers || 1} traveler(s)</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {formatINR(costBreakdown.lineItemSummary?.costPerPerson || Math.round(estimatedCosts.total / Math.max(1, itinerary.numberOfTravelers || 1)))}
                    </td>
                  </tr>

                  <tr>
                    <td><strong>Remaining Budget</strong></td>
                    <td style={{ color: 'var(--muted)' }}>Initial budget constraint: {formatINR(summary.originalBudget)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: isWithinBudget ? '#10b981' : '#ef4444' }}>
                      {isWithinBudget ? formatINR(origBudget - totalCost) : '₹0 (Budget Gap)'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* EV Charging & Stops Card (if applicable) */}
            {transportation.isEV && transportation.evPlan && (
              <div className="overview-box" style={{ border: '1px solid rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.08)' }}>
                <h4>
                  <Sparkles size={18} color="#10b981" />
                  ⚡ EV Smart Highway Charging Strategy ({transportation.evPlan.vehicleName})
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '10px' }}>
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Total Energy Needed</span>
                    <p style={{ fontWeight: 600, fontSize: '15px', color: '#fff' }}>{transportation.evPlan.totalEnergyNeededKwh} kWh</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Highway Charging Stops</span>
                    <p style={{ fontWeight: 600, fontSize: '15px', color: '#fff' }}>{transportation.evPlan.estimatedChargingStops} recommended stops</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Highway Fast Charging Cost</span>
                    <p style={{ fontWeight: 600, fontSize: '15px', color: '#fff' }}>{formatINR(transportation.evPlan.fastChargeCost)} (avg ₹21/kWh)</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Hotel Overnight Charging</span>
                    <p style={{ fontWeight: 600, fontSize: '15px', color: '#fff' }}>{formatINR(transportation.evPlan.slowChargeCost)} (avg ₹11/kWh)</p>
                  </div>
                </div>
              </div>
            )}

            {/* Local Transportation Specifics Card */}
            {costBreakdown.localTransport?.details && (
              <div className="overview-box">
                <h4>
                  <Compass size={18} color="#38bdf8" />
                  Local Transportation & Attraction Accessibility
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--ink)' }}>
                  <strong>Feasibility for Personal Car:</strong> {costBreakdown.localTransport.details.ownCarFeasibility}
                </p>
                <p style={{ fontSize: '13px', color: 'var(--ink)', marginTop: '4px' }}>
                  <strong>Recommendation:</strong> {costBreakdown.localTransport.details.recommendation}
                </p>
                {costBreakdown.localTransport.details.recommendedModes && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '10px' }}>
                    {costBreakdown.localTransport.details.recommendedModes.map((m, idx) => (
                      <div key={idx} style={{ background: 'var(--surface-soft, rgba(255,255,255,0.06))', padding: '8px 12px', borderRadius: '6px', fontSize: '12px' }}>
                        <strong>{m.name}</strong>: {m.costPerPerson ? `₹${m.costPerPerson} per person` : m.costPerGroup ? `₹${m.costPerGroup} per group` : `₹${m.costPerDay || 200}`}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Data Source Grounding Panel */}
            <div className="overview-box" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px dashed var(--border)' }}>
              <h4>
                <Sparkles size={16} color="#94a3b8" />
                Live Pricing Sources & Verification Timestamps
              </h4>
              <ul style={{ fontSize: '12px', color: 'var(--muted)', listStyle: 'none', paddingLeft: 0, marginTop: '8px', lineHeight: '1.8' }}>
                <li>✓ <strong>Fuel & EV Rates:</strong> Live State Petroleum Matrix (IOCL/BPCL) & Highway CPO Fast Charging Tariffs (Updated 2026)</li>
                <li>✓ <strong>Highway Toll Rates:</strong> NHAI FASTag Live Toll Schedules & Sukhad Yatra / IHMCL National Slabs</li>
                <li>✓ <strong>Stays & Lodging:</strong> Aggregated Real-World Hotel Tariffs with Destination & Seasonality Multipliers</li>
                <li>✓ <strong>Regional Dining:</strong> Local Restaurant Menu Benchmarks per Destination</li>
                <li>✓ <strong>Attraction Fees:</strong> Official ASI Heritage & State Tourism Department verified ticket tables</li>
              </ul>
            </div>
          </div>
        )}

        {/* 5. WEATHER & CLIMATE FIT TAB */}
        {activeTab === 'weather' && climateIntelligence.enabled && (
          <div>
            <div className="overview-box" style={{ marginBottom: '20px' }}>
              <h4>
                <CloudSun size={18} color="#f59e0b" />
                Seasonal Climate Intelligence
              </h4>
              <p style={{ color: 'var(--ink)' }}>
                <strong>Season:</strong> {climateIntelligence.travelSeason || 'Pleasant'} • <strong>Weather Safety:</strong> High
              </p>
            </div>

            <div className="weather-places-grid">
              {(climateIntelligence.recommendedPlaces || []).map((place, idx) => (
                <div key={idx} className="weather-place-card">
                  <div className="weather-card-top">
                    <h4>{place.name}</h4>
                    <span className="weather-score-badge">{place.matchScore}% Fit</span>
                  </div>
                  <div className="weather-stat-row">
                    <span>Weather</span>
                    <strong>{place.weatherCondition}</strong>
                  </div>
                  <div className="weather-stat-row">
                    <span>Temp Range</span>
                    <strong>{place.temperatureRange}</strong>
                  </div>
                  <div className="weather-stat-row">
                    <span>Best Activity</span>
                    <strong>{place.bestActivity}</strong>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                    {place.whyRecommended}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. FOOD & LOCAL RECOMMENDATIONS TAB */}
        {activeTab === 'recommendations' && (
          <div className="overview-cards-2">
            {recommendations.bestTime && (
              <div className="overview-box">
                <h4>
                  <Sparkles size={18} color="#14b8a6" />
                  Best Time & Seasons to Visit
                </h4>
                <ul className="overview-list">
                  {Object.entries(recommendations.bestTime).map(([season, info]) => (
                    <li key={season}>
                      <Check size={14} />
                      <span><strong>{season}:</strong> {info.reason} (Budget: {info.priceLevel})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {recommendations.companionSuggestions && (
              <div className="overview-box">
                <h4>
                  <Utensils size={18} color="#f59e0b" />
                  Group Recommendations
                </h4>
                <ul className="overview-list">
                  {recommendations.companionSuggestions.map((s, idx) => (
                    <li key={idx}>
                      <Sparkles size={14} />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* 7. ALTERNATIVES & 3 REALISTIC BUDGET OPTIONS TAB */}
        {activeTab === 'alternatives' && alternatives && alternatives.length > 0 && (
          <div>
            <div className="overview-box" style={{ marginBottom: '16px' }}>
              <h4>
                <Layers size={18} color="#14b8a6" />
                Three Realistic Trip Tiers (Calculated from Actual Real-World Costs)
              </h4>
              <p style={{ fontSize: '13px', color: 'var(--ink)' }}>
                Each option is calculated from real itemized fuel, toll, stay, dining, and activity costs—never arbitrary percentage formulas.
              </p>
            </div>

            <div className="alternatives-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
              {alternatives.map((alt, idx) => {
                const total = alt.totalCost || alt.estimatedCost || 0;
                const perPerson = alt.perPersonCost || Math.round(total / Math.max(1, itinerary.numberOfTravelers || 1));
                const fitsBudget = total <= origBudget;

                return (
                  <div key={idx} className="alt-card" style={{ borderColor: fitsBudget ? '#10b981' : 'var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: fitsBudget ? '#10b981' : 'var(--brand, #c26d38)', fontWeight: 700 }}>
                        {alt.tier || alt.name}
                      </span>
                      {fitsBudget && (
                        <span style={{ fontSize: '11px', background: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7', padding: '2px 8px', borderRadius: '4px' }}>
                          ✓ Fits Budget
                        </span>
                      )}
                    </div>

                    <h4>{alt.label || alt.name}</h4>
                    <p style={{ color: 'var(--muted)', fontSize: '13px', minHeight: '38px' }}>{alt.description}</p>

                    <div style={{ margin: '14px 0', padding: '12px', background: 'var(--surface-soft, rgba(255,255,255,0.04))', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Total Cost:</span>
                        <strong style={{ fontSize: '17px', color: '#fff' }}>{formatINR(total)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Per Person:</span>
                        <strong style={{ fontSize: '14px', color: 'var(--brand, #c26d38)' }}>{formatINR(perPerson)}</strong>
                      </div>
                    </div>

                    {alt.breakdown && (
                      <ul style={{ fontSize: '12px', color: 'var(--muted)', paddingLeft: '16px', lineHeight: '1.7' }}>
                        <li><strong>Stay:</strong> {formatINR(alt.breakdown.stay)} {alt.stayType ? `(${alt.stayType})` : ''}</li>
                        <li><strong>Food:</strong> {formatINR(alt.breakdown.food)} {alt.foodType ? `(${alt.foodType})` : ''}</li>
                        <li><strong>Local Transit:</strong> {formatINR(alt.breakdown.localTransit)}</li>
                        <li><strong>Activities:</strong> {formatINR(alt.breakdown.activities)}</li>
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ItineraryDisplay;

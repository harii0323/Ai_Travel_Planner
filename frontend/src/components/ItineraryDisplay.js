import React, { useEffect, useState } from 'react';
import api from '../api';
import '../styles/ItineraryDisplay.css';
import RouteMap from './RouteMap';

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

function ItineraryDisplay({ data }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedDay, setExpandedDay] = useState(null);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [saveMessage, setSaveMessage] = useState('');
  const [editableDayPlans, setEditableDayPlans] = useState([]);
  const [newPlaceByDay, setNewPlaceByDay] = useState({});
  const [editingActivity, setEditingActivity] = useState(null);
  const [editingActivityName, setEditingActivityName] = useState('');

  const itinerary = buildDisplayItinerary(data);
  const rawDayPlans = itinerary?.dayPlans;

  useEffect(() => {
    setEditableDayPlans(Array.isArray(rawDayPlans) ? rawDayPlans : []);
    setNewPlaceByDay({});
    setEditingActivity(null);
    setEditingActivityName('');
    setSaveStatus('idle');
    setSaveMessage('');
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

  const recommendations = itinerary.recommendations || data?.recommendations || {};
  const displayedDayPlans = editableDayPlans.length > 0 ? editableDayPlans : dayPlans;
  const firstDay = displayedDayPlans?.[0]?.day || null;

  const formatINR = (value) => {
    if (value == null || Number.isNaN(Number(value))) return '-';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(value);
  };

  const markPlanEdited = () => {
    setSaveStatus('idle');
    setSaveMessage('Unsaved itinerary changes.');
  };

  const handleNewPlaceChange = (day, value) => {
    setNewPlaceByDay((current) => ({
      ...current,
      [day]: value
    }));
  };

  const handleAddPlace = (day) => {
    const name = (newPlaceByDay[day] || '').trim();
    if (!name) return;

    setEditableDayPlans((plans) => plans.map((plan) => {
      if (plan.day !== day) return plan;

      return {
        ...plan,
        activities: [
          ...(plan.activities || []),
          {
            name,
            cost: 0,
            isCustom: true
          }
        ]
      };
    }));
    setNewPlaceByDay((current) => ({
      ...current,
      [day]: ''
    }));
    markPlanEdited();
  };

  const handleRemovePlace = (day, activityIndex) => {
    setEditableDayPlans((plans) => plans.map((plan) => {
      if (plan.day !== day) return plan;

      return {
        ...plan,
        activities: (plan.activities || []).filter((_, idx) => idx !== activityIndex)
      };
    }));
    if (editingActivity?.day === day && editingActivity?.activityIndex === activityIndex) {
      setEditingActivity(null);
      setEditingActivityName('');
    }
    markPlanEdited();
  };

  const startEditPlace = (day, activityIndex, name) => {
    setEditingActivity({ day, activityIndex });
    setEditingActivityName(name || '');
  };

  const cancelEditPlace = () => {
    setEditingActivity(null);
    setEditingActivityName('');
  };

  const saveEditedPlace = () => {
    const name = editingActivityName.trim();
    if (!name || !editingActivity) return;

    setEditableDayPlans((plans) => plans.map((plan) => {
      if (plan.day !== editingActivity.day) return plan;

      return {
        ...plan,
        activities: (plan.activities || []).map((activity, idx) => (
          idx === editingActivity.activityIndex
            ? { ...activity, name }
            : activity
        ))
      };
    }));
    cancelEditPlace();
    markPlanEdited();
  };

  const openPlaceEditor = () => {
    setActiveTab('itinerary');
    if (firstDay && expandedDay == null) {
      setExpandedDay(firstDay);
    }
  };

  const handleSavePlan = async () => {
    if (saveStatus === 'saving' || saveStatus === 'saved') return;

    setSaveStatus('saving');
    setSaveMessage('');

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

      await api.post('/api/itinerary/save', {
        title: titleParts.join(' - ') || 'Saved travel plan',
        description: `${summary.startLocation || itinerary.details?.startLocation || 'Trip'} to ${summary.destination || 'destination'}`,
        itineraryData,
        tags: [summary.destination].filter(Boolean)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSaveStatus('saved');
      setSaveMessage('Saved to your account.');
    } catch (error) {
      setSaveStatus('error');
      setSaveMessage(error.response?.data?.error || 'Could not save this plan. Please try again.');
    }
  };

  return (
    <div className="itinerary-container">
      <div className="itinerary-header">
        <div className="itinerary-title-row">
          <h2>Your personalized travel itinerary</h2>
          <div className="save-plan-actions">
            <button
              type="button"
              className="edit-places-button"
              onClick={openPlaceEditor}
            >
              Edit places
            </button>
            <button
              type="button"
              className={`save-plan-button ${saveStatus === 'saved' ? 'saved' : ''}`}
              onClick={handleSavePlan}
              disabled={saveStatus === 'saving' || saveStatus === 'saved'}
            >
              {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save plan'}
            </button>
            {saveMessage && (
              <p className={`save-plan-message ${saveStatus === 'error' ? 'error' : 'success'}`}>
                {saveMessage}
              </p>
            )}
          </div>
        </div>
        <div className="trip-summary">
          <div className="summary-item">
            <span className="label">Destination:</span>
            <span className="value">{summary.destination}</span>
          </div>
          <div className="summary-item">
            <span className="label">Trip Duration:</span>
            <span className="value">{summary.totalDays} days</span>
          </div>
          <div className="summary-item">
            <span className="label">Budget:</span>
            <span className="value">{formatINR(summary.originalBudget)}</span>
          </div>
          <div className="summary-item">
            <span className="label">Estimated Cost:</span>
            <span className={`value ${summary.withinBudget ? 'within' : 'over'}`}>
              {formatINR(estimatedCosts.total)}
            </span>
          </div>
          {summary.arrivalDay && (
            <div className="summary-item">
              <span className="label">Reach Destination:</span>
              <span className="value">Day {summary.arrivalDay} {summary.arrivalDate && `(${summary.arrivalDate})`}</span>
            </div>
          )}
          {climateIntelligence.travelSeason && (
            <div className="summary-item">
              <span className="label">Travel Season:</span>
              <span className="value">{climateIntelligence.travelSeason}</span>
            </div>
          )}
        </div>
      </div>

      {tripPhases && (tripPhases.onwardJourney || tripPhases.destinationStay || tripPhases.returnJourney) && (
        <div className="route-section">
          <h3>Trip phases</h3>
          <div className="stops-list">
            {tripPhases.onwardJourney && (
              <div className="stop-card">
                <h5>Onward Journey</h5>
                <p><strong>Days:</strong> {tripPhases.onwardJourney.days}</p>
                <p><strong>Route:</strong> {tripPhases.onwardJourney.route?.from} to {tripPhases.onwardJourney.route?.to}</p>
                <p><strong>Attractions:</strong> {tripPhases.onwardJourney.attractions?.length || 0}</p>
              </div>
            )}
            {tripPhases.destinationStay && (
              <div className="stop-card">
                <h5>Destination Stay</h5>
                <p><strong>Days:</strong> {tripPhases.destinationStay.days}</p>
                <p><strong>Arrival:</strong> Day {tripPhases.destinationStay.arrivalDay} {tripPhases.destinationStay.arrivalDate && `(${tripPhases.destinationStay.arrivalDate})`}</p>
                <p><strong>Plans:</strong> {tripPhases.destinationStay.activities?.length || 0}</p>
              </div>
            )}
            {tripPhases.returnJourney && (
              <div className="stop-card">
                <h5>Return Journey</h5>
                <p><strong>Days:</strong> {tripPhases.returnJourney.days}</p>
                <p><strong>Route:</strong> {tripPhases.returnJourney.route?.from} to {tripPhases.returnJourney.route?.to}</p>
                <p><strong>New Attractions:</strong> {tripPhases.returnJourney.attractions?.length || 0}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Route Planning Section */}
      {route.primaryRoute && (
        <div className="route-section">
          <h3>Round-trip route planning</h3>
          <RouteMap route={route} />
          <div className="route-info">
            <div className="route-primary">
              <h4>Primary Route</h4>
              <div className="route-details">
                <p><strong>From:</strong> {route.primaryRoute.from}</p>
                <p><strong>To:</strong> {route.primaryRoute.to}</p>
                <p><strong>Distance:</strong> {route.primaryRoute.distance} km</p>
                <p><strong>Estimated Duration:</strong> {route.primaryRoute.estimatedDuration}</p>
                <p><strong>Transport Mode:</strong> {route.primaryRoute.transportMode}</p>
                {route.feasibility && (
                  <>
                    <p><strong>Plan realism:</strong> {route.feasibility.status}</p>
                    <p><strong>Suggested pace:</strong> {route.feasibility.minimumComfortableDays} days for comfort</p>
                  </>
                )}
              </div>
            </div>

            {route.intermediateStops && route.intermediateStops.length > 0 && (
              <div className="route-stops">
                <h4>Recommended Intermediate Stops</h4>
                <div className="stops-list">
                  {route.intermediateStops.map((stop, idx) => (
                    <div key={idx} className="stop-card">
                      <h5>{stop.name}</h5>
                      <div className="stop-details">
                        <span className="category">{stop.category}</span>
                        <span className="rating">{stop.rating}/5</span>
                        {stop.matchScore && <span className="rating">{stop.matchScore}% match</span>}
                      </div>
                      <div className="stop-meta">
                        <p><strong>Phase:</strong> {stop.phase || 'Route stop'}</p>
                        <p><strong>Distance from route:</strong> {stop.distanceFromRouteKm || stop.distance} km</p>
                        <p><strong>Visit time:</strong> {stop.suggestedVisitDuration || `${stop.visitTime} hours`}</p>
                        {stop.climateRecommendation && (
                          <>
                            <p><strong>Season:</strong> {stop.climateRecommendation.season}</p>
                            <p><strong>Weather condition:</strong> {stop.climateRecommendation.weatherCondition}</p>
                            <p><strong>Current climate:</strong> {stop.climateRecommendation.currentClimate}</p>
                            <p><strong>Temperature:</strong> {stop.climateRecommendation.temperatureRange}</p>
                            <p><strong>Forecast:</strong> {stop.climateRecommendation.weatherForecast}</p>
                            <p><strong>Best activity:</strong> {stop.climateRecommendation.bestActivity}</p>
                            <p><strong>Suitable activities:</strong> {(stop.climateRecommendation.suitableActivities || []).join(', ') || 'Weather-safe sightseeing'}</p>
                            {stop.climateRecommendation.unsuitableActivities?.length > 0 && (
                              <p><strong>Move/Avoid:</strong> {stop.climateRecommendation.unsuitableActivities.join(', ')}</p>
                            )}
                            <p><strong>Camping:</strong> {stop.climateRecommendation.campingSuitability}</p>
                            <p><strong>Weather risk:</strong> {stop.climateRecommendation.weatherRiskLevel}</p>
                          </>
                        )}
                        {stop.reason && <p><strong>Why:</strong> {stop.reason}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="warnings-section">
          <h3>Important notes</h3>
          {warnings.map((warning, idx) => (
            <p key={idx} className="warning-item">{warning}</p>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab ${activeTab === 'costs' ? 'active' : ''}`}
          onClick={() => setActiveTab('costs')}
        >
          Cost breakdown
        </button>
        <button
          className={`tab ${activeTab === 'itinerary' ? 'active' : ''}`}
          onClick={openPlaceEditor}
        >
          Edit places
        </button>
        <button
          className={`tab ${activeTab === 'tips' ? 'active' : ''}`}
          onClick={() => setActiveTab('tips')}
        >
          Money tips
        </button>
        {Object.keys(recommendations).length > 0 && (
          <button
            className={`tab ${activeTab === 'recommendations' ? 'active' : ''}`}
            onClick={() => setActiveTab('recommendations')}
          >
            Recommendations
          </button>
        )}
        {climateIntelligence.enabled && (
          <button
            className={`tab ${activeTab === 'climate' ? 'active' : ''}`}
            onClick={() => setActiveTab('climate')}
          >
            Weather fit
          </button>
        )}
        {alternatives && alternatives.length > 0 && (
          <button
            className={`tab ${activeTab === 'alternatives' ? 'active' : ''}`}
            onClick={() => setActiveTab('alternatives')}
          >
            Alternatives
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="overview-section">
            <div className="cost-summary">
              <h3>Cost Summary</h3>
              <div className="cost-cards">
                <div className="cost-card transport">
                  <span className="icon">✈️</span>
                  <span className="category">Transport</span>
                  <span className="cost">{formatINR(estimatedCosts.mainTransport)}</span>
                </div>
                <div className="cost-card accommodation">
                  <span className="icon">🏨</span>
                  <span className="category">Accommodation</span>
                  <span className="cost">{formatINR(estimatedCosts.accommodation)}</span>
                </div>
                <div className="cost-card food">
                  <span className="icon">🍽️</span>
                  <span className="category">Food</span>
                  <span className="cost">{formatINR(estimatedCosts.food)}</span>
                </div>
                <div className="cost-card activities">
                  <span className="icon">🎭</span>
                  <span className="category">Activities</span>
                  <span className="cost">{formatINR(estimatedCosts.activities)}</span>
                </div>
                <div className="cost-card misc">
                  <span className="icon">🎒</span>
                  <span className="category">Miscellaneous</span>
                  <span className="cost">{formatINR(estimatedCosts.miscellaneous)}</span>
                </div>
                <div className="cost-card total">
                  <span className="icon">💵</span>
                  <span className="category">Total</span>
                  <span className="cost">{formatINR(estimatedCosts.total)}</span>
                </div>
              </div>
            </div>

            <div className="accommodation-info">
              <h3>🏨 Accommodation Details</h3>
              <div className="info-card">
                <p><strong>Type:</strong> {costBreakdown.accommodation?.type || costBreakdown.accommodation?.accommodationType || 'N/A'}</p>
                <p><strong>Cost per Night:</strong> {formatINR(costBreakdown.accommodation?.perNight || costBreakdown.accommodation?.costPerNight)}</p>
                <p><strong>Number of Nights:</strong> {costBreakdown.accommodation?.nights || costBreakdown.accommodation?.numNights || 0}</p>
                <p><strong>Total:</strong> {formatINR(costBreakdown.accommodation?.total || costBreakdown.accommodation?.totalCost)}</p>
              </div>

              {accommodationSuggestions && (
                <div className="suggestions">
                  <h4>Booking Tips:</h4>
                  <ul>
                    {accommodationSuggestions.map((suggestion, idx) => (
                      <li key={idx}>{suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="food-info">
              <h3>🍽️ Food & Dining Estimates</h3>
              <div className="info-card">
                <p><strong>Daily Food Budget:</strong> {formatINR(costBreakdown.food?.dailyTotal || costBreakdown.food?.perPersonPerDay)}</p>
                <p><strong>Breakdown:</strong> Breakfast {formatINR(costBreakdown.food?.breakfast || costBreakdown.food?.breakdown?.breakfast)} | Lunch {formatINR(costBreakdown.food?.lunch || costBreakdown.food?.breakdown?.lunch)} | Dinner {formatINR(costBreakdown.food?.dinner || costBreakdown.food?.breakdown?.dinner)}</p>
                <p><strong>Trip Total:</strong> {formatINR(costBreakdown.food?.tripTotal || costBreakdown.food?.totalCost)}</p>
              </div>

              {foodRecommendations && (
                <div className="suggestions">
                  <h4>Dining Recommendations:</h4>
                  <ul>
                    {foodRecommendations.map((rec, idx) => (
                      <li key={idx}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Costs Tab */}
        {activeTab === 'costs' && (
          <div className="costs-section">
            <h3>Detailed Cost Breakdown</h3>

            <div className="cost-detail-cards">
              {/* Transportation Cost Details */}
              <div className="cost-detail-card">
                <h4>Transportation</h4>
                {transportation.mode ? (
                  <div>
                    <p className="mode"><strong>Mode:</strong> {transportation.mode}</p>
                    <p><strong>Base Cost per Person:</strong> {formatINR(transportation.baseCostPerPerson || 0)}</p>
                    <p><strong>Number of Travelers:</strong> {transportation.numTravelers}</p>
                    <p><strong>Distance:</strong> {transportation.distance} km</p>
                    <p className="total-cost"><strong>Total Transport Cost:</strong> {formatINR(transportation.totalCost)}</p>
                  </div>
                ) : transportation.vehicleType ? (
                  <div>
                    <p className="mode"><strong>Vehicle:</strong> {transportation.vehicleType} ({transportation.fuelType})</p>
                    <p><strong>Mileage:</strong> {transportation.mileage} km/l</p>
                    <p><strong>Fuel Required:</strong> {transportation.fuelRequired} litres</p>
                    <p><strong>Fuel Cost:</strong> {formatINR(transportation.fuelCost)}</p>
                    {transportation.tollCost > 0 && <p><strong>Toll Charges:</strong> {formatINR(transportation.tollCost)}</p>}
                    <p className="total-cost"><strong>Total Transport Cost:</strong> {formatINR(transportation.totalCost)}</p>
                  </div>
                ) : (
                  <p>Transport details not available</p>
                )}
              </div>

              {/* Accommodation Cost Details */}
              <div className="cost-detail-card">
                <h4>Accommodation</h4>
                <table>
                  <tbody>
                    <tr>
                      <td>Type:</td>
                      <td>{costBreakdown.accommodation?.type || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td>Cost per Night:</td>
                      <td>{formatINR(costBreakdown.accommodation?.costPerNight || 0)}</td>
                    </tr>
                    <tr>
                      <td>Number of Nights:</td>
                      <td>{costBreakdown.accommodation?.numNights || 0}</td>
                    </tr>
                    <tr>
                      <td>Number of Travelers:</td>
                      <td>{costBreakdown.accommodation?.numTravelers || 1}</td>
                    </tr>
                    <tr className="total-row">
                      <td><strong>Total:</strong></td>
                      <td><strong>{formatINR(costBreakdown.accommodation?.totalCost || 0)}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Food Cost Details */}
              <div className="cost-detail-card">
                <h4>Food</h4>
                <table>
                  <tbody>
                    <tr>
                      <td>Per Person per Day:</td>
                      <td>{formatINR(costBreakdown.food?.perPersonPerDay || 0)}</td>
                    </tr>
                    <tr>
                      <td>Number of Travelers:</td>
                      <td>{costBreakdown.food?.numTravelers || 1}</td>
                    </tr>
                    <tr>
                      <td>Number of Days:</td>
                      <td>{costBreakdown.food?.numDays || 1}</td>
                    </tr>
                    <tr className="total-row">
                      <td><strong>Total Food Cost:</strong></td>
                      <td><strong>{formatINR(costBreakdown.food?.totalCost || 0)}</strong></td>
                    </tr>
                  </tbody>
                </table>
                {costBreakdown.food?.breakdown && (
                  <div className="food-breakdown">
                    <p><strong>Daily Breakdown:</strong></p>
                    <p>Breakfast: {formatINR(costBreakdown.food.breakdown.breakfast)} | Lunch: {formatINR(costBreakdown.food.breakdown.lunch)} | Dinner: {formatINR(costBreakdown.food.breakdown.dinner)}</p>
                  </div>
                )}
              </div>

              {/* Activities Cost Details */}
              {costBreakdown.activities?.breakdown && costBreakdown.activities.breakdown.length > 0 && (
                <div className="cost-detail-card">
                  <h4>Activities and entry fees</h4>
                  <div className="activities-breakdown">
                    {costBreakdown.activities.breakdown.map((activity, idx) => (
                      <div key={idx} className="activity-cost-item">
                        <p><strong>{activity.name}</strong></p>
                        <p>Cost per Person: {formatINR(activity.costPerPerson)} × {activity.numTravelers} travelers = {formatINR(activity.totalCost)}</p>
                      </div>
                    ))}
                    <div className="activity-total">
                      <p><strong>Total Activities Cost:</strong> {formatINR(costBreakdown.activities.totalCost)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Miscellaneous Costs */}
              <div className="cost-detail-card">
                <h4>Miscellaneous</h4>
                <p><strong>Amount:</strong> {formatINR(costBreakdown.miscellaneous?.amount || estimatedCosts.miscellaneous)}</p>
                <p className="misc-description">{costBreakdown.miscellaneous?.description || 'Emergency funds, local transport, tips, and miscellaneous expenses'}</p>
              </div>
            </div>

            {/* Budget Comparison */}
            <div className="budget-comparison">
              <h4>Budget vs Estimated Cost</h4>
              <div className="comparison-chart">
                <div className="budget-bar">
                  <div
                    className={`budget-allocated ${summary.withinBudget ? 'within' : 'over'}`}
                    style={{
                      width: `${Math.min((estimatedCosts.total / summary.originalBudget) * 100, 100)}%`
                    }}
                  >
                    {formatINR(estimatedCosts.total)}
                  </div>
                </div>
                <div className="budget-info">
                  <p><strong>Your Budget:</strong> {formatINR(summary.originalBudget)}</p>
                  <p><strong>Estimated Cost:</strong> {formatINR(estimatedCosts.total)}</p>
                  <p className={`budget-status ${summary.withinBudget ? 'within' : 'over'}`}>
                    {summary.withinBudget ? 'Within budget' : `Over budget by ${formatINR(estimatedCosts.total - summary.originalBudget)}`}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Itinerary Tab */}
        {activeTab === 'itinerary' && (
          <div className="itinerary-section">
            <h3>Day-by-day itinerary</h3>
            <div className="day-plans">
              {displayedDayPlans && displayedDayPlans.map((day) => (
                <div
                  key={day.day}
                  className="day-card"
                >
                  <button
                    type="button"
                    className="day-header"
                    onClick={() => setExpandedDay(expandedDay === day.day ? null : day.day)}
                  >
                    <h4>Day {day.day}{day.phase ? ` - ${day.phase}` : ''}</h4>
                    {day.date && <span className="day-date">{day.date}</span>}
                    <span className="expand-icon">{expandedDay === day.day ? '▼' : '▶'}</span>
                  </button>
                  {expandedDay === day.day && (
                    <div className="day-content">
                      <p className="day-plan">{day.plan}</p>
                      <div className="activities-list editable-activities-list">
                        <div className="activities-title-row">
                          <h5>Places and activities:</h5>
                        </div>
                        {day.activities && day.activities.length > 0 ? (
                          <ul>
                            {day.activities.map((activity, idx) => {
                              const isEditing = editingActivity?.day === day.day && editingActivity?.activityIndex === idx;

                              return (
                                <li key={`${activity.name}-${idx}`} className="editable-activity-item">
                                  {isEditing ? (
                                    <div className="edit-place-form">
                                      <input
                                        type="text"
                                        value={editingActivityName}
                                        onChange={(event) => setEditingActivityName(event.target.value)}
                                        onKeyDown={(event) => {
                                          if (event.key === 'Enter') saveEditedPlace();
                                          if (event.key === 'Escape') cancelEditPlace();
                                        }}
                                        aria-label="Edit place name"
                                        autoFocus
                                      />
                                      <button type="button" className="place-action save" onClick={saveEditedPlace}>
                                        Save
                                      </button>
                                      <button type="button" className="place-action secondary" onClick={cancelEditPlace}>
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <>
                                      <span className="activity-name">
                                        {activity.name} {activity.cost > 0 && `- ${formatINR(activity.cost)}`}
                                      </span>
                                      <span className="activity-actions">
                                        <button
                                          type="button"
                                          className="place-action secondary"
                                          onClick={() => startEditPlace(day.day, idx, activity.name)}
                                        >
                                          Edit
                                        </button>
                                        <button
                                          type="button"
                                          className="place-action danger"
                                          onClick={() => handleRemovePlace(day.day, idx)}
                                        >
                                          Remove
                                        </button>
                                      </span>
                                    </>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="empty-activities">No places planned for this day.</p>
                        )}
                        <div className="add-place-form">
                          <input
                            type="text"
                            value={newPlaceByDay[day.day] || ''}
                            onChange={(event) => handleNewPlaceChange(day.day, event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') handleAddPlace(day.day);
                            }}
                            placeholder="Add a place you want to visit"
                            aria-label={`Add place to day ${day.day}`}
                          />
                          <button type="button" className="place-action add" onClick={() => handleAddPlace(day.day)}>
                            Add place
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tips Tab */}
        {activeTab === 'tips' && (
          <div className="tips-section">
            <h3>Money-saving tips for students</h3>
            <div className="tips-list">
              {moneyTips && moneyTips.map((tip, idx) => (
                <div key={idx} className="tip-item">
                  <p>{tip}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations Tab */}
        {activeTab === 'recommendations' && Object.keys(recommendations).length > 0 && (
          <div className="recommendations-section">
            <h3>Personalized recommendations</h3>
            
            {recommendations.bestTime && (
              <div className="best-time-card">
                <h4>Best time to visit {summary.destination}</h4>
                <div className="seasons-grid">
                  {Object.entries(recommendations.bestTime).map(([season, info]) => (
                    <div key={season} className="season-card">
                      <h5>{season}</h5>
                      <p className="reason">{info.reason}</p>
                      <p className="price-level">
                        <strong>Budget Level:</strong> {info.priceLevel}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {recommendations.companionSuggestions && (
              <div className="companion-suggestions">
                <h4>Activities for your group type</h4>
                <div className="suggestions-list">
                  {recommendations.companionSuggestions.map((suggestion, idx) => (
                    <div key={idx} className="suggestion-item">
                      <p>{suggestion}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {recommendations.groupActivities && (
              <div className="group-activities">
                <h4>Group-specific experiences</h4>
                <div className="activities-list">
                  {recommendations.groupActivities.map((activity, idx) => (
                    <div key={idx} className="activity-item">
                      <p>{activity}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Weather Tab */}
        {activeTab === 'climate' && climateIntelligence.enabled && (
          <div className="climate-section">
            <h3>Weather-based activity planning</h3>
            <div className="info-card">
              <p><strong>Travel season:</strong> {climateIntelligence.travelSeason}</p>
              <p><strong>Scoring model:</strong> {climateIntelligence.scoringModel}</p>
              <p><strong>Data sources:</strong> {(climateIntelligence.dataSources || []).join(', ') || 'seasonal estimates'}</p>
            </div>

            <div className="climate-place-grid">
              {(climateIntelligence.recommendedPlaces || []).map((place, idx) => (
                <div key={`${place.name}-${idx}`} className="climate-card">
                  <div className="climate-card-header">
                    <h4>{place.name}</h4>
                    <span>{place.matchScore}%</span>
                  </div>
                  <p><strong>Season:</strong> {place.season}</p>
                  <p><strong>Weather condition:</strong> {place.weatherCondition}</p>
                  <p><strong>Climate fit:</strong> {place.currentClimate}</p>
                  <p><strong>Temperature:</strong> {place.temperatureRange}</p>
                  <p><strong>Forecast:</strong> {place.weatherForecast}</p>
                  <p><strong>Best activity:</strong> {place.bestActivity}</p>
                  <p><strong>Suitable activities:</strong> {(place.suitableActivities || []).join(', ') || 'Weather-safe sightseeing'}</p>
                  {place.unsuitableActivities?.length > 0 && (
                    <p><strong>Move/Avoid:</strong> {place.unsuitableActivities.join(', ')}</p>
                  )}
                  <p><strong>Best time:</strong> {place.bestTimeToVisit}</p>
                  <p><strong>Stay duration:</strong> {place.recommendedStayDuration}</p>
                  <p><strong>Camping:</strong> {place.campingSuitability}</p>
                  <p><strong>Rescheduling:</strong> {place.rescheduleAdvice}</p>
                  <p><strong>Weather risk:</strong> {place.weatherRiskLevel}</p>
                  <p><strong>Why:</strong> {place.whyRecommended}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Alternatives Tab */}
        {activeTab === 'alternatives' && alternatives && alternatives.length > 0 && (
          <div className="alternatives-section">
            <h3>Alternative plans to fit your budget</h3>
            <div className="alternatives-cards">
              {alternatives.map((alt, idx) => (
                <div key={idx} className="alternative-card">
                  <h4>{alt.name}</h4>
                  <p className="description">{alt.description}</p>
                  {alt.days && (
                    <p><strong>Duration:</strong> {alt.days} days</p>
                  )}
                  <p className="cost"><strong>Estimated Cost:</strong> {formatINR(alt.estimatedCost)}</p>
                  <p className="savings"><strong>Savings:</strong> {formatINR(alt.savings)}</p>
                  {alt.pros && (
                    <div className="pros-cons">
                      <p><strong>Pros:</strong> {alt.pros}</p>
                    </div>
                  )}
                  {alt.cons && (
                    <div className="pros-cons">
                      <p><strong>Cons:</strong> {alt.cons}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ItineraryDisplay;

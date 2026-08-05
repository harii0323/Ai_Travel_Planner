import React, { useState } from 'react';
import '../styles/ItineraryDisplay.css';

function ItineraryDisplay({ data }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedDay, setExpandedDay] = useState(null);

  const itinerary = data?.itinerary || data;

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
    tripPhases = {}
  } = itinerary;

  const formatINR = (value) => {
    if (value == null || Number.isNaN(Number(value))) return '-';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(value);
  };

  return (
    <div className="itinerary-container">
      <div className="itinerary-header">
        <h2>Your personalized travel itinerary</h2>
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
          <div className="route-info">
            <div className="route-primary">
              <h4>Primary Route</h4>
              <div className="route-details">
                <p><strong>From:</strong> {route.primaryRoute.from}</p>
                <p><strong>To:</strong> {route.primaryRoute.to}</p>
                <p><strong>Distance:</strong> {route.primaryRoute.distance} km</p>
                <p><strong>Estimated Duration:</strong> {route.primaryRoute.estimatedDuration}</p>
                <p><strong>Transport Mode:</strong> {route.primaryRoute.transportMode}</p>
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
                      </div>
                      <div className="stop-meta">
                        <p><strong>Phase:</strong> {stop.phase || 'Route stop'}</p>
                        <p><strong>Distance from route:</strong> {stop.distanceFromRouteKm || stop.distance} km</p>
                        <p><strong>Visit time:</strong> {stop.suggestedVisitDuration || `${stop.visitTime} hours`}</p>
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
          onClick={() => setActiveTab('itinerary')}
        >
          Day by day
        </button>
        <button
          className={`tab ${activeTab === 'tips' ? 'active' : ''}`}
          onClick={() => setActiveTab('tips')}
        >
          Money tips
        </button>
        {data.recommendations && (Object.keys(data.recommendations).length > 0) && (
          <button
            className={`tab ${activeTab === 'recommendations' ? 'active' : ''}`}
            onClick={() => setActiveTab('recommendations')}
          >
            Recommendations
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
              {dayPlans && dayPlans.map((day) => (
                <div
                  key={day.day}
                  className="day-card"
                  onClick={() => setExpandedDay(expandedDay === day.day ? null : day.day)}
                >
                  <div className="day-header">
                    <h4>Day {day.day}{day.phase ? ` - ${day.phase}` : ''}</h4>
                    {day.date && <span className="day-date">{day.date}</span>}
                    <span className="expand-icon">{expandedDay === day.day ? '▼' : '▶'}</span>
                  </div>
                  {expandedDay === day.day && (
                    <div className="day-content">
                      <p className="day-plan">{day.plan}</p>
                      {day.activities && day.activities.length > 0 && (
                        <div className="activities-list">
                          <h5>Activities:</h5>
                          <ul>
                            {day.activities.map((activity, idx) => (
                              <li key={idx}>
                                {activity.name} {activity.cost > 0 && `- ${formatINR(activity.cost)}`}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
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
        {activeTab === 'recommendations' && data.recommendations && (
          <div className="recommendations-section">
            <h3>Personalized recommendations</h3>
            
            {data.recommendations.bestTime && (
              <div className="best-time-card">
                <h4>Best time to visit {summary.destination}</h4>
                <div className="seasons-grid">
                  {Object.entries(data.recommendations.bestTime).map(([season, info]) => (
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

            {data.recommendations.companionSuggestions && (
              <div className="companion-suggestions">
                <h4>Activities for your group type</h4>
                <div className="suggestions-list">
                  {data.recommendations.companionSuggestions.map((suggestion, idx) => (
                    <div key={idx} className="suggestion-item">
                      <p>{suggestion}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.recommendations.groupActivities && (
              <div className="group-activities">
                <h4>Group-specific experiences</h4>
                <div className="activities-list">
                  {data.recommendations.groupActivities.map((activity, idx) => (
                    <div key={idx} className="activity-item">
                      <p>{activity}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
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

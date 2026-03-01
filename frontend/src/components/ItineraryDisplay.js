import React, { useState } from 'react';
import '../styles/ItineraryDisplay.css';

function ItineraryDisplay({ data }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedDay, setExpandedDay] = useState(null);

  if (!data || !data.success) {
    return (
      <div className="error-container">
        <h2>❌ Error Generating Itinerary</h2>
        <p>{data?.error || data?.message || 'Unknown error occurred'}</p>
      </div>
    );
  }

  const {
    summary,
    estimatedCosts,
    dayPlans,
    moneyTips,
    costBreakdown,
    accommodationSuggestions,
    foodRecommendations,
    alternatives,
    warnings
  } = data;

  const budgetStatus = summary.budgetStatus === 'WITHIN_BUDGET' ? '✅' : '⚠️';

  return (
    <div className="itinerary-container">
      <div className="itinerary-header">
        <h2>✈️ Your Personalized Travel Itinerary</h2>
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
            <span className="value">${summary.originalBudget}</span>
          </div>
          <div className="summary-item">
            <span className="label">Estimated Cost:</span>
            <span className={`value ${summary.withinBudget ? 'within' : 'over'}`}>
              {budgetStatus} ${estimatedCosts.total}
            </span>
          </div>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="warnings-section">
          <h3>⚠️ Important Notes</h3>
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
          📊 Overview
        </button>
        <button
          className={`tab ${activeTab === 'costs' ? 'active' : ''}`}
          onClick={() => setActiveTab('costs')}
        >
          💰 Cost Breakdown
        </button>
        <button
          className={`tab ${activeTab === 'itinerary' ? 'active' : ''}`}
          onClick={() => setActiveTab('itinerary')}
        >
          📅 Day-by-Day
        </button>
        <button
          className={`tab ${activeTab === 'tips' ? 'active' : ''}`}
          onClick={() => setActiveTab('tips')}
        >
          💡 Money Tips
        </button>
        {data.recommendations && (Object.keys(data.recommendations).length > 0) && (
          <button
            className={`tab ${activeTab === 'recommendations' ? 'active' : ''}`}
            onClick={() => setActiveTab('recommendations')}
          >
            ✨ Recommendations
          </button>
        )}
        {alternatives && alternatives.length > 0 && (
          <button
            className={`tab ${activeTab === 'alternatives' ? 'active' : ''}`}
            onClick={() => setActiveTab('alternatives')}
          >
            🔄 Alternatives
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
                  <span className="cost">${estimatedCosts.mainTransport}</span>
                </div>
                <div className="cost-card accommodation">
                  <span className="icon">🏨</span>
                  <span className="category">Accommodation</span>
                  <span className="cost">${estimatedCosts.accommodation}</span>
                </div>
                <div className="cost-card food">
                  <span className="icon">🍽️</span>
                  <span className="category">Food</span>
                  <span className="cost">${estimatedCosts.food}</span>
                </div>
                <div className="cost-card activities">
                  <span className="icon">🎭</span>
                  <span className="category">Activities</span>
                  <span className="cost">${estimatedCosts.activities}</span>
                </div>
                <div className="cost-card misc">
                  <span className="icon">🎒</span>
                  <span className="category">Miscellaneous</span>
                  <span className="cost">${estimatedCosts.miscellaneous}</span>
                </div>
                <div className="cost-card total">
                  <span className="icon">💵</span>
                  <span className="category">Total</span>
                  <span className="cost">${estimatedCosts.total}</span>
                </div>
              </div>
            </div>

            <div className="accommodation-info">
              <h3>🏨 Accommodation Details</h3>
              <div className="info-card">
                <p><strong>Type:</strong> {costBreakdown.accommodation.type}</p>
                <p><strong>Cost per Night:</strong> ${costBreakdown.accommodation.perNight}</p>
                <p><strong>Number of Nights:</strong> {costBreakdown.accommodation.nights}</p>
                <p><strong>Total:</strong> ${costBreakdown.accommodation.total}</p>
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
                <p><strong>Daily Food Budget:</strong> ${costBreakdown.food.dailyTotal}</p>
                <p><strong>Breakdown:</strong> Breakfast ${costBreakdown.food.breakfast} | Lunch ${costBreakdown.food.lunch} | Dinner ${costBreakdown.food.dinner}</p>
                <p><strong>Trip Total:</strong> ${costBreakdown.food.tripTotal}</p>
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
              <div className="cost-detail-card">
                <h4>✈️ Transport</h4>
                <p className="mode">Mode: {costBreakdown.transport.mode}</p>
                <p><strong>Cost:</strong> ${costBreakdown.transport.estimatedCost}</p>
                <p className="note">Student discount: Applied (15-25%)</p>
              </div>

              <div className="cost-detail-card">
                <h4>🏨 Accommodation</h4>
                <table>
                  <tbody>
                    <tr>
                      <td>Type:</td>
                      <td>{costBreakdown.accommodation.type}</td>
                    </tr>
                    <tr>
                      <td>Per Night:</td>
                      <td>${costBreakdown.accommodation.perNight}</td>
                    </tr>
                    <tr>
                      <td>Nights:</td>
                      <td>{costBreakdown.accommodation.nights}</td>
                    </tr>
                    <tr className="total-row">
                      <td><strong>Total:</strong></td>
                      <td><strong>${costBreakdown.accommodation.total}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="cost-detail-card">
                <h4>🍽️ Food</h4>
                <table>
                  <tbody>
                    <tr>
                      <td>Breakfast:</td>
                      <td>${costBreakdown.food.breakfast}</td>
                    </tr>
                    <tr>
                      <td>Lunch:</td>
                      <td>${costBreakdown.food.lunch}</td>
                    </tr>
                    <tr>
                      <td>Dinner:</td>
                      <td>${costBreakdown.food.dinner}</td>
                    </tr>
                    <tr>
                      <td>Daily Total:</td>
                      <td>${costBreakdown.food.dailyTotal}</td>
                    </tr>
                    <tr className="total-row">
                      <td><strong>Trip Total:</strong></td>
                      <td><strong>${costBreakdown.food.tripTotal}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="budget-comparison">
              <h4>Budget Comparison</h4>
              <div className="comparison-chart">
                <div className="budget-bar">
                  <div className="budget-allocated" style={{
                    width: `${(estimatedCosts.total / summary.originalBudget) * 100}%`
                  }}>
                    ${estimatedCosts.total}
                  </div>
                </div>
                <p>Budget: ${summary.originalBudget}</p>
              </div>
            </div>
          </div>
        )}

        {/* Itinerary Tab */}
        {activeTab === 'itinerary' && (
          <div className="itinerary-section">
            <h3>📅 Day-by-Day Itinerary</h3>
            <div className="day-plans">
              {dayPlans && dayPlans.map((day) => (
                <div
                  key={day.day}
                  className="day-card"
                  onClick={() => setExpandedDay(expandedDay === day.day ? null : day.day)}
                >
                  <div className="day-header">
                    <h4>Day {day.day}</h4>
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
                                {activity.name} {activity.cost > 0 && `- $${activity.cost}`}
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
            <h3>💡 Money-Saving Tips for Students</h3>
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
            <h3>✨ Personalized Recommendations</h3>
            
            {data.recommendations.bestTime && (
              <div className="best-time-card">
                <h4>🗓️ Best Time to Visit {summary.destination}</h4>
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
                <h4>👥 Activities Perfect for Your Group Type</h4>
                <div className="suggestions-list">
                  {data.recommendations.companionSuggestions.map((suggestion, idx) => (
                    <div key={idx} className="suggestion-item">
                      <p>✈️ {suggestion}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.recommendations.groupActivities && (
              <div className="group-activities">
                <h4>🎉 Group-Specific Experiences</h4>
                <div className="activities-list">
                  {data.recommendations.groupActivities.map((activity, idx) => (
                    <div key={idx} className="activity-item">
                      <p>🎯 {activity}</p>
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
            <h3>🔄 Alternative Plans to Fit Your Budget</h3>
            <div className="alternatives-cards">
              {alternatives.map((alt, idx) => (
                <div key={idx} className="alternative-card">
                  <h4>{alt.name}</h4>
                  <p className="description">{alt.description}</p>
                  {alt.days && (
                    <p><strong>Duration:</strong> {alt.days} days</p>
                  )}
                  <p className="cost"><strong>Estimated Cost:</strong> ${alt.estimatedCost}</p>
                  <p className="savings"><strong>Savings:</strong> ${alt.savings}</p>
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
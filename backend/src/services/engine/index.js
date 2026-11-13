/**
 * VISTA AI Travel Optimization Engine - Master Orchestrator
 * 
 * Unifies the 12 Core Engines (Prompt Section 13):
 * 1. PreferenceUnderstandingEngine (UserPreferenceAnalyzer)
 * 2. TravelExperienceUnderstandingEngine
 * 3. PlacesDiscoveryEngine
 * 4. DestinationIntelligenceEngine
 * 5. RouteDiscoveryEngine
 * 6. GeographicClusteringEngine (DestinationExplorationEngine)
 * 7. PlaceScoringEngine
 * 8. ItineraryOptimizationEngine (RouteOptimizationEngine)
 * 9. DailyItineraryScheduler
 * 10. BudgetCalculationEngine
 * 11. FeasibilityAnalysisEngine
 * 12. ItineraryValidationEngine
 */

const UserPreferenceAnalyzer = require('./UserPreferenceAnalyzer');
const { analyzeUserPreferences } = UserPreferenceAnalyzer;

const TravelExperienceUnderstandingEngine = require('./TravelExperienceUnderstandingEngine');
const {
  calculateSolarTimes,
  parseRequestedExperience,
  evaluateExperienceTimeWindow
} = TravelExperienceUnderstandingEngine;

const DestinationIntelligenceEngine = require('./DestinationIntelligenceEngine');
const {
  resolveDestinationIntelligence,
  DESTINATION_INTELLIGENCE_CATALOG
} = DestinationIntelligenceEngine;

const RouteDiscoveryEngine = require('./RouteDiscoveryEngine');
const {
  discoverPrimaryRoute,
  calculateRoute,
  calculateRouteDeviation,
  optimizeMultiStopSequence,
  calculateFuelAndTollCost,
  calculateIndependentReturnRoute
} = RouteDiscoveryEngine;

const PlacesDiscoveryEngine = require('./PlacesDiscoveryEngine');
const {
  discoverPlaces,
  discoverCandidatePlaces,
  discoverMustVisitPlaces,
  discoverPreferredPlaces,
  discoverCorridorPlaces,
  calculatePlaceScores,
  deduplicatePlaces,
  VERIFIED_PLACES_DATABASE
} = PlacesDiscoveryEngine;

const PlaceScoringEngine = require('./PlaceScoringEngine');
const { scorePlace } = PlaceScoringEngine;

const RouteOptimizationEngine = require('./RouteOptimizationEngine');
const { optimizeDayStopSequence } = RouteOptimizationEngine;

const TravelTimeOptimizer = require('./TravelTimeOptimizer');
const { scheduleDayTimeline } = TravelTimeOptimizer;

const DailyItineraryScheduler = require('./DailyItineraryScheduler');
const { scheduleDailyItineraries } = DailyItineraryScheduler;

const BudgetCalculationEngine = require('./BudgetCalculationEngine');
const { calculateTripBudget } = BudgetCalculationEngine;

const FeasibilityAnalysisEngine = require('./FeasibilityAnalysisEngine');
const { analyzeItineraryFeasibility } = FeasibilityAnalysisEngine;

const ItineraryValidationEngine = require('./ItineraryValidationEngine');
const { validateAndEnforceOutputContract } = ItineraryValidationEngine;

const TravelContextBuilder = require('./TravelContextBuilder');
const { buildTravelContext } = TravelContextBuilder;

const AccommodationOptimizer = require('./AccommodationOptimizer');
const { optimizeAccommodationForHub } = AccommodationOptimizer;

const DynamicReplanningEngine = require('./DynamicReplanningEngine');
const { replanTimelineWithDelay } = DynamicReplanningEngine;

const AIExplanationEngine = require('./AIExplanationEngine');
const { generateItineraryExplanation } = AIExplanationEngine;

const DestinationExplorationEngine = require('./DestinationExplorationEngine');
const { planDestinationExploration } = DestinationExplorationEngine;

const ReturnJourneyEngine = require('./ReturnJourneyEngine');
const { planReturnJourney } = ReturnJourneyEngine;

const OnwardJourneyEngine = require('./OnwardJourneyEngine');
const { planOnwardJourney } = OnwardJourneyEngine;

/**
 * End-to-end itinerary generation pipeline.
 */
async function generateOptimizedItinerary(rawInput = {}) {
  // 1. Analyze and normalize user preferences and natural-language inputs
  const userProfile = analyzeUserPreferences(rawInput);

  // 1b. Parse requested experiences and astronomical solar windows (Module 14 / Section 8)
  const requestedExperiences = parseRequestedExperience(userProfile, rawInput);
  userProfile.requestedExperiences = requestedExperiences;

  // 1c. Destination regional intelligence (Module 15 / Section 13)
  const destinationIntelligence = resolveDestinationIntelligence(userProfile.destination || userProfile.destinationCity);
  userProfile.destinationIntelligence = destinationIntelligence;

  // 2. Discover primary travel corridor and road network
  const routeInfo = await discoverPrimaryRoute(
    userProfile.origin,
    userProfile.destination,
    userProfile.transportMode
  );

  // 3. Build chronological calendar, solar hours, and environmental rules
  const travelContext = buildTravelContext(userProfile, routeInfo.totalDistanceKm);

  // 4. Discover authentic candidate places along the corridor and around destination
  const candidatePlaces = await discoverCandidatePlaces(routeInfo, userProfile);

  // 5. Schedule day-wise itineraries (using scoring, 2-Opt TSP, and time-window scheduling)
  const dayPlans = await scheduleDailyItineraries({
    userProfile,
    routeInfo,
    travelContext,
    candidatePlaces
  });

  // 6. Calculate itemized, verifiable budget and trade-offs
  const budgetSummary = calculateTripBudget({
    userProfile,
    routeInfo,
    dayPlans
  });

  // 7. Feasibility and safety analysis (Module 16 / Section 13 & 15 Test G)
  const feasibilityAnalysis = analyzeItineraryFeasibility({
    dayPlans,
    userProfile,
    routeInfo,
    budgetSummary
  });

  // 8. Generate transparent AI explanation
  const explanation = await generateItineraryExplanation({
    userProfile,
    routeInfo,
    dayPlans,
    budgetSummary,
    feasibilityAnalysis
  });

  // 9. Validate and enforce Section 13 contract & build unified route object for map rendering
  const validatedItinerary = validateAndEnforceOutputContract({
    userProfile,
    routeInfo,
    travelContext,
    dayPlans,
    budgetSummary,
    explanation,
    feasibilityAnalysis,
    destinationIntelligence
  });

  return validatedItinerary;
}

module.exports = {
  generateOptimizedItinerary,

  // Section 13 Official 12-Module Architecture Exports
  PreferenceUnderstandingEngine: UserPreferenceAnalyzer,
  TravelExperienceUnderstandingEngine,
  PlacesDiscoveryEngine,
  DestinationIntelligenceEngine,
  RouteDiscoveryEngine,
  GeographicClusteringEngine: DestinationExplorationEngine,
  PlaceScoringEngine,
  ItineraryOptimizationEngine: RouteOptimizationEngine,
  DailyItineraryScheduler,
  BudgetCalculationEngine,
  FeasibilityAnalysisEngine,
  ItineraryValidationEngine,

  // Individual helper modules and functions for backward compatibility
  analyzeUserPreferences,
  calculateSolarTimes,
  parseRequestedExperience,
  evaluateExperienceTimeWindow,
  resolveDestinationIntelligence,
  DESTINATION_INTELLIGENCE_CATALOG,
  buildTravelContext,
  discoverPrimaryRoute,
  calculateRoute,
  calculateRouteDeviation,
  optimizeMultiStopSequence,
  calculateFuelAndTollCost,
  calculateIndependentReturnRoute,
  discoverPlaces,
  discoverCandidatePlaces,
  discoverMustVisitPlaces,
  discoverPreferredPlaces,
  discoverCorridorPlaces,
  calculatePlaceScores,
  deduplicatePlaces,
  VERIFIED_PLACES_DATABASE,
  scorePlace,
  optimizeDayStopSequence,
  scheduleDayTimeline,
  scheduleDailyItineraries,
  calculateTripBudget,
  analyzeItineraryFeasibility,
  optimizeAccommodationForHub,
  replanTimelineWithDelay,
  validateAndEnforceOutputContract,
  generateItineraryExplanation,
  planDestinationExploration,
  planReturnJourney,
  planOnwardJourney
};


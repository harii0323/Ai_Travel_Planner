const express = require('express');
const router = express.Router();
const planner = require('../services/planner');
const { discoverAndScheduleRoutePlaces } = require('../services/routePlaceDiscoveryEngine');
const authenticate = require('../middleware/authenticate');
const Itinerary = require('../models/Itinerary');
const jwt = require('jsonwebtoken');

const optionalAuthenticate = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      req.user = jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key');
    }
  } catch (err) {
    // Proceed as unauthenticated
  }
  next();
};

const {
  optimizeSpatiotemporalJourney,
  reoptimizeRollingHorizon
} = require('../services/spatiotemporalOptimizer');
const { contextualBandit } = require('../services/contextualBanditEngine');

// POST /api/itinerary/optimize-spatiotemporal - Context-aware Spatiotemporal Optimization Engine
router.post('/optimize-spatiotemporal', optionalAuthenticate, async (req, res) => {
  try {
    const input = req.body || {};
    const result = await optimizeSpatiotemporalJourney({
      origin: input.origin || input.startLocation || input.start || 'Mumbai',
      destination: input.destination || 'Goa',
      travel_date: input.travel_date || input.travelDate || input.travelDates || new Date(),
      start_time: input.start_time || input.startTime || '07:00 AM',
      trip_duration: input.trip_duration || input.totalDays || input.numDays || 3,
      number_of_travelers: input.number_of_travelers || input.numberOfTravelers || 2,
      traveler_type: input.traveler_type || input.travelCompanionType || input.companionType || 'friends',
      total_budget: input.total_budget || input.budget || 20000,
      travel_mode: input.travel_mode || input.transportMode || input.transport || 'car',
      preferred_activities: input.preferred_activities || input.activities || ['nature', 'photography'],
      optimization_mode: input.optimization_mode || input.planningMode || 'BALANCED'
    });

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error('Spatiotemporal optimization error:', err);
    res.status(500).json({ success: false, error: err.message || 'Spatiotemporal optimization failed' });
  }
});

// POST /api/itinerary/rolling-horizon-reoptimize - Dynamic Rolling-Horizon Real-Time Re-Optimizer
router.post('/rolling-horizon-reoptimize', optionalAuthenticate, async (req, res) => {
  try {
    const input = req.body || {};
    const result = reoptimizeRollingHorizon({
      currentItinerary: input.currentItinerary,
      currentLocation: input.currentLocation || 'Current Route',
      currentTime: input.currentTime || '12:00 PM',
      remainingStops: input.remainingStops,
      completedStops: input.completedStops || [],
      remainingBudget: input.remainingBudget || 10000,
      trafficDelayMinutes: Number(input.trafficDelayMinutes) || 30,
      weatherRiskAlert: input.weatherRiskAlert || null,
      weatherRiskStatus: input.weatherRiskStatus || null,
      userPreferences: input.userPreferences || []
    });

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error('Rolling horizon re-optimization error:', err);
    res.status(500).json({ success: false, error: err.message || 'Rolling-horizon re-optimization failed' });
  }
});

// POST /api/itinerary/bandit/feedback - Real-time user feedback ingestion for LinUCB bandit (Sections 8, 29, 30)
router.post('/bandit/feedback', optionalAuthenticate, async (req, res) => {
  try {
    const { poiName, category, action, rating } = req.body || {};
    const userId = req.user?.id || req.body?.userId || 'anonymous';
    const result = contextualBandit.updateFeedback({
      userId,
      poiName,
      category,
      action,
      rating
    });
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error('Bandit feedback update error:', err);
    res.status(500).json({ success: false, error: err.message || 'Bandit feedback update failed' });
  }
});

// GET /api/itinerary/bandit/state - Retrieve current LinUCB arm states, pull counts and recent rewards
router.get('/bandit/state', async (req, res) => {
  try {
    const state = contextualBandit.getBanditState();
    res.json({
      success: true,
      data: state
    });
  } catch (err) {
    console.error('Get bandit state error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to get bandit state' });
  }
});

// POST /api/itinerary/discover-route-places - Advanced route-based intelligent place discovery
router.post('/discover-route-places', optionalAuthenticate, async (req, res) => {
  try {
    const input = req.body || {};
    const result = await discoverAndScheduleRoutePlaces(input);
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error('Route place discovery error:', err);
    res.status(500).json({ success: false, error: err.message || 'Route place discovery failed' });
  }
});

// POST /api/itinerary/generate - Generate a new itinerary
router.post('/generate', authenticate, async (req, res) => {
  try {
    const data = req.body;
    // expected fields: budget, dates, start, destination, activities, accommodation, transport, travelCompanionType, numberOfTravelers

    // Generate comprehensive route-based place discovery
    let routeDiscovery = null;
    try {
      routeDiscovery = await discoverAndScheduleRoutePlaces({
        origin: data.start || data.startLocation || data.origin,
        destination: data.destination,
        travel_date: data.dates || data.travelDates || data.startDate,
        start_time: data.startTime || '07:00 AM',
        trip_duration: data.totalDays || data.numDays || 3,
        number_of_travelers: data.numberOfTravelers || 1,
        traveler_type: data.travelCompanionType || data.companionType || 'solo',
        total_budget: data.budget,
        travel_mode: data.transport || data.transportMode || 'car',
        vehicle_details: data.rentalVehicle || { mileage: data.mileage || 15, fuelType: data.fuelType || 'petrol' },
        preferred_activities: data.activities,
        preferred_place_types: data.placeType || data.preferredPlaceType
      });
    } catch (routeErr) {
      console.warn('Route place discovery warning:', routeErr.message);
    }

    // Execute Spatiotemporal Multi-Objective Pareto Optimization Engine
    let spatiotemporalOpt = null;
    try {
      spatiotemporalOpt = await optimizeSpatiotemporalJourney({
        origin: data.start || data.startLocation || data.origin,
        destination: data.destination,
        travel_date: data.dates || data.travelDates || data.startDate,
        start_time: data.startTime || '07:00 AM',
        trip_duration: data.totalDays || data.numDays || 3,
        number_of_travelers: data.numberOfTravelers || 1,
        traveler_type: data.travelCompanionType || data.companionType || 'solo',
        total_budget: data.budget,
        travel_mode: data.transport || data.transportMode || 'car',
        preferred_activities: data.activities,
        optimization_mode: data.planningMode || data.optimization_mode || 'BALANCED'
      });
    } catch (optErr) {
      console.warn('Spatiotemporal optimization warning:', optErr.message);
    }
    
    // Generate itinerary with all data
    const itinerary = await planner.generateItinerary(data);

    if (routeDiscovery) {
      itinerary.routeDiscovery = routeDiscovery;
      itinerary.recommendedPlacesAlongRoute = routeDiscovery.recommendedPlacesAlongRoute;
      itinerary.preferenceCoverage = routeDiscovery.preferenceCoverage;
      itinerary.travelerCompatibility = routeDiscovery.travelerCompatibility;
      itinerary.routeEfficiency = routeDiscovery.routeEfficiency;
      itinerary.weatherSuitability = routeDiscovery.weatherSuitability;
      itinerary.trafficSummary = routeDiscovery.trafficSummary;
      itinerary.rejectedPlaces = routeDiscovery.rejectedPlaces;
      itinerary.alternativePlaces = routeDiscovery.alternativePlaces;
      itinerary.routeSummary = routeDiscovery.routeSummary;
    }

    if (spatiotemporalOpt) {
      itinerary.spatiotemporalOptimization = spatiotemporalOpt;
      itinerary.paretoFrontier = spatiotemporalOpt.paretoFrontier;
      itinerary.optimizationMetrics = spatiotemporalOpt.optimizationMetrics;
      itinerary.activeItineraryMode = spatiotemporalOpt.activeItineraryMode;
      itinerary.returnRoutePlan = spatiotemporalOpt.returnRoutePlan;
      itinerary.validationChecklist = spatiotemporalOpt.validationChecklist;
      // If routeDiscovery had no route places, fall back to spatiotemporal scheduled places
      if (!itinerary.recommendedPlacesAlongRoute || itinerary.recommendedPlacesAlongRoute.length === 0) {
        itinerary.recommendedPlacesAlongRoute = spatiotemporalOpt.recommendedPlacesAlongRoute;
      }
    }
    
    // Add companion-based recommendations
    itinerary.recommendations = await planner.generateRecommendations(
      data.destination,
      data.travelCompanionType || 'solo',
      data.numberOfTravelers || 1
    );
    
    res.json({
      success: true,
      itinerary
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate itinerary' });
  }
});

// POST /api/itinerary/save - Save generated itinerary to history
router.post('/save', authenticate, async (req, res) => {
  try {
    const { title, description, itineraryData, plannedTravelDate, tags } = req.body;
    
    if (!title || !itineraryData) {
      return res.status(400).json({ error: 'Title and itinerary data are required' });
    }
    
    const itinerary = await Itinerary.create({
      userId: req.user.id,
      title,
      description,
      destination: itineraryData.summary.destination,
      startLocation: itineraryData.details.startLocation,
      startDate: itineraryData.summary.startDate,
      endDate: itineraryData.summary.endDate,
      totalDays: itineraryData.summary.totalDays,
      budget: itineraryData.summary.originalBudget,
      estimatedCost: itineraryData.estimatedCosts.total,
      withoutBudget: !itineraryData.summary.withinBudget,
      activities: itineraryData.details.preferredActivities?.split(',').map(a => a.trim()) || [],
      accommodation: itineraryData.details.accommodationType,
      transport: itineraryData.details.transportMode,
      travelCompanionType: itineraryData.travelCompanionType || 'solo',
      numberOfTravelers: itineraryData.numberOfTravelers || 1,
      estimatedCosts: itineraryData.estimatedCosts,
      dayPlans: itineraryData.dayPlans,
      moneyTips: itineraryData.moneyTips,
      recommendations: itineraryData.recommendations || {},
      rentalBooking: itineraryData.rentalBooking || itineraryData.transportation?.rentalBooking || {},
      rentalVehicle: itineraryData.rentalVehicle || itineraryData.transportation?.rentalVehicle || {},
      plannedTravelDate,
      tags: tags || []
    });
    
    res.status(201).json({
      success: true,
      message: 'Itinerary saved to history',
      itinerary: {
        id: itinerary._id,
        title: itinerary.title,
        destination: itinerary.destination,
        totalDays: itinerary.totalDays,
        estimatedCost: itinerary.estimatedCost,
        createdAt: itinerary.createdAt
      }
    });
  } catch (err) {
    console.error('Save error:', err);
    res.status(500).json({ error: err.message || 'Failed to save itinerary' });
  }
});

// POST /api/itinerary/reoptimize - Real-time traffic re-optimization endpoint
router.post('/reoptimize', authenticate, async (req, res) => {
  try {
    const {
      currentItinerary,
      currentLocation,
      currentTime,
      completedPlaceIds,
      trafficDelayMinutes,
      destination,
      userPreferences,
      transportMode
    } = req.body;

    const { reoptimizeItinerary } = require('../services/dynamicTravelPlanner');

    const result = await reoptimizeItinerary({
      currentItinerary,
      currentLocation,
      currentTime: currentTime || '14:00',
      completedPlaceIds: completedPlaceIds || [],
      trafficDelayMinutes: Number(trafficDelayMinutes) || 0,
      destination: destination || 'Goa',
      userPreferences: userPreferences || {},
      transportMode: transportMode || 'car'
    });

    res.json(result);
  } catch (err) {
    console.error('Re-optimization error:', err);
    res.status(500).json({ error: 'Failed to re-optimize itinerary' });
  }
});

// POST /api/itinerary/dynamic-plan - Run standalone dynamic travel planner algorithm
router.post('/dynamic-plan', authenticate, async (req, res) => {
  try {
    const {
      userPreferences,
      startLocation,
      destination,
      travelDate,
      numberOfDays,
      dailyStartTime,
      dailyEndTime,
      transportMode,
      weatherCondition,
      budget
    } = req.body;

    const { dynamicTravelPlanner } = require('../services/dynamicTravelPlanner');

    const result = await dynamicTravelPlanner({
      userPreferences: userPreferences || {},
      startLocation: startLocation || 'City Center',
      destination: destination || 'Goa',
      travelDate: travelDate ? new Date(travelDate) : new Date(),
      numberOfDays: Number(numberOfDays) || 3,
      dailyStartTime: dailyStartTime || '08:00',
      dailyEndTime: dailyEndTime || '21:00',
      transportMode: transportMode || 'car',
      weatherCondition: weatherCondition || 'Clear',
      budget: Number(budget) || 10000
    });

    res.json(result);
  } catch (err) {
    console.error('Dynamic planner error:', err);
    res.status(500).json({ error: 'Failed to execute dynamic planner algorithm' });
  }
});

// GET /api/itinerary/vehicles - Fetch catalog of popular Indian vehicle models
router.get('/vehicles', (req, res) => {
  const { VEHICLE_CATALOG } = require('../data/vehicleModels');
  res.json({
    success: true,
    vehicles: VEHICLE_CATALOG
  });
});

// GET /api/itinerary/realtime-prices - Fetch live market pricing data for destination & fuel
router.get('/realtime-prices', async (req, res) => {
  try {
    const { destination = 'Goa', origin = 'Mumbai', transportMode = 'car', fuelType = 'petrol', travelDate } = req.query;
    const {
      getLiveFuelPrice,
      getLiveAccommodationRate,
      getLiveTollRate,
      getLivePublicTransitRates,
      getDestinationFoodPlan
    } = require('../services/realTimePricingService');

    const fuelInfo = getLiveFuelPrice(origin, fuelType);
    const hostelRate = getLiveAccommodationRate(destination, 'hostel', travelDate);
    const hotelRate = getLiveAccommodationRate(destination, 'budgetHotel', travelDate);
    const meals = getDestinationFoodPlan(destination, 'standard', 1, 1);
    const tolls = getLiveTollRate(origin, destination, 500, transportMode);
    const transit = getLivePublicTransitRates(500, transportMode, 1);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      origin,
      destination,
      liveRates: {
        fuel: fuelInfo,
        accommodation: {
          hostel: hostelRate,
          budgetHotel: hotelRate
        },
        dining: meals,
        tolls,
        transit
      }
    });
  } catch (err) {
    console.error('Real-time prices error:', err);
    res.status(500).json({ error: 'Failed to retrieve real-time prices' });
  }
});

// POST /api/itinerary/calculate-prices - Complete real-time cost calculation endpoint
router.post('/calculate-prices', async (req, res) => {
  try {
    const { computeRealTimeTripCost } = require('../services/realTimePricingService');
    const result = await computeRealTimeTripCost(req.body || {});
    res.json(result);
  } catch (err) {
    console.error('Calculate real-time prices error:', err);
    res.status(500).json({ error: 'Failed to calculate real-time prices' });
  }
});

// POST /api/itinerary/recalculate-cost - Single authoritative cost engine recalculation (Section 23, 32)
router.post('/recalculate-cost', async (req, res) => {
  try {
    const costSummary = planner.calculateTripCost(req.body || {});
    res.json({
      success: true,
      costSummary,
      costBreakdown: costSummary
    });
  } catch (err) {
    console.error('Recalculate cost error:', err);
    res.status(500).json({ success: false, error: 'Failed to recalculate trip cost' });
  }
});

// POST /api/itinerary/poi-cost-impact - Dynamic detour POI cost impact (Section 25)
router.post('/poi-cost-impact', async (req, res) => {
  try {
    const result = planner.calculatePoiCostImpact(req.body || {});
    res.json({
      success: true,
      impact: result
    });
  } catch (err) {
    console.error('POI cost impact error:', err);
    res.status(500).json({ success: false, error: 'Failed to calculate POI cost impact' });
  }
});

// POST /api/itinerary/alternative-route-cost - Dynamic alternative route comparison (Section 26)
router.post('/alternative-route-cost', async (req, res) => {
  try {
    const result = planner.calculateAlternativeRouteCost(req.body || {});
    res.json({
      success: true,
      routeCost: result
    });
  } catch (err) {
    console.error('Alternative route cost error:', err);
    res.status(500).json({ success: false, error: 'Failed to calculate alternative route cost' });
  }
});

// POST /api/itinerary (legacy endpoint - for backward compatibility)
router.post('/', async (req, res) => {
  try {
    const data = req.body;
    // expected fields: budget, dates, start, destination, activities, accommodation, transport
    const itinerary = await planner.generateItinerary(data);
    res.json(itinerary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate itinerary' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const planner = require('../services/planner');
const authenticate = require('../middleware/authenticate');
const Itinerary = require('../models/Itinerary');

// POST /api/itinerary/generate - Generate a new itinerary
router.post('/generate', authenticate, async (req, res) => {
  try {
    const data = req.body;
    // expected fields: budget, dates, start, destination, activities, accommodation, transport, travelCompanionType, numberOfTravelers
    
    // Generate itinerary with all data
    const itinerary = await planner.generateItinerary(data);
    
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

// GET /api/itinerary/realtime-prices - Fetch live market pricing data for destination & fuel
router.get('/realtime-prices', async (req, res) => {
  try {
    const { destination = 'Goa', origin = 'Mumbai', transportMode = 'car', fuelType = 'petrol', travelDate } = req.query;
    const {
      getLiveFuelPrice,
      getLiveAccommodationRate,
      getLiveTollRate,
      getLivePublicTransitRates,
      getLiveMealCost
    } = require('../services/realTimePricingService');

    const fuelInfo = getLiveFuelPrice(origin, fuelType);
    const hostelRate = getLiveAccommodationRate(destination, 'hostel', travelDate);
    const hotelRate = getLiveAccommodationRate(destination, 'budgetHotel', travelDate);
    const meals = getLiveMealCost(destination, 'moderate', 1, 1);
    const tolls = getLiveTollRate(origin, destination, 500, transportMode);
    const transit = getLivePublicTransitRates(500, transportMode, 1, true);

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

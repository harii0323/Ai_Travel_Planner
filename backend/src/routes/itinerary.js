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
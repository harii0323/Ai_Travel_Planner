// History routes - Save and retrieve itineraries

const express = require('express');
const authenticate = require('../middleware/authenticate');
const { emailActionRateLimiter } = require('../middleware/security');
const emailService = require('../services/emailService');
const User = require('../models/User');
const Itinerary = require('../models/Itinerary');

const router = express.Router();

// POST /api/history/save - Save an itinerary
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
      message: 'Itinerary saved successfully',
      itinerary: {
        id: itinerary._id,
        title: itinerary.title,
        destination: itinerary.destination,
        totalDays: itinerary.totalDays,
        estimatedCost: itinerary.estimatedCost,
        createdAt: itinerary.createdAt
      }
    });
  } catch (error) {
    console.error('Save error:', error);
    res.status(500).json({ error: error.message || 'Failed to save itinerary' });
  }
});

function safeRegex(str) {
  if (!str || typeof str !== 'string') return null;
  const sanitized = str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').trim().slice(0, 80);
  if (!sanitized) return null;
  return new RegExp(sanitized, 'i');
}

// GET /api/history - Get all saved itineraries for user
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, destination, sort } = req.query;
    
    const filter = { userId: req.user.id };
    const allowedStatuses = ['saved', 'completed', 'cancelled', 'active', 'archived', 'draft'];
    if (status && allowedStatuses.includes(String(status).toLowerCase())) {
      filter.status = String(status).toLowerCase();
    }
    if (destination) {
      const destRegex = safeRegex(destination);
      if (destRegex) filter.destination = destRegex;
    }
    
    const sortBy = sort === 'oldest' ? { createdAt: 1 } : { createdAt: -1 };
    
    const itineraries = await Itinerary.find(filter)
      .sort(sortBy)
      .select('-dayPlans -moneyTips'); // Exclude large fields for list view
    
    res.status(200).json({
      success: true,
      count: itineraries.length,
      itineraries: itineraries.map(it => ({
        id: it._id,
        title: it.title,
        destination: it.destination,
        startLocation: it.startLocation,
        startDate: it.startDate,
        endDate: it.endDate,
        totalDays: it.totalDays,
        budget: it.budget,
        estimatedCost: it.estimatedCost,
        withoutBudget: it.withoutBudget,
        travelCompanionType: it.travelCompanionType,
        numberOfTravelers: it.numberOfTravelers,
        status: it.status,
        plannedTravelDate: it.plannedTravelDate,
        tags: it.tags,
        createdAt: it.createdAt,
        updatedAt: it.updatedAt
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/history/:id - Get a specific itinerary
router.get('/:id', authenticate, async (req, res) => {
  try {
    const itinerary = await Itinerary.findById(req.params.id, req.user.id);
    
    if (!itinerary || itinerary.userId.toString() !== req.user.id) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }
    
    res.status(200).json({
      success: true,
      itinerary
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/history/:id - Update itinerary
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { title, description, status, tags, plannedTravelDate } = req.body;
    
    const itinerary = await Itinerary.findById(req.params.id, req.user.id);
    
    if (!itinerary || itinerary.userId.toString() !== req.user.id) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }
    
    // Update fields
    if (title) itinerary.title = title;
    if (description) itinerary.description = description;
    if (status) itinerary.status = status;
    if (tags) itinerary.tags = tags;
    if (plannedTravelDate) itinerary.plannedTravelDate = plannedTravelDate;
    itinerary.updatedAt = new Date();
    
    await itinerary.save();
    
    res.status(200).json({
      success: true,
      message: 'Itinerary updated successfully',
      itinerary
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/history/:id - Delete itinerary
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const itinerary = await Itinerary.findById(req.params.id, req.user.id);
    
    if (!itinerary || itinerary.userId.toString() !== req.user.id) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }
    
    await Itinerary.findByIdAndDelete(req.params.id, req.user.id);
    
    res.status(200).json({
      success: true,
      message: 'Itinerary deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/history/duplicate/:id - Duplicate an itinerary
router.post('/duplicate/:id', authenticate, async (req, res) => {
  try {
    const originalItinerary = await Itinerary.findById(req.params.id, req.user.id);
    
    if (!originalItinerary || originalItinerary.userId.toString() !== req.user.id) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }
    
    // Create a new itinerary with same data
    const duplicatedItinerary = await Itinerary.create({
      userId: req.user.id,
      title: `${originalItinerary.title} (Copy)`,
      description: originalItinerary.description,
      destination: originalItinerary.destination,
      startLocation: originalItinerary.startLocation,
      startDate: originalItinerary.startDate,
      endDate: originalItinerary.endDate,
      totalDays: originalItinerary.totalDays,
      budget: originalItinerary.budget,
      estimatedCost: originalItinerary.estimatedCost,
      withoutBudget: originalItinerary.withoutBudget,
      activities: originalItinerary.activities,
      accommodation: originalItinerary.accommodation,
      transport: originalItinerary.transport,
      travelCompanionType: originalItinerary.travelCompanionType,
      numberOfTravelers: originalItinerary.numberOfTravelers,
      estimatedCosts: originalItinerary.estimatedCosts,
      dayPlans: originalItinerary.dayPlans,
      moneyTips: originalItinerary.moneyTips,
      recommendations: originalItinerary.recommendations,
      tags: originalItinerary.tags
    });
    
    res.status(201).json({
      success: true,
      message: 'Itinerary duplicated successfully',
      itinerary: {
        id: duplicatedItinerary._id,
        title: duplicatedItinerary.title,
        destination: duplicatedItinerary.destination
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/history/:id/email and /api/trips/:tripId/email - Email a saved itinerary to the authenticated user's registered address
router.post(['/:id/email', '/:tripId/email'], authenticate, emailActionRateLimiter, async (req, res) => {
  try {
    const tripId = req.params.tripId || req.params.id;
    const itinerary = await Itinerary.findById(tripId, req.user.id);
    
    if (!itinerary || itinerary.userId.toString() !== req.user.id) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }

    const user = await User.findById(req.user.id);
    if (user && user.isVerified === false) {
      return res.status(403).json({
        error: 'Please verify your registered email address before emailing travel itineraries.',
        requiresVerification: true
      });
    }

    const recipientEmail = user?.email || req.user.email;
    const recipientName = user?.name || req.user.name || 'Traveler';

    if (!recipientEmail) {
      return res.status(400).json({ error: 'Verified email address not found on user profile' });
    }

    const emailResult = await emailService.sendItineraryEmail(recipientEmail, recipientName, itinerary, {
      userId: req.user.id,
      tripId: itinerary._id || itinerary.id
    });

    res.status(200).json({
      success: true,
      message: `Travel plan successfully sent to your registered email (${recipientEmail}).`,
      messageId: emailResult.messageId
    });
  } catch (error) {
    console.error('Email itinerary error:', error);
    res.status(500).json({ error: error.message || 'Failed to email travel itinerary.' });
  }
});

module.exports = router;

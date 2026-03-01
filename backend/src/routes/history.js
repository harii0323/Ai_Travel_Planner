// History routes - Save and retrieve itineraries

const express = require('express');
const authenticate = require('../middleware/authenticate');
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

// GET /api/history - Get all saved itineraries for user
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, destination, sort } = req.query;
    
    const filter = { userId: req.user.id };
    if (status) filter.status = status;
    if (destination) filter.destination = new RegExp(destination, 'i');
    
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
    const itinerary = await Itinerary.findById(req.params.id);
    
    if (!itinerary) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }
    
    // Check ownership
    if (itinerary.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to view this itinerary' });
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
    
    const itinerary = await Itinerary.findById(req.params.id);
    
    if (!itinerary) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }
    
    // Check ownership
    if (itinerary.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to update this itinerary' });
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
    const itinerary = await Itinerary.findById(req.params.id);
    
    if (!itinerary) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }
    
    // Check ownership
    if (itinerary.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this itinerary' });
    }
    
    await Itinerary.findByIdAndDelete(req.params.id);
    
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
    const originalItinerary = await Itinerary.findById(req.params.id);
    
    if (!originalItinerary) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }
    
    // Check ownership
    if (originalItinerary.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to duplicate this itinerary' });
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

module.exports = router;

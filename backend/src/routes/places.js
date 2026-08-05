const express = require('express');
const TouristPlace = require('../models/TouristPlace');
const PlaceDistance = require('../models/PlaceDistance');

const router = express.Router();

// GET /api/places - Search tourist places from the local India dataset
router.get('/', async (req, res) => {
  try {
    const { q, state, region, category, suitableFor, transport, limit = 100 } = req.query;
    const filter = { isActive: true };

    if (q) {
      filter.$or = [
        { name: new RegExp(q, 'i') },
        { city: new RegExp(q, 'i') },
        { state: new RegExp(q, 'i') }
      ];
    }

    if (state) filter.state = new RegExp(`^${state}$`, 'i');
    if (region) filter.region = new RegExp(`^${region}$`, 'i');
    if (category) filter.categories = category.toLowerCase();
    if (suitableFor) filter.suitableFor = suitableFor;
    if (transport) filter.recommendedTransport = transport;

    const places = await TouristPlace.find(filter)
      .sort({ region: 1, state: 1, name: 1 })
      .limit(Math.min(parseInt(limit, 10) || 100, 200));

    res.json({
      success: true,
      count: places.length,
      places
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to fetch tourist places' });
  }
});

// GET /api/places/:id/distances - Distances from one place to other places
router.get('/:id/distances', async (req, res) => {
  try {
    const { limit = 25 } = req.query;

    const distances = await PlaceDistance.find({ fromPlace: req.params.id })
      .sort({ estimatedRoadDistanceKm: 1 })
      .limit(Math.min(parseInt(limit, 10) || 25, 200))
      .populate('toPlace', 'name city state region categories bestTimeToVisit suitableFor recommendedTransport coordinates');

    res.json({
      success: true,
      count: distances.length,
      distances
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to fetch place distances' });
  }
});

// GET /api/places/distance?from=Taj Mahal&to=Jaipur City Palace
router.get('/distance/search', async (req, res) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'Both from and to query parameters are required' });
    }

    const distance = await PlaceDistance.findOne({
      fromName: new RegExp(`^${from}$`, 'i'),
      toName: new RegExp(`^${to}$`, 'i')
    })
      .populate('fromPlace', 'name city state region coordinates')
      .populate('toPlace', 'name city state region coordinates');

    if (!distance) {
      return res.status(404).json({ error: 'Distance not found for the requested places' });
    }

    res.json({
      success: true,
      distance
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to fetch distance' });
  }
});

module.exports = router;

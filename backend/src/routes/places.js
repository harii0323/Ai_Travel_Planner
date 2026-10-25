const express = require('express');
const TouristPlace = require('../models/TouristPlace');
const PlaceDistance = require('../models/PlaceDistance');

const router = express.Router();

function safeRegex(str, exact = false) {
  if (!str || typeof str !== 'string') return null;
  const sanitized = str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').trim().slice(0, 80);
  if (!sanitized) return null;
  return new RegExp(exact ? `^${sanitized}$` : sanitized, 'i');
}

// GET /api/places - Search tourist places from the local India dataset
router.get('/', async (req, res) => {
  try {
    const { q, state, region, category, suitableFor, transport, limit = 100 } = req.query;
    const filter = { isActive: true };

    if (q) {
      const qRegex = safeRegex(q, false);
      if (qRegex) {
        filter.$or = [
          { name: qRegex },
          { city: qRegex },
          { state: qRegex }
        ];
      }
    }

    if (state) {
      const stateRegex = safeRegex(state, true);
      if (stateRegex) filter.state = stateRegex;
    }
    if (region) {
      const regionRegex = safeRegex(region, true);
      if (regionRegex) filter.region = regionRegex;
    }
    if (category && typeof category === 'string') filter.categories = category.toLowerCase().slice(0, 40);
    if (suitableFor && typeof suitableFor === 'string') filter.suitableFor = suitableFor.slice(0, 40);
    if (transport && typeof transport === 'string') filter.recommendedTransport = transport.slice(0, 40);

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

    const fromRegex = safeRegex(from, true);
    const toRegex = safeRegex(to, true);
    if (!fromRegex || !toRegex) {
      return res.status(400).json({ error: 'Invalid location parameters provided' });
    }

    const distance = await PlaceDistance.findOne({
      fromName: fromRegex,
      toName: toRegex
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

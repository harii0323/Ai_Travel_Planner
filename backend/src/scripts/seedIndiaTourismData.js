const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { connectDB, closeDB } = require('../config/database');
const indiaTouristPlaces = require('../data/indiaTouristPlaces');
const TouristPlace = require('../models/TouristPlace');
const PlaceDistance = require('../models/PlaceDistance');

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

function calculateStraightLineDistance(from, to) {
  const latDistance = toRadians(to.lat - from.lat);
  const lngDistance = toRadians(to.lng - from.lng);
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);

  const a =
    Math.sin(latDistance / 2) * Math.sin(latDistance / 2) +
    Math.cos(fromLat) * Math.cos(toLat) *
    Math.sin(lngDistance / 2) * Math.sin(lngDistance / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_KM * c);
}

function estimateRoadDistance(straightLineDistanceKm, fromPlace, toPlace) {
  const islandStates = ['Andaman and Nicobar Islands', 'Lakshadweep'];
  const hasIsland = islandStates.includes(fromPlace.state) || islandStates.includes(toPlace.state);

  if (hasIsland) {
    return straightLineDistanceKm;
  }

  if (straightLineDistanceKm <= 120) {
    return Math.round(straightLineDistanceKm * 1.35);
  }

  if (straightLineDistanceKm <= 600) {
    return Math.round(straightLineDistanceKm * 1.28);
  }

  return Math.round(straightLineDistanceKm * 1.22);
}

function formatDuration(hours) {
  if (hours < 1) {
    return `${Math.max(30, Math.round(hours * 60))} minutes`;
  }

  if (hours < 24) {
    return `${Math.round(hours)} hours`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = Math.round(hours % 24);
  return remainingHours ? `${days} day ${remainingHours} hours` : `${days} day`;
}

function getRecommendedModes(distanceKm, fromPlace, toPlace) {
  const fromModes = new Set(fromPlace.recommendedTransport);
  const toModes = new Set(toPlace.recommendedTransport);
  const sharedModes = [...fromModes].filter(mode => toModes.has(mode));
  const islandStates = ['Andaman and Nicobar Islands', 'Lakshadweep'];
  const hasIsland = islandStates.includes(fromPlace.state) || islandStates.includes(toPlace.state);

  if (hasIsland) {
    return ['flight', 'ship']
      .filter(mode => sharedModes.includes(mode) || fromModes.has(mode) || toModes.has(mode))
      .map(mode => ({
        mode,
        estimatedDuration: mode === 'flight'
          ? formatDuration(Math.max(1.5, distanceKm / 700))
          : formatDuration(Math.max(10, distanceKm / 35)),
        suitability: mode === 'flight' ? 'fastest for island routes' : 'budget-friendly where available'
      }));
  }

  const candidates = [];

  if (distanceKm <= 180 && sharedModes.includes('bike')) {
    candidates.push({
      mode: 'bike',
      estimatedDuration: formatDuration(distanceKm / 45),
      suitability: 'best for short scenic routes and friends'
    });
  }

  if (sharedModes.includes('car')) {
    candidates.push({
      mode: 'car',
      estimatedDuration: formatDuration(distanceKm / 55),
      suitability: distanceKm <= 700 ? 'flexible for families and groups' : 'best only with planned breaks'
    });
  }

  if (distanceKm >= 80 && sharedModes.includes('bus')) {
    candidates.push({
      mode: 'bus',
      estimatedDuration: formatDuration(distanceKm / 45),
      suitability: 'budget-friendly for students and groups'
    });
  }

  if (distanceKm >= 120 && sharedModes.includes('train')) {
    candidates.push({
      mode: 'train',
      estimatedDuration: formatDuration(distanceKm / 60),
      suitability: 'comfortable and economical for intercity travel'
    });
  }

  if (distanceKm >= 500 && sharedModes.includes('flight')) {
    candidates.push({
      mode: 'flight',
      estimatedDuration: formatDuration(Math.max(1.25, distanceKm / 650)),
      suitability: 'fastest for long-distance trips'
    });
  }

  return candidates.slice(0, 4);
}

async function seedIndiaTourismData() {
  await connectDB();

  await PlaceDistance.deleteMany({});
  await TouristPlace.deleteMany({});

  const places = await TouristPlace.insertMany(indiaTouristPlaces);
  const distances = [];

  for (const fromPlace of places) {
    for (const toPlace of places) {
      if (fromPlace._id === toPlace._id) {
        continue;
      }

      const straightLineDistanceKm = calculateStraightLineDistance(
        fromPlace.coordinates,
        toPlace.coordinates
      );
      const estimatedRoadDistanceKm = estimateRoadDistance(
        straightLineDistanceKm,
        fromPlace,
        toPlace
      );

      distances.push({
        fromPlace: fromPlace._id,
        toPlace: toPlace._id,
        fromName: fromPlace.name,
        toName: toPlace.name,
        straightLineDistanceKm,
        estimatedRoadDistanceKm,
        recommendedModes: getRecommendedModes(estimatedRoadDistanceKm, fromPlace, toPlace),
        distanceSource: 'coordinate_estimate'
      });
    }
  }

  await PlaceDistance.insertMany(distances);

  console.log(`Seeded ${places.length} tourist places.`);
  console.log(`Seeded ${distances.length} directional place distances.`);
  console.log('Distance values are coordinate-based estimates; replace with Google Maps/manual values when precision is required.');

  await closeDB();
}

seedIndiaTourismData().catch(async (error) => {
  console.error('Failed to seed India tourism data:', error.message);
  await closeDB();
  process.exit(1);
});

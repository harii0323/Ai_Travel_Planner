/**
 * OnwardJourneyEngine
 * 
 * Specialized Module for Phase A: Forward Travel Corridor & Transit Optimization.
 * 
 * Responsibilities:
 * - Plans the outward journey from Origin to Destination.
 * - Discovers authentic attractions along the forward highway corridor.
 * - Balances driving distances and allocates strategic intermediate overnight hubs for long routes.
 * - Selects preference-aligned transit stops (e.g., forts, viewpoints, temples).
 * - Records visited places in the master tracker to prevent duplicate visits during the return journey.
 */

const { scorePlace } = require('./PlaceScoringEngine');
const { calculateHaversineDistanceKm } = require('./RouteDiscoveryEngine');
const { roadRoutingProvider } = require('../RoadRoutingProvider');

/**
 * Discovers candidate places along the forward travel corridor.
 */
function isStopAlongDaySegment(stopCoord, startCoord, endCoord, maxDetourKm = 65) {
  if (!stopCoord || !startCoord || !endCoord) return false;
  const dx = endCoord.lng - startCoord.lng;
  const dy = endCoord.lat - startCoord.lat;
  const magSq = dx * dx + dy * dy;
  if (magSq === 0) return true;

  const px = stopCoord.lng - startCoord.lng;
  const py = stopCoord.lat - startCoord.lat;
  const proj = (px * dx + py * dy) / magSq;

  // Stop must lie forward between start and end (between 4% and 96% of segment)
  if (proj < 0.04 || proj > 0.96) return false;

  const distFromStart = calculateHaversineDistanceKm(stopCoord, startCoord);
  const distFromEnd = calculateHaversineDistanceKm(stopCoord, endCoord);
  const directDist = calculateHaversineDistanceKm(startCoord, endCoord);

  // On heavy highway transit days (>450 km direct), constrain detour to prevent excessive driving fatigue
  const allowedDetour = directDist > 450 ? Math.min(30, maxDetourKm) : maxDetourKm;
  const curvatureAllowance = directDist > 450 ? 1.15 : 1.30;

  return (distFromStart + distFromEnd) <= (directDist * curvatureAllowance + allowedDetour);
}

function discoverOnwardCorridorPlaces({
  routeWaypoints = [],
  userProfile,
  candidatePlaces = [],
  corridorBufferKm = 50
}) {
  const originClean = (userProfile.origin || '').toLowerCase().trim();
  const destClean = (userProfile.destinationCity || '').toLowerCase().trim();

  const corridorCandidates = [];

  candidatePlaces.forEach(place => {
    const placeCity = (place.city || '').toLowerCase();
    if (placeCity.includes(originClean) || placeCity.includes(destClean)) return;

    let minDistance = 9999;
    for (let i = 0; i < routeWaypoints.length - 1; i++) {
      const wp = routeWaypoints[i];
      const dist = calculateHaversineDistanceKm(place.coordinates, wp);
      if (dist < minDistance) minDistance = dist;
    }

    if (minDistance <= corridorBufferKm) {
      const scoring = scorePlace(place, {
        normalizedInterests: userProfile.normalizedInterests,
        companionType: userProfile.travelCompanionType,
        remainingBudget: userProfile.totalBudget,
        distanceFromRouteKm: Math.round(minDistance * 10) / 10,
        isDestination: false
      });

      if (scoring.isAccepted) {
        corridorCandidates.push({
          ...place,
          distanceFromRouteKm: Math.round(minDistance * 10) / 10,
          scoring
        });
      }
    }
  });

  return corridorCandidates.sort((a, b) => b.scoring.finalScore - a.scoring.finalScore);
}

/**
 * Plans the onward journey phases, intermediate overnight hubs, and stops.
 */
function planOnwardJourney(params = {}) {
  const onwardDays = params.onwardDays || 1;
  const origin = params.origin || params.userProfile?.origin || 'Origin';
  const rawOrigCoord = params.originCoord || params.routeInfo?.originCoordinates || (params.origin ? roadRoutingProvider.normalizeLocation(params.origin) : null);
  const originCoord = (rawOrigCoord && Number.isFinite(Number(rawOrigCoord.lat)) && Number.isFinite(Number(rawOrigCoord.lng)))
    ? { lat: Number(rawOrigCoord.lat), lng: Number(rawOrigCoord.lng) }
    : null;

  const destination = params.destination || params.userProfile?.destinationCity || 'Destination';
  const rawDestCoord = params.destinationCoord || params.routeInfo?.destinationCoordinates || (params.destination ? roadRoutingProvider.normalizeLocation(params.destination) : null);
  const destinationCoord = (rawDestCoord && Number.isFinite(Number(rawDestCoord.lat)) && Number.isFinite(Number(rawDestCoord.lng)))
    ? { lat: Number(rawDestCoord.lat), lng: Number(rawDestCoord.lng) }
    : null;

  if (!originCoord || !destinationCoord) {
    return [];
  }
  const routeWaypoints = params.routeWaypoints && params.routeWaypoints.length > 0
    ? params.routeWaypoints
    : (params.routeInfo?.waypoints || []);
  const userProfile = params.userProfile || {};
  const candidatePlaces = params.candidatePlaces || [];
  const visitedKeys = params.visitedKeys || new Set();
  const selectedStops = params.selectedStops || [];

  const safeOnwardDays = Math.max(1, onwardDays);

  const onwardCandidates = discoverOnwardCorridorPlaces({
    routeWaypoints,
    userProfile,
    candidatePlaces,
    corridorBufferKm: 75
  });

  const dailyOnwardAllocations = [];
  let currentStart = origin;
  let currentCoord = originCoord;
  let candIdx = 0;

  for (let d = 0; d < safeOnwardDays; d++) {
    const isFinalArrival = d === safeOnwardDays - 1;
    let endLocation = '';
    let endCoord = null;

    if (isFinalArrival) {
      endLocation = destination;
      endCoord = destinationCoord;
    } else {
      // Determine intermediate onward hub dynamically from route geometry
      const hubRatio = (d + 1) / safeOnwardDays;
      const hubIdx = Math.min(
        routeWaypoints.length - 2,
        Math.max(1, Math.round(hubRatio * (routeWaypoints.length - 1)))
      );
      const hubWp = routeWaypoints[hubIdx] || {
        name: `${origin} - ${destination} Intermediate Hub`,
        lat: (originCoord.lat + destinationCoord.lat) / 2,
        lng: (originCoord.lng + destinationCoord.lng) / 2
      };
      endLocation = hubWp.name || 'Intermediate Highway Hub';
      endCoord = { lat: hubWp.lat, lng: hubWp.lng };
    }

    // Pick 2-3 authentic corridor stops matching user preferences along this transit segment
    const dayStops = [];

    // 1. Prioritize optimizer selectedStops for onward journey
    for (const cand of selectedStops) {
      if (dayStops.length >= 3) break;
      const candKey = cand.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      if (visitedKeys.has(candKey)) continue;
      if (isStopAlongDaySegment(cand.coordinates, currentCoord, endCoord, 90) || selectedStops.length <= safeOnwardDays * 3) {
        dayStops.push({
          ...cand,
          whySelected: cand.whySelected || `Selected in optimized route corridor matching ${userProfile.planningMode || 'travel'} preferences.`
        });
        visitedKeys.add(candKey);
        if (cand.placeId) visitedKeys.add(cand.placeId);
      }
    }

    // 2. Fill remaining capacity from onwardCandidates
    for (let cIdx = 0; cIdx < onwardCandidates.length && dayStops.length < 3; cIdx++) {
      const cand = onwardCandidates[cIdx];
      const candKey = cand.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      if (visitedKeys.has(candKey)) continue;

      if (isStopAlongDaySegment(cand.coordinates, currentCoord, endCoord, 75)) {
        dayStops.push({
          ...cand,
          isSupplementary: selectedStops.length > 0,
          whySelected: cand.whySelected || `Corridor stop along ${currentStart} → ${endLocation} route matching your preferences.`
        });
        visitedKeys.add(candKey);
      }
    }

    // Authentic fallback for multi-day onward journeys: discover preference-matched POI along day's transit segment
    if (dayStops.length === 0) {
      const { VERIFIED_PLACES_DATABASE } = require('./PlacesDiscoveryEngine');
      const eligible = VERIFIED_PLACES_DATABASE.filter(p => {
        const pKey = p.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        if (visitedKeys.has(pKey) || visitedKeys.has(p.placeId)) return false;
        return isStopAlongDaySegment(p.coordinates, currentCoord, endCoord, 90);
      }).map(p => ({
        ...p,
        scoring: scorePlace(p, {
          normalizedInterests: userProfile.normalizedInterests,
          companionType: userProfile.travelCompanionType,
          remainingBudget: userProfile.totalBudget,
          isDestination: false
        })
      })).filter(p => p.scoring.isAccepted)
        .sort((a, b) => b.scoring.finalScore - a.scoring.finalScore);

      if (eligible.length > 0) {
        const chosen = eligible[0];
        dayStops.push(chosen);
        const pKey = chosen.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        visitedKeys.add(pKey);
        if (chosen.placeId) visitedKeys.add(chosen.placeId);
      }
    }

    dailyOnwardAllocations.push({
      onwardDayIndex: d,
      startLocation: currentStart,
      startCoord: currentCoord,
      endLocation,
      endCoord,
      overnightHub: endLocation,
      stops: dayStops,
      isFinalArrival
    });

    currentStart = endLocation;
    currentCoord = endCoord;
  }

  return dailyOnwardAllocations;
}

module.exports = {
  discoverOnwardCorridorPlaces,
  planOnwardJourney
};


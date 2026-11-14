/**
 * ReturnJourneyEngine
 * 
 * Specialized Module for Phase C: Independent Return Journey Optimization.
 * 
 * Responsibilities:
 * - Treats the return journey as an independent travel exploration opportunity, NOT a simple route reversal.
 * - Discovers authentic attractions along the return corridor and alternative return highways.
 * - Strictly enforces non-repetition: excludes all attractions visited during Onward or Destination phases.
 * - Discovers meaningful sightseeing stops (scenic viewpoints, waterfalls, ancient caves, forts, temples).
 * - Eliminates dull itineraries that contain only highway meal stops.
 * - Schedules realistic driving durations, visiting windows, meal halts, and overnight hubs.
 */

const { scorePlace } = require('./PlaceScoringEngine');
const { calculateHaversineDistanceKm } = require('./RouteDiscoveryEngine');
const { VERIFIED_PLACES_DATABASE } = require('./PlacesDiscoveryEngine');
const { roadRoutingProvider } = require('../RoadRoutingProvider');

/**
 * Discovers candidate return corridor attractions that have NOT been visited previously.
 * 
 * @param {Object} params
 * @param {Array} params.returnWaypoints - Sequence of waypoints for the return route
 * @param {Object} params.userProfile - Normalized user profile and preferences
 * @param {Set} params.visitedKeys - Set of normalized place IDs and names already visited
 * @param {number} params.corridorBufferKm - Search radius around return highway
 * @returns {Array} Scored, non-duplicated candidate return places
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

function discoverReturnCorridorPlaces({
  returnWaypoints = [],
  userProfile,
  visitedKeys = new Set(),
  corridorBufferKm = 65
}) {
  const originClean = (userProfile.origin || '').toLowerCase().trim();
  const destClean = (userProfile.destinationCity || '').toLowerCase().trim();

  const candidates = [];

  VERIFIED_PLACES_DATABASE.forEach(place => {
    // 1. Check if already visited in onward or destination exploration
    const pKey = place.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    if (visitedKeys.has(pKey) || visitedKeys.has(place.placeId)) {
      return;
    }

    // 2. Filter out origin or exact destination city endpoints
    const placeCity = (place.city || '').toLowerCase();
    if (originClean && (placeCity.includes(originClean) || originClean.includes(placeCity))) {
      return;
    }
    if (destClean && placeCity === destClean) {
      return;
    }

    // 3. Check proximity to return highway waypoints
    let minDistance = 9999;
    for (let i = 0; i < returnWaypoints.length - 1; i++) {
      const wp = returnWaypoints[i];
      const dist = calculateHaversineDistanceKm(place.coordinates, wp);
      if (dist < minDistance) minDistance = dist;
    }

    if (minDistance <= corridorBufferKm) {
      // 4. Score place using PlaceScoringEngine
      const scoring = scorePlace(place, {
        normalizedInterests: userProfile.normalizedInterests,
        companionType: userProfile.travelCompanionType,
        remainingBudget: userProfile.totalBudget,
        distanceFromRouteKm: Math.round(minDistance * 10) / 10,
        isDestination: false
      });

      if (scoring.isAccepted) {
        candidates.push({
          ...place,
          distanceFromRouteKm: Math.round(minDistance * 10) / 10,
          scoring
        });
      }
    }
  });

  // Sort candidates by highest score
  return candidates.sort((a, b) => b.scoring.finalScore - a.scoring.finalScore);
}

/**
 * Determines strategic return intermediate hubs for multi-day return journeys.
 */
function determineReturnHubs(returnDays, returnWaypoints, destination, origin) {
  const hubs = [];

  if (returnDays <= 1) {
    return [{ name: origin, isFinal: true }];
  }

  // Distance-weighted hub selection for multi-day returns to balance driving duration
  let totalRouteDist = 0;
  const cumDists = [0];
  for (let i = 0; i < returnWaypoints.length - 1; i++) {
    const d = calculateHaversineDistanceKm(returnWaypoints[i], returnWaypoints[i + 1]);
    totalRouteDist += d;
    cumDists.push(totalRouteDist);
  }

  for (let rIdx = 0; rIdx < returnDays; rIdx++) {
    const isFinalReturn = rIdx === returnDays - 1;
    if (isFinalReturn) {
      hubs.push({ name: origin, isFinal: true });
    } else {
      const targetDist = ((rIdx + 1) / returnDays) * totalRouteDist;
      let bestIdx = 1;
      let minDiff = 99999;
      for (let i = 1; i < returnWaypoints.length - 1; i++) {
        const diff = Math.abs(cumDists[i] - targetDist);
        if (diff < minDiff) {
          minDiff = diff;
          bestIdx = i;
        }
      }
      const hubWp = returnWaypoints[bestIdx] || returnWaypoints[1];
      hubs.push({
        name: hubWp.name || 'Intermediate Return Hub',
        coordinates: { lat: hubWp.lat, lng: hubWp.lng },
        isFinal: false
      });
    }
  }

  return hubs;
}

/**
 * Plans the return journey phases and allocates distinct sightseeing stops.
 */
function planReturnJourney(params = {}) {
  const returnDays = params.returnDays !== undefined ? params.returnDays : 1;
  if (returnDays <= 0 || params.userProfile?.isRoundTrip === false || params.isRoundTrip === false) {
    return [];
  }

  const startLocation = params.startLocation || params.destination || params.userProfile?.destinationCity || 'Destination';
  const rawStartCoord = params.startCoord || params.returnRouteInfo?.destinationCoordinates || (startLocation ? roadRoutingProvider.normalizeLocation(startLocation) : null);
  const startCoord = (rawStartCoord && Number.isFinite(Number(rawStartCoord.lat)) && Number.isFinite(Number(rawStartCoord.lng)))
    ? { lat: Number(rawStartCoord.lat), lng: Number(rawStartCoord.lng) }
    : null;

  const origin = params.origin || params.userProfile?.origin || 'Origin';
  const rawOrigCoord = params.originCoord || params.returnRouteInfo?.originCoordinates || (origin ? roadRoutingProvider.normalizeLocation(origin) : null);
  const originCoord = (rawOrigCoord && Number.isFinite(Number(rawOrigCoord.lat)) && Number.isFinite(Number(rawOrigCoord.lng)))
    ? { lat: Number(rawOrigCoord.lat), lng: Number(rawOrigCoord.lng) }
    : null;

  if (!startCoord || !originCoord) {
    return [];
  }
  const returnWaypoints = params.returnWaypoints && params.returnWaypoints.length > 0
    ? params.returnWaypoints
    : (params.returnRouteInfo?.waypoints ? [...params.returnRouteInfo.waypoints].reverse() : []);
  const userProfile = params.userProfile || {};
  const visitedKeys = params.visitedKeys || new Set();
  const selectedStops = params.selectedStops || [];

  const safeReturnDays = Math.max(1, returnDays);

  // 1. Discover all eligible, non-duplicated candidate places along return corridor
  const returnCandidates = discoverReturnCorridorPlaces({
    returnWaypoints,
    userProfile,
    visitedKeys,
    corridorBufferKm: 80
  });

  // 2. Determine intermediate overnight hubs
  const hubs = determineReturnHubs(safeReturnDays, returnWaypoints, startLocation, origin);

  const dailyReturnAllocations = [];
  let currentStart = startLocation;
  let currentCoord = startCoord;
  let candidateIdx = 0;

  for (let d = 0; d < safeReturnDays; d++) {
    const hub = hubs[d];
    const isFinal = Boolean(hub.isFinal);
    const endLocation = hub.name;
    const endCoord = isFinal ? originCoord : (hub.coordinates || originCoord);

    // Pick 2-3 distinct authentic sightseeing attractions for this return day along this transit segment
    const dayStops = [];

    // Prioritize optimizer selectedStops for return journey
    for (const cand of selectedStops) {
      if (dayStops.length >= 3) break;
      const candKey = cand.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      if (visitedKeys.has(candKey)) continue;
      if (isStopAlongDaySegment(cand.coordinates, currentCoord, endCoord, 90) || selectedStops.length <= safeReturnDays * 3) {
        dayStops.push({
          ...cand,
          whySelected: cand.whySelected || `Selected return corridor attraction matching ${userProfile.planningMode || 'travel'} preferences.`
        });
        visitedKeys.add(candKey);
        if (cand.placeId) visitedKeys.add(cand.placeId);
      }
    }

    for (let cIdx = 0; cIdx < returnCandidates.length && dayStops.length < 3; cIdx++) {
      const cand = returnCandidates[cIdx];
      const candKey = cand.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      if (visitedKeys.has(candKey)) continue;

      if (isStopAlongDaySegment(cand.coordinates, currentCoord, endCoord, 75)) {
        dayStops.push({
          ...cand,
          isSupplementary: selectedStops.length > 0,
          whySelected: cand.whySelected || `Distinct return sightseeing stop along ${currentStart} → ${endLocation} corridor.`
        });
        visitedKeys.add(candKey);
      }
    }

    // Authentic fallback: Find best preference-matched unvisited authentic attraction from database along return path
    if (dayStops.length === 0) {
      const directDist = calculateHaversineDistanceKm(currentCoord, endCoord);
      const hasStrongPreferences = (userProfile.mandatoryPreferences?.length > 0) ||
        Object.values(userProfile.normalizedInterests || {}).some(w => w >= 0.8);

      const eligibleUnvisited = VERIFIED_PLACES_DATABASE.filter(p => {
        const pKey = p.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        if (visitedKeys.has(pKey) || visitedKeys.has(p.placeId)) return false;
        
        // Ensure POI lies forward along this day's return transit segment (no backtracking or excessive fatigue)
        return isStopAlongDaySegment(p.coordinates, currentCoord, endCoord, 45);
      }).map(p => ({
        ...p,
        scoring: scorePlace(p, {
          normalizedInterests: userProfile.normalizedInterests,
          companionType: userProfile.travelCompanionType,
          remainingBudget: userProfile.totalBudget,
          isDestination: false
        })
      })).filter(p => {
        if (!p.scoring.isAccepted) return false;
        // Strict preference enforcement: do not assign contradictory categories
        if (hasStrongPreferences && p.scoring.preferenceMatch < 0.35) return false;
        return true;
      }).sort((a, b) => b.scoring.finalScore - a.scoring.finalScore);

      const unvisitedVerified = eligibleUnvisited[0];
      if (unvisitedVerified) {
        dayStops.push(unvisitedVerified);
        const pKey = unvisitedVerified.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        visitedKeys.add(pKey);
        if (unvisitedVerified.placeId) visitedKeys.add(unvisitedVerified.placeId);
      }
    }

    dailyReturnAllocations.push({
      returnDayIndex: d,
      startLocation: currentStart,
      startCoord: currentCoord,
      endLocation,
      endCoord,
      overnightHub: endLocation,
      stops: dayStops,
      isFinalArrival: isFinal
    });

    currentStart = endLocation;
    currentCoord = endCoord;
  }

  return dailyReturnAllocations;
}

module.exports = {
  discoverReturnCorridorPlaces,
  determineReturnHubs,
  planReturnJourney
};

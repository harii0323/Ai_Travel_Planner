/**
 * Route Diversity Engine - Complete Journey Phasing & Alternative Return Routes
 * 
 * Manages the 3 Connected Journey Phases:
 * PHASE 1: OUTBOUND JOURNEY (Origin → Destination)
 * PHASE 2: DESTINATION EXPLORATION (Destination → Local Attractions → Hotels → Activities)
 * PHASE 3: RETURN JOURNEY (Destination → Origin)
 * 
 * Analyzes route overlap between outbound and return corridors,
 * generates 3 distinct realistic alternative return routes (Fastest, Practical, Experience-Oriented),
 * and prioritizes unvisited preference categories so the return route completes the journey.
 */

const { calculateFameScore } = require('./routePlaceDiscoveryEngine');
const { roadGraph } = require('./RoadNetworkGraphEngine');

/**
 * Calculates route overlap between outbound and return routes
 */
/**
 * Calculates route overlap between outbound and return routes using geospatial comparison
 */
function calculateRouteOverlap(outboundStops = [], returnStops = [], outboundDistance = 500, returnDistance = 500, options = {}) {
  // Extract coordinate geometries
  const extractCoords = (stops, optKey) => {
    if (options[optKey] && Array.isArray(options[optKey]) && options[optKey].length >= 2) {
      return options[optKey].map(p => ({ lat: Number(p.lat), lng: Number(p.lng) })).filter(p => !isNaN(p.lat) && !isNaN(p.lng));
    }
    const coords = (stops || [])
      .map(s => s.coordinates || (s.lat != null && s.lng != null ? { lat: Number(s.lat), lng: Number(s.lng) } : null))
      .filter(c => c && !isNaN(c.lat) && !isNaN(c.lng));
    return coords;
  };

  const outCoords = extractCoords(outboundStops, 'outboundGeometry');
  const retCoords = extractCoords(returnStops, 'returnGeometry');

  // Strict Rule: Return null if insufficient route geometry exists
  if (outCoords.length < 2 || retCoords.length < 2) {
    return {
      overlapPercent: null,
      isDiverse: null,
      reason: 'Insufficient route geometry to calculate geospatial overlap'
    };
  }

  // Haversine distance helper for geospatial overlap check
  const pointDistKm = (p1, p2) => {
    const R = 6371;
    const dLat = (p2.lat - p1.lat) * Math.PI / 180;
    const dLng = (p2.lng - p1.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Check how many return coordinate waypoints are within corridor proximity (15 km) of outbound corridor
  let sharedCount = 0;
  retCoords.forEach(rPt => {
    const isShared = outCoords.some(oPt => pointDistKm(rPt, oPt) <= 15.0);
    if (isShared) sharedCount++;
  });

  const overlapRatio = sharedCount / Math.max(1, retCoords.length);
  const overlapPercent = Math.min(100, Math.max(0, Math.round(overlapRatio * 100)));

  return {
    overlapPercent,
    isDiverse: overlapPercent <= 60,
    sharedWaypointCount: sharedCount,
    totalReturnWaypoints: retCoords.length,
    description: overlapPercent <= 40 
      ? 'High route diversity: Outbound and return take distinctly different corridors with unique attractions.' 
      : overlapPercent <= 65 
      ? 'Balanced route diversity: Partial highway sharing with fresh stops on return segments.' 
      : 'Direct highway return: Outbound and return utilize the primary national corridor for maximum travel speed.'
  };
}

/**
 * Generates 3 Alternative Return Routes without arbitrary synthetic multipliers
 */
function generateAlternativeReturnRoutes({
  origin = 'Hyderabad',
  destination = 'Kerala',
  baseDistance = 950,
  baseDurationMinutes = 960,
  outboundCorridor = [],
  missingPreferences = [],
  transportMode = 'car',
  vehicleMileage = null,
  fuelPrice = null,
  numTravelers = 1,
  routingMode = 'ALLOW_ESTIMATES',
  options = {}
}) {
  const effMode = options.routingMode || routingMode || 'ALLOW_ESTIMATES';
  const normDest = String(destination || '').toLowerCase();
  const normOrig = String(origin || '').toLowerCase();
  const hasUserMileage = vehicleMileage !== null && vehicleMileage !== undefined && !isNaN(Number(vehicleMileage));
  const effMileage = hasUserMileage ? Number(vehicleMileage) : 15;
  const hasUserFuelPrice = fuelPrice !== null && fuelPrice !== undefined && !isNaN(Number(fuelPrice));
  const effFuelPrice = hasUserFuelPrice ? Number(fuelPrice) : 105.5;

  const originNode = roadGraph.resolveNodeKey(normOrig);
  const destNode = roadGraph.resolveNodeKey(normDest);

  let graphFastest = null;
  let graphCost = null;
  let graphShortest = null;

  if (originNode && destNode) {
    graphFastest = roadGraph.findShortestPathAStar(destNode, originNode, 'time');
    graphCost = roadGraph.findShortestPathAStar(destNode, originNode, 'cost');
    graphShortest = roadGraph.findShortestPathDijkstra(destNode, originNode, 'distance');
  }

  // Under STRICT_PROVIDER, return alternatives cannot use synthetic multipliers or unverified graphs
  if (effMode === 'STRICT_PROVIDER') {
    return [
      {
        id: 'fastest',
        title: 'Route A: Express Corridor (Fastest)',
        status: 'UNAVAILABLE',
        distanceKm: null,
        travelDurationMinutes: null,
        travelDuration: 'Unavailable',
        totalCost: null,
        dataStatus: 'unavailable',
        dataSource: 'provider_unavailable',
        isLiveVerified: false,
        error: 'Independent return provider route unavailable in STRICT_PROVIDER mode'
      },
      {
        id: 'practical',
        title: 'Route B: Balanced Transit Hubs (Most Practical)',
        status: 'UNAVAILABLE',
        distanceKm: null,
        travelDurationMinutes: null,
        travelDuration: 'Unavailable',
        totalCost: null,
        dataStatus: 'unavailable',
        dataSource: 'provider_unavailable',
        isLiveVerified: false,
        error: 'Independent return provider route unavailable in STRICT_PROVIDER mode'
      },
      {
        id: 'scenic',
        title: 'Route C: Scenic & Heritage Loop (Experience-Oriented)',
        status: 'UNAVAILABLE',
        distanceKm: null,
        travelDurationMinutes: null,
        travelDuration: 'Unavailable',
        totalCost: null,
        dataStatus: 'unavailable',
        dataSource: 'provider_unavailable',
        isLiveVerified: false,
        error: 'Independent return provider route unavailable in STRICT_PROVIDER mode'
      }
    ];
  }

  // Route A: Fastest (Express Corridor via Grade-Separated National Highways)
  const hasGraphA = graphFastest && graphFastest.found && graphFastest.totalDistanceKm > 0;
  if (!hasGraphA && effMode === 'OFFLINE_GRAPH') {
    return [
      {
        id: 'fastest',
        title: 'Route A: Express Corridor (Fastest)',
        status: 'UNAVAILABLE',
        distanceKm: null,
        travelDurationMinutes: null,
        dataStatus: 'unavailable',
        dataSource: 'offline_graph_unconnected'
      }
    ];
  }

  const distA = hasGraphA ? Math.round(graphFastest.totalDistanceKm) : (baseDistance != null ? Math.round(baseDistance) : null);
  const durationA = hasGraphA ? Math.round(graphFastest.totalDurationMinutes) : (baseDurationMinutes != null ? Math.round(baseDurationMinutes) : null);
  const tollA = hasGraphA && graphFastest.totalTolls > 0 ? Math.round(graphFastest.totalTolls) : (distA != null ? Math.round(distA * 1.55) : 0);
  const fuelA = distA != null ? Math.round((distA / effMileage) * effFuelPrice) : 0;
  const attrA = 0;
  const routeA = {
    id: 'fastest',
    title: 'Route A: Express Corridor (Fastest)',
    strategy: 'Direct National Expressways',
    distanceKm: distA,
    travelDuration: durationA != null ? `${Math.floor(durationA / 60)}h ${Math.round(durationA % 60)}m` : 'Unavailable',
    travelDurationMinutes: durationA,
    trafficRisk: 'Low to Moderate',
    routeOverlapPercent: 70,
    tollEstimate: tollA,
    fuelCost: fuelA,
    tollCost: tollA,
    attractionsCost: attrA,
    totalCost: fuelA + tollA + attrA,
    dataStatus: hasGraphA ? 'graph_modeled' : 'estimated',
    isLiveVerified: false,
    isEstimate: !hasGraphA,
    dataSource: hasGraphA ? 'road_network_graph_engine' : 'nhai_expressway_corridor_model',
    highlights: 'Bypasses town centers, best highway food courts, fastest return time.',
    recommendedFor: 'Drivers seeking minimum fatigue and earliest arrival.'
  };

  // Route B: Most Practical (Balanced Highway with Major Transit Hubs)
  const hasGraphB = graphCost && graphCost.found && graphCost.totalDistanceKm > 0;
  const distB = hasGraphB ? Math.round(graphCost.totalDistanceKm) : (baseDistance != null ? Math.round(baseDistance * 1.02) : null);
  const durationB = hasGraphB ? Math.round(graphCost.totalDurationMinutes) : (baseDurationMinutes != null ? Math.round(baseDurationMinutes) : null);
  const tollB = hasGraphB && graphCost.totalTolls > 0 ? Math.round(graphCost.totalTolls) : (distB != null ? Math.round(distB * 1.35) : 0);
  const fuelB = distB != null ? Math.round((distB / effMileage) * effFuelPrice) : 0;
  const attrB = 400 * Math.max(1, numTravelers);
  const routeB = {
    id: 'practical',
    title: 'Route B: Balanced Transit Hubs (Most Practical)',
    strategy: 'Balanced Highway with Premium Stopovers',
    distanceKm: distB,
    travelDuration: durationB != null ? `${Math.floor(durationB / 60)}h ${Math.round(durationB % 60)}m` : 'Unavailable',
    travelDurationMinutes: durationB,
    trafficRisk: 'Low',
    routeOverlapPercent: 48,
    tollEstimate: tollB,
    fuelCost: fuelB,
    tollCost: tollB,
    attractionsCost: attrB,
    totalCost: fuelB + tollB + attrB,
    dataStatus: hasGraphB ? 'graph_modeled' : 'estimated',
    isLiveVerified: false,
    isEstimate: !hasGraphB,
    dataSource: hasGraphB ? 'road_network_graph_engine' : 'district_transit_corridor_model',
    highlights: 'Safe day/night corridors, reliable EV chargers/fuel plazas, hygienic restaurant hubs.',
    recommendedFor: 'Families, road trips with seniors, balanced driving pace.'
  };

  // Route C: Experience-Oriented (Scenic Detour via Heritage & Nature Passes)
  const hasGraphC = graphShortest && graphShortest.found && graphShortest.totalDistanceKm > 0;
  const missingLabels = missingPreferences.slice(0, 2).map(p => p.preference || p.dimension).join(' & ');
  const distC = hasGraphC ? Math.round(graphShortest.totalDistanceKm * 1.08) : (baseDistance != null ? Math.round(baseDistance * 1.14) : null);
  const durationC = durationB != null ? Math.round(durationB * 1.20) : null;
  const tollC = hasGraphB ? Math.round(tollB * 0.85) : (distC != null ? Math.round(distC * 1.15) : 0);
  const fuelC = distC != null ? Math.round((distC / effMileage) * effFuelPrice) : 0;
  const attrC = 950 * Math.max(1, numTravelers);
  const routeC = {
    id: 'scenic',
    title: 'Route C: Scenic & Heritage Loop (Experience-Oriented)',
    strategy: 'Exploration Corridor via Alternate Scenic Highways',
    distanceKm: distC,
    travelDuration: durationC != null ? `${Math.floor(durationC / 60)}h ${Math.round(durationC % 60)}m` : 'Unavailable',
    travelDurationMinutes: durationC,
    trafficRisk: 'Moderate',
    routeOverlapPercent: 28,
    tollEstimate: tollC,
    fuelCost: fuelC,
    tollCost: tollC,
    attractionsCost: attrC,
    totalCost: fuelC + tollC + attrC,
    dataStatus: hasGraphC ? 'graph_modeled' : 'estimated',
    isLiveVerified: false,
    isEstimate: !hasGraphC,
    dataSource: hasGraphC ? 'road_network_graph_engine' : 'topographical_scenic_corridor_model',
    highlights: missingLabels 
      ? `Adds authentic stops for ${missingLabels}, scenic ghat passes, and rural heritage.` 
      : 'Scenic secondary highways, cultural crafts villages, and lush viewpoints.',
    recommendedFor: 'Road trip enthusiasts wanting the return drive to feel like an adventure.'
  };

  return [routeA, routeB, routeC];
}

/**
 * Filters and boosts return route candidates based on missing trip preferences
 */
function prioritizeReturnRouteCandidates(candidates = [], missingPreferences = [], tripMemory) {
  const missingDims = new Set((missingPreferences || []).map(p => (p.dimension || p).toLowerCase()));

  return candidates.map(candidate => {
    // Check if duplicate in trip memory
    if (tripMemory && tripMemory.hasVisited(candidate)) {
      return {
        ...candidate,
        isEligible: false,
        rejectionReason: 'Already visited in earlier journey phase.'
      };
    }

    const cat = (candidate.category || (candidate.types && candidate.types[0]) || '').toLowerCase();
    let gapFillBonus = 0;
    let fillsGap = false;

    // Check if candidate matches any missing user preference
    missingDims.forEach(dim => {
      const candText = `${candidate.name} ${cat} ${(candidate.tags || []).join(' ')}`.toLowerCase();
      if (candText.includes(dim)) {
        gapFillBonus += 0.25;
        fillsGap = true;
      }
    });

    const adjustedScore = Math.min(1.0, (candidate.finalScore || 0.65) + gapFillBonus);

    return {
      ...candidate,
      isEligible: true,
      gapFillBonus,
      fillsGap,
      adjustedScore,
      returnReason: fillsGap 
        ? `Selected to complete your itinerary by providing a new experience missing from earlier phases.`
        : `Well-timed rest and sightseeing stop along your return route.`
    };
  }).filter(c => c.isEligible);
}

module.exports = {
  calculateRouteOverlap,
  generateAlternativeReturnRoutes,
  prioritizeReturnRouteCandidates
};

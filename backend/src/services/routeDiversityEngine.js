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

/**
 * Calculates route overlap between outbound and return routes
 */
function calculateRouteOverlap(outboundStops = [], returnStops = [], outboundDistance = 500, returnDistance = 500) {
  // Symmetrical highway corridors naturally share some national highway backbone
  // We compare common intermediate cities and checkpoints
  const outCities = new Set((outboundStops || []).map(s => String(s.city || s.name || '').toLowerCase().trim()));
  const retCities = new Set((returnStops || []).map(s => String(s.city || s.name || '').toLowerCase().trim()));

  let sharedCount = 0;
  outCities.forEach(city => {
    if (retCities.has(city)) sharedCount += 1;
  });

  const totalDistinct = new Set([...outCities, ...retCities]).size;
  let overlapRatio = 0.5; // Baseline national highway overlap ~45-55%
  if (totalDistinct > 0) {
    overlapRatio = sharedCount / Math.max(1, outCities.size);
  }

  const overlapPercent = Math.min(85, Math.max(15, Math.round(overlapRatio * 100)));

  return {
    overlapPercent,
    isDiverse: overlapPercent <= 60,
    sharedHubCount: sharedCount,
    description: overlapPercent <= 40 
      ? 'High route diversity: Outbound and return take distinctly different corridors with unique attractions.' 
      : overlapPercent <= 65 
      ? 'Balanced route diversity: Partial highway sharing with fresh stops on return segments.' 
      : 'Direct highway return: Outbound and return utilize the primary national corridor for maximum travel speed.'
  };
}

/**
 * Generates 3 Alternative Return Routes for user flexibility
 */
function generateAlternativeReturnRoutes({
  origin = 'Hyderabad',
  destination = 'Kerala',
  baseDistance = 950,
  baseDurationMinutes = 960,
  outboundCorridor = [],
  missingPreferences = [],
  transportMode = 'car',
  vehicleMileage = 14.5,
  fuelPrice = 101.5,
  numTravelers = 1
}) {
  const normDest = String(destination || '').toLowerCase();
  const normOrig = String(origin || '').toLowerCase();
  const effMileage = Math.max(8, Number(vehicleMileage) || 14.5);
  const effFuelPrice = Math.max(70, Number(fuelPrice) || 101.5);

  // Route A: Fastest (Primary expressways / Golden Quadrilateral)
  const distA = Math.round(baseDistance * 0.96);
  const tollA = Math.round(distA * 1.6);
  const fuelA = Math.round((distA / effMileage) * effFuelPrice);
  const attrA = 0;
  const routeA = {
    id: 'fastest',
    title: 'Route A: Express Corridor (Fastest)',
    strategy: 'Direct National Expressways',
    distanceKm: distA,
    travelDuration: `${Math.floor((baseDurationMinutes * 0.92) / 60)}h ${Math.round((baseDurationMinutes * 0.92) % 60)}m`,
    travelDurationMinutes: Math.round(baseDurationMinutes * 0.92),
    trafficRisk: 'Low to Moderate',
    routeOverlapPercent: 70,
    tollEstimate: tollA,
    fuelCost: fuelA,
    tollCost: tollA,
    attractionsCost: attrA,
    totalCost: fuelA + tollA + attrA,
    highlights: 'Bypasses town centers, best highway food courts, fastest return time.',
    recommendedFor: 'Drivers seeking minimum fatigue and earliest arrival.'
  };

  // Route B: Most Practical (Balanced travel time + high-quality intermediate rest hubs)
  const distB = Math.round(baseDistance * 1.02);
  const tollB = Math.round(distB * 1.4);
  const fuelB = Math.round((distB / effMileage) * effFuelPrice);
  const attrB = 400 * Math.max(1, numTravelers);
  const routeB = {
    id: 'practical',
    title: 'Route B: Balanced Transit Hubs (Most Practical)',
    strategy: 'Balanced Highway with Premium Stopovers',
    distanceKm: distB,
    travelDuration: `${Math.floor(baseDurationMinutes / 60)}h ${Math.round(baseDurationMinutes % 60)}m`,
    travelDurationMinutes: baseDurationMinutes,
    trafficRisk: 'Low',
    routeOverlapPercent: 48,
    tollEstimate: tollB,
    fuelCost: fuelB,
    tollCost: tollB,
    attractionsCost: attrB,
    totalCost: fuelB + tollB + attrB,
    highlights: 'Safe day/night corridors, reliable EV chargers/fuel plazas, hygienic restaurant hubs.',
    recommendedFor: 'Families, road trips with seniors, balanced driving pace.'
  };

  // Route C: Experience-Oriented (Scenic detour completing missing user preference categories)
  const missingLabels = missingPreferences.slice(0, 2).map(p => p.preference || p.dimension).join(' & ');
  const distC = Math.round(baseDistance * 1.14);
  const tollC = Math.round(distC * 1.2);
  const fuelC = Math.round((distC / effMileage) * effFuelPrice);
  const attrC = 950 * Math.max(1, numTravelers);
  const routeC = {
    id: 'scenic',
    title: 'Route C: Scenic & Heritage Loop (Experience-Oriented)',
    strategy: 'Exploration Corridor via Alternate Scenic Highways',
    distanceKm: distC,
    travelDuration: `${Math.floor((baseDurationMinutes * 1.20) / 60)}h ${Math.round((baseDurationMinutes * 1.20) % 60)}m`,
    travelDurationMinutes: Math.round(baseDurationMinutes * 1.20),
    trafficRisk: 'Moderate',
    routeOverlapPercent: 28,
    tollEstimate: tollC,
    fuelCost: fuelC,
    tollCost: tollC,
    attractionsCost: attrC,
    totalCost: fuelC + tollC + attrC,
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

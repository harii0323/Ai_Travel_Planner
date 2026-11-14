/**
 * RouteOptimizationEngine
 * 
 * Module 6 of VISTA AI Travel Optimization Engine.
 * 
 * Responsibilities:
 * - Orders daily stops to minimize driving distance and eliminate zig-zag backtracking.
 * - Applies Nearest Neighbor insertion followed by 2-Opt local search edge swapping.
 * - Clusters destination stops by geographic proximity to prevent cross-city ping-ponging.
 * - Ensures onward stops progress steadily in the forward travel direction.
 */

const { calculateHaversineDistanceKm } = require('./RouteDiscoveryEngine');

/**
 * Resolves distance between two stops using transition matrix when available,
 * falling back to Haversine distance.
 */
function getDistanceBetween(p1, p2, matrix = null) {
  if (!p1 || !p2) return 0;
  if (matrix && typeof matrix.getTransition === 'function') {
    const cell = matrix.getTransition(p1, p2, { allowFallbackEstimate: true });
    if (cell && cell.distanceKm !== null && cell.dataStatus !== 'unavailable') return cell.distanceKm;
  }
  const c1 = p1.coordinates || p1;
  const c2 = p2.coordinates || p2;
  return calculateHaversineDistanceKm(c1, c2);
}

/**
 * Calculates total tour distance for an array of ordered coordinates/stops.
 */
function calculateTourDistanceKm(stops = [], matrix = null) {
  if (stops.length <= 1) return 0;
  let total = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    total += getDistanceBetween(stops[i], stops[i + 1], matrix);
  }
  return total;
}

/**
 * Optimizes stop sequence using Nearest Neighbor heuristic.
 */
function nearestNeighborSort(startPoint, stops = [], matrix = null) {
  if (stops.length <= 1) return [...stops];

  const unvisited = [...stops];
  const ordered = [];
  let currentStop = startPoint;

  while (unvisited.length > 0) {
    let bestIdx = 0;
    let minDistance = 999999;

    for (let i = 0; i < unvisited.length; i++) {
      const dist = getDistanceBetween(currentStop, unvisited[i], matrix);
      if (dist < minDistance) {
        minDistance = dist;
        bestIdx = i;
      }
    }

    const nextStop = unvisited.splice(bestIdx, 1)[0];
    ordered.push(nextStop);
    currentStop = nextStop;
  }

  return ordered;
}

/**
 * 2-Opt Local Search Heuristic for sequence improvement.
 */
function twoOptOptimize(orderedStops = [], matrix = null) {
  if (orderedStops.length <= 2) return orderedStops;

  let stops = [...orderedStops];
  let improved = true;
  let iterations = 0;
  const maxIterations = 50;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 0; i < stops.length - 1; i++) {
      for (let j = i + 1; j < stops.length; j++) {
        const originalDistance = calculateTourDistanceKm(stops, matrix);
        // Reverse sub-segment between i and j
        const newTour = [
          ...stops.slice(0, i),
          ...stops.slice(i, j + 1).reverse(),
          ...stops.slice(j + 1)
        ];
        const newDistance = calculateTourDistanceKm(newTour, matrix);

        if (newDistance < originalDistance - 0.5) {
          stops = newTour;
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }

  return stops;
}

/**
 * Sorts onward corridor stops by projection along the vector from origin to destination.
 * Ensures the journey moves forward without backtracking.
 */
function sortCorridorStopsAlongVector(originCoord, destCoord, candidateStops = []) {
  if (candidateStops.length <= 1) return candidateStops;

  const dx = destCoord.lng - originCoord.lng;
  const dy = destCoord.lat - originCoord.lat;
  const magSq = dx * dx + dy * dy;

  if (magSq === 0) return candidateStops;

  return [...candidateStops].sort((a, b) => {
    const ac = a.coordinates || originCoord;
    const bc = b.coordinates || originCoord;

    // Vector scalar projection
    const projA = ((ac.lng - originCoord.lng) * dx + (ac.lat - originCoord.lat) * dy) / magSq;
    const projB = ((bc.lng - originCoord.lng) * dx + (bc.lat - originCoord.lat) * dy) / magSq;

    return projA - projB;
  });
}

/**
 * Main Route Optimization function for a single travel day's stops.
 */
function optimizeDayStopSequence(startLocationCoords, endLocationCoords, dayStops = [], isCorridorDay = false, transitionMatrix = null) {
  if (dayStops.length <= 1) return dayStops;

  if (isCorridorDay && startLocationCoords && endLocationCoords) {
    // Forward progression along travel direction
    return sortCorridorStopsAlongVector(startLocationCoords, endLocationCoords, dayStops);
  }

  // If a high-effort mountain trek is scheduled, ensure it is tackled first in morning daylight
  const hasTrek = dayStops.some(s => String(s.category).includes('trek') || (s.subCategories || []).some(sub => sub.includes('trek')));
  if (hasTrek && !isCorridorDay) {
    const treks = dayStops.filter(s => String(s.category).includes('trek') || (s.subCategories || []).some(sub => sub.includes('trek')));
    const others = dayStops.filter(s => !treks.includes(s));
    const sortedOthers = others.length > 0 ? twoOptOptimize(nearestNeighborSort(treks[treks.length - 1], others, transitionMatrix), transitionMatrix) : [];
    return [...treks, ...sortedOthers];
  }

  // Nearest Neighbor followed by 2-Opt for destination cluster days
  const startRef = startLocationCoords?.coordinates ? startLocationCoords : { coordinates: startLocationCoords };
  const nnSorted = nearestNeighborSort(startRef, dayStops, transitionMatrix);
  return twoOptOptimize(nnSorted, transitionMatrix);
}

module.exports = {
  optimizeDayStopSequence,
  nearestNeighborSort,
  twoOptOptimize,
  sortCorridorStopsAlongVector,
  calculateTourDistanceKm,
  ItineraryOptimizationEngine: {
    optimizeDayStopSequence,
    nearestNeighborSort,
    twoOptOptimize,
    sortCorridorStopsAlongVector,
    calculateTourDistanceKm
  }
};


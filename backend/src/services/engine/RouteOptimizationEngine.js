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
 * Calculates total tour distance for an array of ordered coordinates.
 */
function calculateTourDistanceKm(stops = []) {
  if (stops.length <= 1) return 0;
  let total = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    const c1 = stops[i].coordinates || stops[i];
    const c2 = stops[i + 1].coordinates || stops[i + 1];
    total += calculateHaversineDistanceKm(c1, c2);
  }
  return total;
}

/**
 * Optimizes stop sequence using Nearest Neighbor heuristic.
 */
function nearestNeighborSort(startPoint, stops = []) {
  if (stops.length <= 1) return [...stops];

  const unvisited = [...stops];
  const ordered = [];
  let currentCoord = startPoint.coordinates || startPoint;

  while (unvisited.length > 0) {
    let bestIdx = 0;
    let minDistance = 999999;

    for (let i = 0; i < unvisited.length; i++) {
      const targetCoord = unvisited[i].coordinates || unvisited[i];
      const dist = calculateHaversineDistanceKm(currentCoord, targetCoord);
      if (dist < minDistance) {
        minDistance = dist;
        bestIdx = i;
      }
    }

    const nextStop = unvisited.splice(bestIdx, 1)[0];
    ordered.push(nextStop);
    currentCoord = nextStop.coordinates || nextStop;
  }

  return ordered;
}

/**
 * 2-Opt Local Search Heuristic for sequence improvement.
 */
function twoOptOptimize(orderedStops = []) {
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
        const originalDistance = calculateTourDistanceKm(stops);
        // Reverse sub-segment between i and j
        const newTour = [
          ...stops.slice(0, i),
          ...stops.slice(i, j + 1).reverse(),
          ...stops.slice(j + 1)
        ];
        const newDistance = calculateTourDistanceKm(newTour);

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
function optimizeDayStopSequence(startLocationCoords, endLocationCoords, dayStops = [], isCorridorDay = false) {
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
    const sortedOthers = others.length > 0 ? twoOptOptimize(nearestNeighborSort(treks[treks.length - 1].coordinates, others)) : [];
    return [...treks, ...sortedOthers];
  }

  // Nearest Neighbor followed by 2-Opt for destination cluster days
  const nnSorted = nearestNeighborSort(startLocationCoords || dayStops[0].coordinates, dayStops);
  return twoOptOptimize(nnSorted);
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


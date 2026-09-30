/**
 * 2-OPT & 3-OPT LOCAL SEARCH ROUTE IMPROVEMENT ENGINE
 *
 * Implements Section 24:
 * - 3-Opt cuts 3 edges (i, i+1), (j, j+1), (k, k+1) in the route sequence
 * - Evaluates all 7 non-trivial reconnections (2-opt reversals, segment swaps, and double reversals)
 * - Evaluates time-dependent edge transitions, rush-hour congestion, and time-window alignment
 * - Accepts modifications only if they strictly improve efficiency without violating constraints
 */

const { calculateTimeDependentTravelTime } = require('./spatiotemporalUtils');

function computeEuclideanDistance(coord1, coord2) {
  if (!coord1 || !coord2) return 10;
  const dlat = (coord1.lat || 0) - (coord2.lat || 0);
  const dlng = (coord1.lng || 0) - (coord2.lng || 0);
  return Math.sqrt(dlat * dlat + dlng * dlng) * 111; // Approx km
}

/**
 * Total route cost evaluating time-dependent transit and time-window penalties
 */
function evaluateRouteCost(route, departureMinutes = 540) {
  if (!Array.isArray(route) || route.length <= 1) return 0;
  let totalMinutes = 0;
  let currentClock = departureMinutes;
  let penalty = 0;

  for (let i = 0; i < route.length - 1; i++) {
    const from = route[i];
    const to = route[i + 1];
    const distKm = computeEuclideanDistance(from.coordinates, to.coordinates);
    const transit = calculateTimeDependentTravelTime(distKm, currentClock);

    currentClock += transit.travelMinutes;
    totalMinutes += transit.travelMinutes;

    // Check time-window alignment at arrival
    const openMin = to.openMinutes || 360;
    const closeMin = to.closeMinutes || 1140;

    if (currentClock < openMin) {
      // Early arrival waiting penalty
      penalty += (openMin - currentClock) * 0.5;
      currentClock = openMin;
    } else if (currentClock > closeMin) {
      // Late arrival violation penalty (heavy penalty)
      penalty += (currentClock - closeMin) * 5.0;
    }

    const duration = to.durationMinutes || 45;
    currentClock += duration;
    totalMinutes += duration;
  }

  return totalMinutes + penalty;
}

/**
 * 2-Opt Local Search: Reverses sub-sequences to remove route self-crossings
 */
function applyTwoOpt(route, departureMinutes = 540) {
  if (!Array.isArray(route) || route.length <= 3) return route;
  let bestRoute = [...route];
  let bestCost = evaluateRouteCost(bestRoute, departureMinutes);
  let improved = true;
  let iteration = 0;

  while (improved && iteration < 20) {
    improved = false;
    iteration++;

    for (let i = 0; i < bestRoute.length - 1; i++) {
      for (let j = i + 1; j < bestRoute.length; j++) {
        const candidate = [
          ...bestRoute.slice(0, i),
          ...bestRoute.slice(i, j + 1).reverse(),
          ...bestRoute.slice(j + 1)
        ];
        const cost = evaluateRouteCost(candidate, departureMinutes);
        if (cost < bestCost - 1.0) {
          bestRoute = candidate;
          bestCost = cost;
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }

  return bestRoute;
}

/**
 * 3-Opt Local Search: Evaluates all 7 reconnection variants on 3 edge cut points
 */
function applyThreeOptLocalSearch(route, departureMinutes = 540) {
  if (!Array.isArray(route) || route.length <= 4) {
    return applyTwoOpt(route, departureMinutes);
  }

  // Pre-clean with 2-opt
  let bestRoute = applyTwoOpt(route, departureMinutes);
  let bestCost = evaluateRouteCost(bestRoute, departureMinutes);
  let improved = true;
  let iteration = 0;
  const n = bestRoute.length;

  while (improved && iteration < 12) {
    improved = false;
    iteration++;

    for (let i = 0; i < n - 2; i++) {
      for (let j = i + 1; j < n - 1; j++) {
        for (let k = j + 1; k < n; k++) {
          const segA = bestRoute.slice(0, i + 1);
          const segB = bestRoute.slice(i + 1, j + 1);
          const segC = bestRoute.slice(j + 1, k + 1);
          const segD = bestRoute.slice(k + 1);

          const revB = [...segB].reverse();
          const revC = [...segC].reverse();

          // 7 Non-trivial 3-Opt reconnection possibilities
          const candidates = [
            // 1. 2-opt on B
            [...segA, ...revB, ...segC, ...segD],
            // 2. 2-opt on C
            [...segA, ...segB, ...revC, ...segD],
            // 3. Swap B and C
            [...segA, ...segC, ...segB, ...segD],
            // 4. Swap and reverse B
            [...segA, ...segC, ...revB, ...segD],
            // 5. Swap and reverse C
            [...segA, ...revC, ...segB, ...segD],
            // 6. Double reversal (revB, revC)
            [...segA, ...revB, ...revC, ...segD],
            // 7. Swap and reverse both
            [...segA, ...revC, ...revB, ...segD]
          ];

          for (const cand of candidates) {
            const cost = evaluateRouteCost(cand, departureMinutes);
            if (cost < bestCost - 1.5) {
              bestRoute = cand;
              bestCost = cost;
              improved = true;
              break;
            }
          }
          if (improved) break;
        }
        if (improved) break;
      }
      if (improved) break;
    }
  }

  return bestRoute;
}

module.exports = {
  applyTwoOpt,
  applyThreeOptLocalSearch,
  evaluateRouteCost
};

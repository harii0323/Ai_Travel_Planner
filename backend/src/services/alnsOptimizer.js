/**
 * ADAPTIVE LARGE NEIGHBORHOOD SEARCH (ALNS) ENGINE
 *
 * Implements Phase 9: Complete Adaptive Large Neighborhood Search:
 * - 5 Destroy Operators:
 *     1. Worst-Detour Removal
 *     2. Low Marginal-Value Removal
 *     3. Duplicate-Category Removal
 *     4. Random Removal
 *     5. Time-Window Conflict Removal
 * - 5 Repair Operators:
 *     1. Greedy Marginal-Value Insertion
 *     2. Best Feasible Insertion
 *     3. Preference-Aware Insertion
 *     4. Diversity-Aware Insertion
 *     5. Budget-Aware Insertion
 * - Adaptive roulette-wheel operator weight tracking and decay
 * - Simulated Annealing acceptance criteria
 * - Feasibility enforcement and best-solution preservation
 */

const {
  calculateMarginalValue,
  evaluateSubmodularExperienceUtility
} = require('./spatiotemporalUtils');
const { getSegmentRoadDistanceKm, evaluateRouteCost } = require('./threeOptLocalSearch');
const { dppSelectDiverseCandidates } = require('./dppDiversityEngine');

// =========================================================================
// 1. DESTROY OPERATORS
// =========================================================================

function destroyWorstDetour(route, count = 2) {
  if (!Array.isArray(route) || route.length <= count) return [];
  const scored = route.map((place, idx) => ({
    idx,
    detourRatio: (place.detourKm || (place.distanceFromHighwayKm ? place.distanceFromHighwayKm * 2 : 5)) / Math.max(15, place.durationMinutes || 60)
  }));
  scored.sort((a, b) => b.detourRatio - a.detourRatio);
  const removeSet = new Set(scored.slice(0, count).map(s => s.idx));
  return route.filter((_, idx) => !removeSet.has(idx));
}

function destroyLowMarginalValue(route, count = 2, userEmbedding = null) {
  if (!Array.isArray(route) || route.length <= count) return [];
  const scored = route.map((place, idx) => {
    const without = route.filter((_, i) => i !== idx);
    const marginal = calculateMarginalValue(place, without, userEmbedding);
    return { idx, marginal };
  });
  scored.sort((a, b) => a.marginal - b.marginal);
  const removeSet = new Set(scored.slice(0, count).map(s => s.idx));
  return route.filter((_, idx) => !removeSet.has(idx));
}

function destroyDuplicateCategory(route, count = 2) {
  if (!Array.isArray(route) || route.length <= count) return [];
  const seenCats = new Map();
  const duplicateIndices = [];

  route.forEach((place, idx) => {
    const cat = String(place.category || (place.types && place.types[0]) || 'attraction').toLowerCase();
    if (seenCats.has(cat)) {
      duplicateIndices.push(idx);
    } else {
      seenCats.set(cat, idx);
    }
  });

  if (duplicateIndices.length === 0) return destroyWorstDetour(route, count);
  const removeSet = new Set(duplicateIndices.slice(0, count));
  return route.filter((_, idx) => !removeSet.has(idx));
}

function destroyRandom(route, count = 2) {
  if (!Array.isArray(route) || route.length <= count) return [];
  const removeSet = new Set();
  while (removeSet.size < count) {
    const rand = Math.floor(Math.random() * route.length);
    removeSet.add(rand);
  }
  return route.filter((_, idx) => !removeSet.has(idx));
}

function destroyTimeWindowConflict(route, count = 2) {
  if (!Array.isArray(route) || route.length <= count) return [];
  const scored = route.map((place, idx) => {
    const arrival = place.expectedArrivalMinutes || 720;
    const closeMin = place.closeMinutes || 1140;
    const openMin = place.openMinutes || 360;
    let conflictScore = 0;
    if (arrival + 30 > closeMin) conflictScore += 100;
    if (arrival < openMin) conflictScore += (openMin - arrival);
    return { idx, conflictScore };
  });
  scored.sort((a, b) => b.conflictScore - a.conflictScore);
  const removeSet = new Set(scored.slice(0, count).map(s => s.idx));
  return route.filter((_, idx) => !removeSet.has(idx));
}

// =========================================================================
// 2. REPAIR OPERATORS
// =========================================================================

function repairGreedyMarginalValue(currentRoute, candidatePool, targetCount, userEmbedding) {
  const current = [...currentRoute];
  const currentKeys = new Set(current.map(p => p.placeKey || p.name));

  while (current.length < targetCount) {
    let bestCand = null;
    let highestRatio = -Infinity;

    for (const cand of candidatePool) {
      const key = cand.placeKey || cand.name;
      if (currentKeys.has(key)) continue;

      const marginal = calculateMarginalValue(cand, current, userEmbedding);
      const detourKm = cand.detourKm || 5;
      const ratio = marginal / Math.max(2, detourKm * 0.4);

      if (ratio > highestRatio) {
        highestRatio = ratio;
        bestCand = cand;
      }
    }

    if (!bestCand || highestRatio <= 0.01) break;
    current.push(bestCand);
    currentKeys.add(bestCand.placeKey || bestCand.name);
  }
  return current;
}

function repairBestFeasibleInsertion(currentRoute, candidatePool, targetCount, options = {}) {
  const current = [...currentRoute];
  const currentKeys = new Set(current.map(p => p.placeKey || p.name));

  while (current.length < targetCount) {
    let bestCand = null;
    let bestPosition = -1;
    let lowestCostIncrease = Infinity;

    for (const cand of candidatePool) {
      const key = cand.placeKey || cand.name;
      if (currentKeys.has(key)) continue;

      for (let pos = 0; pos <= current.length; pos++) {
        const candidateSeq = [...current.slice(0, pos), cand, ...current.slice(pos)];
        const cost = evaluateRouteCost(candidateSeq, options);
        if (cost < lowestCostIncrease) {
          lowestCostIncrease = cost;
          bestCand = cand;
          bestPosition = pos;
        }
      }
    }

    if (!bestCand || bestPosition === -1) break;
    current.splice(bestPosition, 0, bestCand);
    currentKeys.add(bestCand.placeKey || bestCand.name);
  }
  return current;
}

function repairPreferenceAware(currentRoute, candidatePool, targetCount, userProfile) {
  const current = [...currentRoute];
  const currentKeys = new Set(current.map(p => p.placeKey || p.name));
  const userDimensions = userProfile.dimensions || {};

  // Find top priority unfulfilled preference dimension
  const presentCats = new Set(current.map(p => String(p.category || '').toLowerCase()));
  const targetDims = Object.entries(userDimensions)
    .filter(([dim, w]) => w >= 0.50 && !presentCats.has(dim))
    .sort((a, b) => b[1] - a[1])
    .map(e => e[0]);

  while (current.length < targetCount) {
    let bestCand = null;
    let bestScore = -Infinity;

    for (const cand of candidatePool) {
      const key = cand.placeKey || cand.name;
      if (currentKeys.has(key)) continue;

      const candCat = String(cand.category || '').toLowerCase();
      let prefBonus = targetDims.includes(candCat) ? 2.5 : 0.5;
      const score = (cand.semanticScore || 0.6) * 1.5 + prefBonus - (cand.detourKm || 5) * 0.05;

      if (score > bestScore) {
        bestScore = score;
        bestCand = cand;
      }
    }

    if (!bestCand) break;
    current.push(bestCand);
    currentKeys.add(bestCand.placeKey || bestCand.name);
  }
  return current;
}

function repairDiversityAware(currentRoute, candidatePool, targetCount, userEmbedding) {
  const current = [...currentRoute];
  const currentKeys = new Set(current.map(p => p.placeKey || p.name));
  const remainingPool = candidatePool.filter(c => !currentKeys.has(c.placeKey || c.name));

  const needed = targetCount - current.length;
  if (needed <= 0 || remainingPool.length === 0) return current;

  const diverseSubset = dppSelectDiverseCandidates(remainingPool, needed, userEmbedding);
  return [...current, ...diverseSubset];
}

function repairBudgetAware(currentRoute, candidatePool, targetCount, options = {}) {
  const current = [...currentRoute];
  const currentKeys = new Set(current.map(p => p.placeKey || p.name));
  const sortedByCost = [...candidatePool]
    .filter(c => !currentKeys.has(c.placeKey || c.name))
    .sort((a, b) => ((a.entryFee || 0) + (a.detourKm || 5) * 6) - ((b.entryFee || 0) + (b.detourKm || 5) * 6));

  for (const cand of sortedByCost) {
    if (current.length >= targetCount) break;
    current.push(cand);
    currentKeys.add(cand.placeKey || cand.name);
  }
  return current;
}

// =========================================================================
// 3. MASTER ALNS EXECUTION LOOP
// =========================================================================

/**
 * Executes Adaptive Large Neighborhood Search
 */
function runAdaptiveLargeNeighborhoodSearch(arg1 = {}, candidatePoolArg = [], originArg = null, destinationArg = null, optionsArg = {}) {
  let initialRoute = [];
  let candidatePool = [];
  let userProfile = {};
  let tripContext = {};
  let targetStops = 5;
  let maxIterations = 30;
  let timeLimitMs = 2500;

  if (Array.isArray(arg1)) {
    initialRoute = arg1;
    candidatePool = candidatePoolArg || [];
    tripContext = { origin: originArg, destination: destinationArg, ...(optionsArg || {}) };
    maxIterations = optionsArg?.maxIterations || 30;
    timeLimitMs = optionsArg?.maxTimeMs || optionsArg?.timeLimitMs || 2500;
    targetStops = Math.max(initialRoute.length, optionsArg?.targetStops || 4);
    userProfile = optionsArg?.userProfile || {};
  } else if (arg1 && typeof arg1 === 'object') {
    initialRoute = arg1.initialRoute || [];
    candidatePool = arg1.candidatePool || [];
    userProfile = arg1.userProfile || {};
    tripContext = arg1.tripContext || {};
    targetStops = arg1.targetStops || 5;
    maxIterations = arg1.maxIterations || 30;
    timeLimitMs = arg1.timeLimitMs || 2500;
  }

  const startTime = Date.now();
  const userEmbedding = userProfile.semanticEmbedding;

  const destroyOperators = [
    { name: 'worstDetour', fn: destroyWorstDetour },
    { name: 'lowMarginalValue', fn: (r, c) => destroyLowMarginalValue(r, c, userEmbedding) },
    { name: 'duplicateCategory', fn: destroyDuplicateCategory },
    { name: 'random', fn: destroyRandom },
    { name: 'timeWindowConflict', fn: destroyTimeWindowConflict }
  ];

  const repairOperators = [
    { name: 'greedyMarginal', fn: (r, pool, target) => repairGreedyMarginalValue(r, pool, target, userEmbedding) },
    { name: 'bestFeasible', fn: (r, pool, target) => repairBestFeasibleInsertion(r, pool, target, tripContext) },
    { name: 'preferenceAware', fn: (r, pool, target) => repairPreferenceAware(r, pool, target, userProfile) },
    { name: 'diversityAware', fn: (r, pool, target) => repairDiversityAware(r, pool, target, userEmbedding) },
    { name: 'budgetAware', fn: (r, pool, target) => repairBudgetAware(r, pool, target, tripContext) }
  ];

  // Operator performance weights (initially 1.0)
  const dWeights = new Array(destroyOperators.length).fill(1.0);
  const rWeights = new Array(repairOperators.length).fill(1.0);
  const dScores = new Array(destroyOperators.length).fill(0);
  const rScores = new Array(repairOperators.length).fill(0);
  const dCalls = new Array(destroyOperators.length).fill(0);
  const rCalls = new Array(repairOperators.length).fill(0);

  // Initialize current & best solutions
  let currentRoute = initialRoute.length > 0
    ? [...initialRoute]
    : repairGreedyMarginalValue([], candidatePool, targetStops, userEmbedding);

  let currentCost = evaluateRouteCost(currentRoute, tripContext);
  let bestRoute = [...currentRoute];
  let bestCost = currentCost;

  // Simulated Annealing initial temperature
  let temperature = Math.max(10, currentCost * 0.15);
  const coolingRate = 0.94;
  const decayRho = 0.20;

  function selectRouletteIndex(weights) {
    const sum = weights.reduce((a, b) => a + b, 0);
    const rand = Math.random() * sum;
    let cum = 0;
    for (let i = 0; i < weights.length; i++) {
      cum += weights[i];
      if (rand <= cum) return i;
    }
    return weights.length - 1;
  }

  let iterationsRun = 0;

  for (let it = 0; it < maxIterations; it++) {
    if (Date.now() - startTime > timeLimitMs) break;
    iterationsRun++;

    // 1. Select operators via roulette wheel
    const dIdx = selectRouletteIndex(dWeights);
    const rIdx = selectRouletteIndex(rWeights);
    dCalls[dIdx]++;
    rCalls[rIdx]++;

    const destroyOp = destroyOperators[dIdx];
    const repairOp = repairOperators[rIdx];

    // Determine removal count: between 1 and min(3, route.length - 1)
    const removeCount = Math.max(1, Math.min(3, Math.floor(currentRoute.length * 0.4)));

    // 2. Destroy
    const partialRoute = destroyOp.fn(currentRoute, removeCount);

    // 3. Repair
    const candidateRoute = repairOp.fn(partialRoute, candidatePool, targetStops);

    // 4. Evaluate solution
    const candidateCost = evaluateRouteCost(candidateRoute, tripContext);
    if (!Number.isFinite(candidateCost) || candidateCost === Infinity) {
      // Reject candidates with unavailable transitions or severe constraint violations in strict mode
      continue;
    }
    const delta = candidateCost - currentCost;

    let scoreReward = 0;

    // 5. Acceptance criteria (Simulated Annealing)
    let accepted = false;
    if (candidateCost < bestCost - 1e-4) {
      bestCost = candidateCost;
      bestRoute = [...candidateRoute];
      currentRoute = [...candidateRoute];
      currentCost = candidateCost;
      scoreReward = 30; // New global best found
      accepted = true;
    } else if (delta < 0) {
      currentRoute = [...candidateRoute];
      currentCost = candidateCost;
      scoreReward = 20; // Better than current
      accepted = true;
    } else {
      const acceptProb = Math.exp(-delta / Math.max(0.01, temperature));
      if (Math.random() < acceptProb) {
        currentRoute = [...candidateRoute];
        currentCost = candidateCost;
        scoreReward = 10; // Accepted by Simulated Annealing
        accepted = true;
      }
    }

    dScores[dIdx] += scoreReward;
    rScores[rIdx] += scoreReward;

    // Cool temperature
    temperature *= coolingRate;

    // Adaptive operator weight update every 10 iterations
    if (it > 0 && it % 10 === 0) {
      for (let i = 0; i < dWeights.length; i++) {
        if (dCalls[i] > 0) {
          dWeights[i] = (1 - decayRho) * dWeights[i] + decayRho * (dScores[i] / dCalls[i]);
          dScores[i] = 0;
          dCalls[i] = 0;
        }
      }
      for (let j = 0; j < rWeights.length; j++) {
        if (rCalls[j] > 0) {
          rWeights[j] = (1 - decayRho) * rWeights[j] + decayRho * (rScores[j] / rCalls[j]);
          rScores[j] = 0;
          rCalls[j] = 0;
        }
      }
    }
  }

  const executionTimeMs = Date.now() - startTime;

  return {
    bestRoute,
    bestSequence: bestRoute,
    initialCost: Math.round(evaluateRouteCost(initialRoute, tripContext) * 10) / 10,
    finalCost: Math.round(bestCost * 10) / 10,
    iterationsRun,
    executionTimeMs,
    destroyWeights: destroyOperators.map((op, i) => ({ operator: op.name, weight: Math.round(dWeights[i] * 100) / 100 })),
    repairWeights: repairOperators.map((op, i) => ({ operator: op.name, weight: Math.round(rWeights[i] * 100) / 100 })),
    algorithm: 'ALNS_Simulated_Annealing'
  };
}

module.exports = {
  runAdaptiveLargeNeighborhoodSearch,
  destroyWorstDetour,
  destroyLowMarginalValue,
  destroyDuplicateCategory,
  destroyRandom,
  destroyTimeWindowConflict,
  repairGreedyMarginalValue,
  repairBestFeasibleInsertion,
  repairPreferenceAware,
  repairDiversityAware,
  repairBudgetAware
};

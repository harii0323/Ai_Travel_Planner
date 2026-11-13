/**
 * DETERMINANTAL POINT PROCESS (DPP) & SEMANTIC DIVERSITY ENGINE
 *
 * Implements Phase 5: DPP and Submodular Optimization:
 * - Determinantal Point Process (DPP) models subset diversity via L-ensemble kernel
 * - L_ij = q_i * S_ij * q_j where q_i is item quality (semantic match + bandit score + fame)
 *   and S_ij is the pairwise semantic cosine similarity
 * - Fast Greedy MAP Inference using incremental Cholesky factor decomposition
 * - Guarantees selected POIs are individually relevant and collectively diverse
 * - Numerically stable matrix calculations with epsilon-damping
 * - Robust handling of missing/mismatched embeddings
 * - Deterministic tie-breaking for reproducible itineraries
 */

const { calculateCosineSimilarity, generateSemanticEmbedding } = require('./spatiotemporalUtils');

const EPSILON = 1e-8;

/**
 * Ensures candidate has a valid, normalized semantic embedding
 */
function ensureEmbedding(candidate) {
  if (Array.isArray(candidate.semanticEmbedding) && candidate.semanticEmbedding.length > 0) {
    return candidate.semanticEmbedding;
  }
  const text = `${candidate.name || ''} ${candidate.city || ''} ${candidate.category || ''} ${(candidate.tags || []).join(' ')} ${candidate.description || ''}`;
  return generateSemanticEmbedding(text);
}

/**
 * Perform Fast Greedy MAP Inference on DPP L-ensemble kernel
 * Returns the top-k subset Y that maximizes det(L_Y)
 *
 * @param {Array} candidates - Candidate POIs
 * @param {number} k - Maximum number of diverse places to select
 * @param {Array} userEmbedding - Dense semantic vector of the user
 * @returns {Array} Selected subset with DPP quality & diversity scores
 */
function dppSelectDiverseCandidates(candidates, k = 6, userEmbedding = null) {
  if (!Array.isArray(candidates) || candidates.length === 0) return [];
  if (candidates.length <= k) {
    return candidates.map((cand, idx) => ({
      ...cand,
      dppSelectionRank: idx + 1,
      dppQualityScore: Math.round((cand.semanticScore || 0.75) * 100) / 100
    }));
  }

  const N = candidates.length;
  const maxK = Math.min(k, N);

  // Validate and assign embeddings
  const embeddings = new Array(N);
  for (let i = 0; i < N; i++) {
    embeddings[i] = ensureEmbedding(candidates[i]);
  }

  // 1. Calculate item quality q_i >= 0
  const qualities = new Array(N);
  for (let i = 0; i < N; i++) {
    const cand = candidates[i];
    const sem = cand.semanticScore !== undefined
      ? cand.semanticScore
      : (userEmbedding ? calculateCosineSimilarity(userEmbedding, embeddings[i]) : 0.65);
    const fame = cand.fameScore || 0.50;
    const bandit = cand.banditScore || 0.50;

    // Multi-faceted item quality (strictly positive)
    const rawQ = sem * 1.5 + fame * 0.4 + bandit * 0.3;
    qualities[i] = Math.max(0.01, Math.exp(rawQ - 1.0));
  }

  // 2. Pre-calculate diagonal elements of L: L_ii = q_i^2 (since S_ii = 1.0)
  // d2[i] tracks the residual variance (squared orthogonal distance) for candidate i
  const d2 = new Array(N);
  for (let i = 0; i < N; i++) {
    d2[i] = qualities[i] * qualities[i];
  }

  const selectedIndices = [];
  const c = [];
  for (let j = 0; j < maxK; j++) {
    c.push(new Array(N).fill(0.0));
  }

  // 3. Iterative Greedy Cholesky Selection
  for (let step = 0; step < maxK; step++) {
    let bestIdx = -1;
    let maxVal = -Infinity;

    for (let i = 0; i < N; i++) {
      if (selectedIndices.includes(i)) continue;
      if (d2[i] > maxVal) {
        maxVal = d2[i];
        bestIdx = i;
      } else if (Math.abs(d2[i] - maxVal) < EPSILON && bestIdx !== -1) {
        // Deterministic tie-breaking by candidate placeId or name
        const keyCurr = String(candidates[i].placeId || candidates[i].name || i);
        const keyBest = String(candidates[bestIdx].placeId || candidates[bestIdx].name || bestIdx);
        if (keyCurr < keyBest) {
          bestIdx = i;
        }
      }
    }

    // Stop if remaining items add negligible orthogonal volume
    if (bestIdx === -1 || maxVal <= EPSILON) break;

    selectedIndices.push(bestIdx);
    const dVal = Math.sqrt(Math.max(EPSILON, maxVal));

    // Update Cholesky factors for all remaining items
    const bestCandEmb = embeddings[bestIdx];
    const qBest = qualities[bestIdx];

    for (let i = 0; i < N; i++) {
      if (selectedIndices.includes(i)) continue;

      // Cosine Similarity between selected item and candidate i
      const sim = calculateCosineSimilarity(bestCandEmb, embeddings[i]);
      // L_{bestIdx, i} = q_best * S_{best, i} * q_i
      const L_best_i = qBest * sim * qualities[i];

      // Inner product of previous Cholesky projection columns
      let sumPrev = 0.0;
      for (let prev = 0; prev < step; prev++) {
        sumPrev += c[prev][bestIdx] * c[prev][i];
      }

      c[step][i] = (L_best_i - sumPrev) / dVal;
      // Reduce orthogonal distance d^2 for candidate i (damped with 0 floor)
      d2[i] = Math.max(0.0, d2[i] - c[step][i] * c[step][i]);
    }
  }

  // Return the selected subset with DPP annotations
  return selectedIndices.map((idx, rank) => ({
    ...candidates[idx],
    semanticEmbedding: embeddings[idx],
    dppSelectionRank: rank + 1,
    dppQualityScore: Math.round(qualities[idx] * 100) / 100
  }));
}

/**
 * Compute the average pairwise angular distance diversity metric of a chosen subset:
 * Diveristy = mean(1.0 - CosSim(s_i, s_j))
 */
function calculateSubsetDppDiversity(subset) {
  if (!Array.isArray(subset) || subset.length <= 1) return 1.0;
  const n = subset.length;
  let totalPairwiseDistance = 0;
  let pairCount = 0;

  for (let i = 0; i < n; i++) {
    const embI = ensureEmbedding(subset[i]);
    for (let j = i + 1; j < n; j++) {
      const embJ = ensureEmbedding(subset[j]);
      const sim = calculateCosineSimilarity(embI, embJ);
      totalPairwiseDistance += (1.0 - sim);
      pairCount++;
    }
  }

  const avgDistance = pairCount > 0 ? (totalPairwiseDistance / pairCount) : 1.0;
  return Math.round(avgDistance * 100) / 100;
}

module.exports = {
  dppSelectDiverseCandidates,
  calculateSubsetDppDiversity,
  ensureEmbedding
};

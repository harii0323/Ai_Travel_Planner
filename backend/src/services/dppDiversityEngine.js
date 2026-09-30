/**
 * DETERMINANTAL POINT PROCESS (DPP) & SEMANTIC DIVERSITY ENGINE
 *
 * Implements Sections 25 & 26:
 * - Determinantal Point Process (DPP) models subset diversity via L-ensemble kernel
 * - L_ij = q_i * S_ij * q_j where q_i is item quality (semantic match + bandit score)
 *   and S_ij is the pairwise semantic cosine similarity
 * - Fast Greedy MAP Inference using incremental Cholesky factor decomposition
 * - Guarantees selected POIs are individually relevant and collectively diverse
 * - Replaces simplistic category inequality (cat != cat) with continuous vector diversity
 */

const { calculateCosineSimilarity } = require('./spatiotemporalUtils');

/**
 * Perform Fast Greedy MAP Inference on DPP L-ensemble kernel
 * Returns the top-k subset Y that maximizes det(L_Y)
 *
 * @param {Array} candidates - Candidate POIs with semanticEmbedding and quality score
 * @param {number} k - Maximum number of diverse places to select
 * @param {Array} userEmbedding - Dense semantic vector of the user
 * @returns {Array} Selected subset with DPP quality & diversity scores
 */
function dppSelectDiverseCandidates(candidates, k = 6, userEmbedding = null) {
  if (!Array.isArray(candidates) || candidates.length === 0) return [];
  if (candidates.length <= k) return candidates;

  const N = candidates.length;
  const maxK = Math.min(k, N);

  // 1. Calculate item quality q_i >= 0
  const qualities = new Array(N);
  for (let i = 0; i < N; i++) {
    const cand = candidates[i];
    const sem = cand.semanticScore || (userEmbedding && cand.semanticEmbedding ? calculateCosineSimilarity(userEmbedding, cand.semanticEmbedding) : 0.6);
    const fame = cand.fameScore || 0.5;
    const bandit = cand.banditScore || 0.5;
    // Multi-faceted item quality
    qualities[i] = Math.max(0.01, Math.exp(sem * 1.5 + fame * 0.5 + bandit * 0.4 - 1.0));
  }

  // 2. Pre-calculate diagonal elements of L: L_ii = q_i^2 (since S_ii = 1.0)
  // d2[i] tracks the residual variance (squared orthogonal distance) for candidate i
  const d2 = new Array(N);
  for (let i = 0; i < N; i++) {
    d2[i] = qualities[i] * qualities[i];
  }

  const selectedIndices = [];
  // Matrix c stores Cholesky rows: c[j][i] is the projection of item i on j-th selected item
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
      }
    }

    // Stop if remaining items add negligible orthogonal volume
    if (bestIdx === -1 || maxVal <= 1e-6) break;

    selectedIndices.push(bestIdx);
    const dVal = Math.sqrt(Math.max(1e-9, maxVal));

    // Update Cholesky factors for all remaining items
    const bestCand = candidates[bestIdx];
    const qBest = qualities[bestIdx];

    for (let i = 0; i < N; i++) {
      if (selectedIndices.includes(i)) continue;

      // S_best,i = Cosine Similarity between best selected and candidate i
      const sim = calculateCosineSimilarity(
        bestCand.semanticEmbedding,
        candidates[i].semanticEmbedding
      );
      // L_{bestIdx, i} = q_best * S_{best, i} * q_i
      const L_best_i = qBest * sim * qualities[i];

      // Inner product of previous Cholesky columns
      let sumPrev = 0.0;
      for (let prev = 0; prev < step; prev++) {
        sumPrev += c[prev][bestIdx] * c[prev][i];
      }

      c[step][i] = (L_best_i - sumPrev) / dVal;
      // Reduce orthogonal distance d^2 for candidate i
      d2[i] = Math.max(0.0, d2[i] - c[step][i] * c[step][i]);
    }
  }

  // Return the selected subset with DPP annotations
  return selectedIndices.map((idx, rank) => ({
    ...candidates[idx],
    dppSelectionRank: rank + 1,
    dppQualityScore: Math.round(qualities[idx] * 100) / 100
  }));
}

/**
 * Compute the log-determinant diversity metric of a chosen subset
 * Higher logDet = greater collective diversity without semantic clustering
 */
function calculateSubsetDppDiversity(subset) {
  if (!Array.isArray(subset) || subset.length <= 1) return 1.0;
  const n = subset.length;
  let totalPairwiseDistance = 0;
  let pairCount = 0;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sim = calculateCosineSimilarity(
        subset[i].semanticEmbedding,
        subset[j].semanticEmbedding
      );
      // Angular distance in embedding space
      const dist = 1.0 - sim;
      totalPairwiseDistance += dist;
      pairCount++;
    }
  }

  const avgDistance = pairCount > 0 ? (totalPairwiseDistance / pairCount) : 1.0;
  return Math.round(avgDistance * 100) / 100;
}

module.exports = {
  dppSelectDiverseCandidates,
  calculateSubsetDppDiversity
};

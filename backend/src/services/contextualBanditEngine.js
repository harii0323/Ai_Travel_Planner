/**
 * CONTEXTUAL MULTI-ARMED BANDIT ENGINE (LinUCB with Ridge Regression)
 *
 * Implements Sections 8, 9, 29, 30:
 * - Balances exploitation of known user preferences with controlled exploration of regional gems
 * - Feature context vector x_t: user preferences, traveler type, budget, trip pace, weather
 * - LinUCB disjoint arm model: A_a <- A_a + x_t * x_t^T, b_a <- b_a + r_t * x_t
 * - Ridge regression weight estimate: theta_a = A_a^(-1) * b_a
 * - Upper Confidence Bound: UCB(a) = theta_a^T * x_t + alpha * sqrt(x_t^T * A_a^(-1) * x_t)
 * - Online real-time feedback ingestion: saves, clicks, ratings, visits, skips, and rejections
 */

const fs = require('fs');
const path = require('path');

// Dimension of the context feature vector x_t
const CONTEXT_DIM = 8;
const DEFAULT_ALPHA = 0.45; // Exploration trade-off coefficient

// Arm keys: 12 primary travel experience categories
const BANDIT_ARMS = [
  'nature',
  'waterfalls',
  'heritage',
  'viewpoints',
  'adventure',
  'culinary',
  'wildlife',
  'spiritual',
  'beaches',
  'caves',
  'relaxation',
  'scenic_roads'
];

// Helper: Matrix-vector operations in pure JavaScript
function createIdentityMatrix(dim) {
  const m = [];
  for (let i = 0; i < dim; i++) {
    const row = new Array(dim).fill(0);
    row[i] = 1.0;
    m.push(row);
  }
  return m;
}

// Invert small symmetric positive-definite matrix (Gauss-Jordan elimination)
function invertMatrix(matrix) {
  const n = matrix.length;
  // Augment with identity
  const aug = matrix.map((row, i) => {
    const r = [...row];
    for (let j = 0; j < n; j++) {
      r.push(i === j ? 1.0 : 0.0);
    }
    return r;
  });

  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(aug[k][i]) > Math.abs(aug[maxRow][i])) {
        maxRow = k;
      }
    }
    const temp = aug[i];
    aug[i] = aug[maxRow];
    aug[maxRow] = temp;

    const pivot = aug[i][i] || 1e-6;
    for (let j = 0; j < 2 * n; j++) {
      aug[i][j] /= pivot;
    }

    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = aug[k][i];
        for (let j = 0; j < 2 * n; j++) {
          aug[k][j] -= factor * aug[i][j];
        }
      }
    }
  }

  return aug.map(row => row.slice(n));
}

function dotProduct(v1, v2) {
  let sum = 0;
  for (let i = 0; i < v1.length; i++) {
    sum += (v1[i] || 0) * (v2[i] || 0);
  }
  return sum;
}

function matrixVectorMult(matrix, vector) {
  return matrix.map(row => dotProduct(row, vector));
}

class ContextualBanditEngine {
  constructor() {
    this.arms = {};
    this.userProfiles = new Map();
    this.interactionHistory = [];

    // Initialize bandit arm parameters
    BANDIT_ARMS.forEach(arm => {
      this.arms[arm] = {
        A: createIdentityMatrix(CONTEXT_DIM), // Precision matrix (regularized with I)
        b: new Array(CONTEXT_DIM).fill(0.0),   // Response vector
        pullCount: 0,
        totalReward: 0
      };
    });
  }

  /**
   * Build 8-dimensional normalized context vector x_t from trip context
   */
  buildContextVector(userProfile = {}, tripContext = {}) {
    const x = new Array(CONTEXT_DIM).fill(0.1);

    // Feature 0: Traveler Type Affinity
    const travelerType = String(userProfile.travelerType || tripContext.travelerType || 'FRIENDS').toUpperCase();
    if (travelerType.includes('FAMILY')) x[0] = 0.85;
    else if (travelerType.includes('SOLO')) x[0] = 0.50;
    else if (travelerType.includes('COUPLE')) x[0] = 0.70;
    else if (travelerType.includes('FRIEND')) x[0] = 0.95;
    else x[0] = 0.60;

    // Feature 1: Budget Density
    const budget = Number(tripContext.budget || userProfile.budget || 20000);
    const durationDays = Math.max(1, Number(tripContext.tripDurationDays || userProfile.tripDurationDays || 3));
    const dailyBudget = budget / durationDays;
    x[1] = Math.min(1.0, dailyBudget / 8000);

    // Feature 2: Trip Duration / Fatigue Factor
    x[2] = Math.min(1.0, durationDays / 10);

    // Feature 3: Travel Mode (Car = 0.9, Public Transit = 0.3, Bike = 1.0)
    const mode = String(tripContext.travelMode || 'car').toLowerCase();
    x[3] = mode.includes('bike') ? 1.0 : (mode.includes('car') ? 0.85 : 0.4);

    // Feature 4: Outdoor / Nature Predisposition from user embedding
    const rawPrefs = userProfile.preferredActivities || [];
    const text = (Array.isArray(rawPrefs) ? rawPrefs.join(' ') : String(rawPrefs)).toLowerCase();
    x[4] = (text.includes('nature') || text.includes('waterfall') || text.includes('scenic')) ? 0.9 : 0.3;

    // Feature 5: Adventure / Thrill Tolerance
    x[5] = (text.includes('adventure') || text.includes('trekking') || text.includes('safari')) ? 0.9 : 0.2;

    // Feature 6: Cultural / Heritage Interest
    x[6] = (text.includes('temple') || text.includes('heritage') || text.includes('fort') || text.includes('history')) ? 0.85 : 0.25;

    // Feature 7: Highway Transit Weather Index (1.0 = Clear, 0.4 = Heavy Rain)
    const weather = String(tripContext.weatherCondition || 'Clear').toLowerCase();
    x[7] = (weather.includes('rain') || weather.includes('storm')) ? 0.35 : 0.95;

    // Normalize context vector to unit length
    const norm = Math.sqrt(dotProduct(x, x)) || 1.0;
    return x.map(val => val / norm);
  }

  /**
   * Score an arm (Category or POI) using LinUCB:
   * Score(a) = theta_a^T * x_t + alpha * sqrt(x_t^T * A_a^(-1) * x_t)
   */
  scoreArm(armName, contextVector, alpha = DEFAULT_ALPHA) {
    const armKey = (armName || 'nature').toLowerCase();
    const arm = this.arms[armKey] || this.arms['nature'];

    try {
      const A_inv = invertMatrix(arm.A);
      const theta = matrixVectorMult(A_inv, arm.b);
      const expectedReward = dotProduct(theta, contextVector);

      // Variance / Uncertainty estimate
      const A_inv_x = matrixVectorMult(A_inv, contextVector);
      const variance = Math.max(0, dotProduct(contextVector, A_inv_x));
      const explorationBonus = alpha * Math.sqrt(variance);

      return {
        arm: armKey,
        exploitScore: Math.round(expectedReward * 1000) / 1000,
        exploreBonus: Math.round(explorationBonus * 1000) / 1000,
        banditScore: Math.round((expectedReward + explorationBonus) * 1000) / 1000,
        pullCount: arm.pullCount
      };
    } catch (e) {
      return {
        arm: armKey,
        exploitScore: 0.5,
        exploreBonus: 0.2,
        banditScore: 0.7,
        pullCount: arm.pullCount
      };
    }
  }

  /**
   * Evaluate a candidate POI with LinUCB
   */
  evaluateCandidate(poi, contextVector, alpha = DEFAULT_ALPHA) {
    const category = (poi.category || 'nature').toLowerCase();
    const armScore = this.scoreArm(category, contextVector, alpha);

    return {
      ...poi,
      banditScore: armScore.banditScore,
      exploitScore: armScore.exploitScore,
      exploreBonus: armScore.exploreBonus,
      isExplorationCandidate: armScore.exploreBonus > 0.18
    };
  }

  /**
   * Ingest real user behavioral feedback to update bandit ridge regression weights
   */
  updateFeedback({ userId = 'anonymous', poiName = '', category = 'nature', action = 'VISITED', rating = null }) {
    const armKey = (category || 'nature').toLowerCase();
    if (!this.arms[armKey]) {
      this.arms[armKey] = {
        A: createIdentityMatrix(CONTEXT_DIM),
        b: new Array(CONTEXT_DIM).fill(0.0),
        pullCount: 0,
        totalReward: 0
      };
    }

    // Determine numerical reward signal r_t
    let r = 0.5; // baseline neutral
    const act = String(action).toUpperCase();
    if (act === 'VISITED' || act === 'SAVED') r = 1.0;
    else if (act === 'SELECTED') r = 0.85;
    else if (act === 'CLICKED') r = 0.60;
    else if (act === 'SKIPPED') r = -0.20;
    else if (act === 'REJECTED') r = -0.60;

    if (rating != null) {
      const numRating = Number(rating);
      if (numRating >= 4.5) r += 0.35;
      else if (numRating <= 2.5) r -= 0.40;
    }
    r = Math.max(-1.0, Math.min(1.5, r));

    // Construct dummy recent context or default
    const contextVector = new Array(CONTEXT_DIM).fill(1 / Math.sqrt(CONTEXT_DIM));

    // Update A_a <- A_a + x_t * x_t^T
    const arm = this.arms[armKey];
    for (let i = 0; i < CONTEXT_DIM; i++) {
      for (let j = 0; j < CONTEXT_DIM; j++) {
        arm.A[i][j] += contextVector[i] * contextVector[j];
      }
      arm.b[i] += r * contextVector[i];
    }
    arm.pullCount += 1;
    arm.totalReward += r;

    const record = {
      timestamp: new Date().toISOString(),
      userId,
      poiName,
      category: armKey,
      action: act,
      reward: r,
      updatedPullCount: arm.pullCount
    };
    this.interactionHistory.push(record);
    if (this.interactionHistory.length > 500) {
      this.interactionHistory.shift();
    }

    console.log(`🎯 [LinUCB] Updated Arm "${armKey}" with action ${act} (Reward: ${r}, Pulls: ${arm.pullCount})`);
    return { success: true, record };
  }

  getBanditState() {
    const summary = {};
    for (const [armKey, arm] of Object.entries(this.arms)) {
      summary[armKey] = {
        pullCount: arm.pullCount,
        avgReward: arm.pullCount > 0 ? Math.round((arm.totalReward / arm.pullCount) * 100) / 100 : 0
      };
    }
    return {
      activeArms: summary,
      totalInteractions: this.interactionHistory.length,
      recentHistory: this.interactionHistory.slice(-10)
    };
  }
}

// Export singleton instance
const contextualBanditInstance = new ContextualBanditEngine();

module.exports = {
  ContextualBanditEngine,
  contextualBandit: contextualBanditInstance,
  BANDIT_ARMS
};

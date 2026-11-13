/**
 * CONTEXTUAL MULTI-ARMED BANDIT ENGINE (LinUCB with Ridge Regression)
 *
 * Implements Phase 4: LinUCB Contextual Bandit Correction:
 * - 10-D Normalized Traveler Context Vector x_t
 * - Active context caching: binds traveler context to recommendations for feedback
 * - Disjoint arm models: A_a <- A_a + x_t * x_t^T, b_a <- b_a + r_t * x_t
 * - User-specific models with global prior shrinkage (prevents cross-user model corruption)
 * - Duplicate feedback event guards
 * - Documented normalized reward policy: VISITED (+1.0), SAVED (+0.85), SELECTED (+0.70), CLICKED (+0.30), SKIPPED (-0.20), REJECTED (-0.60)
 * - Measurable exploration & exploitation metrics
 */

const CONTEXT_DIM = 10;
const DEFAULT_ALPHA = 0.40; // Exploration trade-off coefficient
const RIDGE_REGULARIZATION_LAMBDA = 1.0;

// Arm keys: 16 primary travel experience categories
const BANDIT_ARMS = [
  'nature',
  'waterfalls',
  'mountains',
  'viewpoints',
  'adventure',
  'culinary',
  'wildlife',
  'spiritual',
  'beaches',
  'caves',
  'relaxation',
  'scenic_roads',
  'heritage',
  'forts',
  'palaces',
  'trekking'
];

function createIdentityMatrix(dim, scale = RIDGE_REGULARIZATION_LAMBDA) {
  const m = [];
  for (let i = 0; i < dim; i++) {
    const row = new Array(dim).fill(0.0);
    row[i] = scale;
    m.push(row);
  }
  return m;
}

function cloneMatrix(matrix) {
  return matrix.map(row => [...row]);
}

function dotProduct(v1, v2) {
  let sum = 0;
  const len = Math.min(v1.length, v2.length);
  for (let i = 0; i < len; i++) {
    sum += (v1[i] || 0) * (v2[i] || 0);
  }
  return sum;
}

function matrixVectorMult(matrix, vector) {
  return matrix.map(row => dotProduct(row, vector));
}

// Invert symmetric positive-definite matrix via Gauss-Jordan elimination with diagonal damping
function invertMatrix(matrix) {
  const n = matrix.length;
  const aug = matrix.map((row, i) => {
    const r = [...row];
    // Add small ridge regularizer on diagonal if needed for numerical stability
    r[i] += 1e-6;
    for (let j = 0; j < n; j++) {
      r.push(i === j ? 1.0 : 0.0);
    }
    return r;
  });

  for (let i = 0; i < n; i++) {
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

function initArmSet() {
  const arms = {};
  BANDIT_ARMS.forEach(arm => {
    arms[arm] = {
      A: createIdentityMatrix(CONTEXT_DIM),
      b: new Array(CONTEXT_DIM).fill(0.0),
      pullCount: 0,
      totalReward: 0,
      recentRewards: []
    };
  });
  return arms;
}

class ContextualBanditEngine {
  constructor() {
    this.globalArms = initArmSet();
    this.userArms = new Map(); // userId -> arm set
    this.cachedContexts = new Map(); // contextKey / recommendationId -> contextVector
    this.processedFeedbackEvents = new Set(); // deduplication tracker: userId:poiName:action
    this.interactionHistory = [];
  }

  /**
   * Build 10-dimensional normalized traveler context vector x_t
   */
  buildContextVector(userProfile = {}, tripContext = {}) {
    const x = new Array(CONTEXT_DIM).fill(0.1);

    // Feature 0: Traveler Type Affinity
    const travelerType = String(
      userProfile.travelerType || tripContext.travelerType || userProfile.travelCompanionType || 'friends'
    ).toUpperCase();
    if (travelerType.includes('FAMILY')) x[0] = 0.85;
    else if (travelerType.includes('SOLO')) x[0] = 0.55;
    else if (travelerType.includes('COUPLE')) x[0] = 0.75;
    else if (travelerType.includes('FRIEND')) x[0] = 0.95;
    else x[0] = 0.60;

    // Feature 1: Budget Density (Normalized daily budget)
    const budget = Number(tripContext.budget || userProfile.budget || userProfile.totalBudget || 25000);
    const durationDays = Math.max(1, Number(tripContext.tripDurationDays || userProfile.totalDays || userProfile.trip_duration || 3));
    const dailyBudget = budget / durationDays;
    x[1] = Math.max(0.1, Math.min(1.0, dailyBudget / 8000));

    // Feature 2: Trip Duration / Fatigue Factor
    x[2] = Math.max(0.1, Math.min(1.0, durationDays / 10));

    // Feature 3: Travel Mode Affinity
    const mode = String(tripContext.travelMode || userProfile.transportMode || 'car').toLowerCase();
    x[3] = mode.includes('bike') ? 1.0 : (mode.includes('car') ? 0.85 : 0.40);

    // Profile weights or text for preference dimensions
    const dims = userProfile.dimensions || {};
    const rawPrefs = userProfile.preferredActivities || userProfile.activities || [];
    const text = (Array.isArray(rawPrefs) ? rawPrefs.join(' ') : String(rawPrefs)).toLowerCase();

    // Feature 4: Outdoor / Nature Predisposition
    x[4] = dims.nature !== undefined ? dims.nature : ((text.includes('nature') || text.includes('waterfall') || text.includes('scenic')) ? 0.90 : 0.25);

    // Feature 5: Adventure / Thrill Tolerance
    x[5] = dims.adventure !== undefined ? dims.adventure : ((text.includes('adventure') || text.includes('trekking') || text.includes('safari')) ? 0.90 : 0.20);

    // Feature 6: Heritage / Cultural / Spiritual Interest
    const cultWeight = Math.max(dims.historical || 0, dims.temples || 0, dims.spiritual || 0, dims.forts || 0);
    x[6] = cultWeight > 0 ? cultWeight : ((text.includes('temple') || text.includes('heritage') || text.includes('fort') || text.includes('history')) ? 0.85 : 0.25);

    // Feature 7: Scenic / Photography Affinity
    x[7] = dims.photography !== undefined ? dims.photography : ((text.includes('viewpoint') || text.includes('photo') || text.includes('sunrise') || text.includes('sunset')) ? 0.90 : 0.30);

    // Feature 8: Relaxation / Leisure Preference
    x[8] = dims.relaxation !== undefined ? dims.relaxation : ((text.includes('relax') || text.includes('peaceful') || text.includes('beach') || text.includes('chill')) ? 0.85 : 0.25);

    // Feature 9: Transit Weather Suitability Index (1.0 = Clear, 0.45 = Rain, 0.2 = Storm)
    const weather = String(tripContext.weatherCondition || 'Clear').toLowerCase();
    if (weather.includes('storm') || weather.includes('severe')) x[9] = 0.20;
    else if (weather.includes('rain')) x[9] = 0.45;
    else if (weather.includes('fog')) x[9] = 0.65;
    else x[9] = 0.95;

    // L2 Normalize context vector
    let sumSq = 0;
    for (let i = 0; i < CONTEXT_DIM; i++) sumSq += x[i] * x[i];
    const norm = Math.sqrt(sumSq) || 1.0;

    return x.map(val => Math.round((val / norm) * 10000) / 10000);
  }

  /**
   * Register active context for an active user or recommendation session
   */
  registerActiveContext(userId, contextVector, recommendationId = null) {
    if (userId) {
      this.cachedContexts.set(`user:${userId}`, contextVector);
    }
    if (recommendationId) {
      this.cachedContexts.set(`rec:${recommendationId}`, contextVector);
    }
  }

  /**
   * Retrieve active context for a user or recommendation
   */
  getActiveContext(userId, recommendationId = null) {
    if (recommendationId && this.cachedContexts.has(`rec:${recommendationId}`)) {
      return this.cachedContexts.get(`rec:${recommendationId}`);
    }
    if (userId && this.cachedContexts.has(`user:${userId}`)) {
      return this.cachedContexts.get(`user:${userId}`);
    }
    return this.buildContextVector({ travelerType: 'friends' });
  }

  /**
   * Score an arm using LinUCB with user-specific model & global prior
   */
  scoreArm(armName, contextVectorOrUserId = 'global', maybeUserId = null, alpha = DEFAULT_ALPHA) {
    const armKey = (armName || 'nature').toLowerCase();
    const globalArm = this.globalArms[armKey] || this.globalArms['nature'];

    let contextVector = null;
    let userId = 'global';
    if (typeof contextVectorOrUserId === 'string') {
      userId = contextVectorOrUserId;
      contextVector = this.getActiveContext(userId);
    } else {
      contextVector = contextVectorOrUserId || this.getActiveContext(maybeUserId || 'global');
      userId = maybeUserId || 'global';
    }

    // Retrieve or initialize user arm
    let userArm = null;
    if (userId && userId !== 'global' && userId !== 'anonymous') {
      if (!this.userArms.has(userId)) {
        this.userArms.set(userId, initArmSet());
      }
      userArm = this.userArms.get(userId)[armKey] || this.userArms.get(userId)['nature'];
    }

    // Blend user model with global prior
    const effectiveA = cloneMatrix(globalArm.A);
    const effectiveB = [...globalArm.b];

    if (userArm && userArm.pullCount > 0) {
      for (let i = 0; i < CONTEXT_DIM; i++) {
        for (let j = 0; j < CONTEXT_DIM; j++) {
          effectiveA[i][j] += userArm.A[i][j] * 1.5;
        }
        effectiveB[i] += userArm.b[i] * 1.5;
      }
    }

    try {
      const A_inv = invertMatrix(effectiveA);
      const theta = matrixVectorMult(A_inv, effectiveB);
      const expectedReward = dotProduct(theta, contextVector);

      const A_inv_x = matrixVectorMult(A_inv, contextVector);
      const variance = Math.max(0, dotProduct(contextVector, A_inv_x));
      const explorationBonus = alpha * Math.sqrt(variance);

      return {
        arm: armKey,
        exploitScore: Math.round(expectedReward * 1000) / 1000,
        exploreBonus: Math.round(explorationBonus * 1000) / 1000,
        banditScore: Math.round((expectedReward + explorationBonus) * 1000) / 1000,
        uncertaintyVariance: Math.round(variance * 1000) / 1000,
        pullCount: (userArm ? userArm.pullCount : 0) + globalArm.pullCount
      };
    } catch (e) {
      return {
        arm: armKey,
        exploitScore: 0.50,
        exploreBonus: 0.20,
        banditScore: 0.70,
        uncertaintyVariance: 0.05,
        pullCount: globalArm.pullCount
      };
    }
  }

  /**
   * Evaluate candidate POI with LinUCB
   */
  evaluateCandidate(poi, contextVector, userId = 'global', alpha = DEFAULT_ALPHA) {
    const category = String(poi.category || (poi.types && poi.types[0]) || 'nature').toLowerCase();
    const armScore = this.scoreArm(category, contextVector, userId, alpha);

    return {
      ...poi,
      banditScore: armScore.banditScore,
      exploitScore: armScore.exploitScore,
      exploreBonus: armScore.exploreBonus,
      isExplorationCandidate: armScore.exploreBonus > 0.16
    };
  }

  /**
   * Ingest real behavioral feedback using the ACTUAL traveler context vector.
   * Documented reward policy:
   * - VISITED: +1.0
   * - SAVED: +0.85
   * - SELECTED: +0.70
   * - CLICKED: +0.30
   * - SKIPPED: -0.20
   * - REJECTED: -0.60
   * - Rating modifier: >= 4.5 -> +0.35; <= 2.5 -> -0.40
   */
  updateFeedback({
    userId = 'anonymous',
    poiName = '',
    category = 'nature',
    action = 'VISITED',
    rating = null,
    recommendationId = null,
    explicitContext = null
  }) {
    const armKey = (category || 'nature').toLowerCase();
    const act = String(action).toUpperCase();
    const dedupeKey = `${userId}:${poiName.toLowerCase().replace(/[^a-z0-9]/g, '')}:${act}`;

    // Prevent duplicate feedback
    if (this.processedFeedbackEvents.has(dedupeKey)) {
      return {
        success: true,
        isDuplicate: true,
        message: 'Feedback already processed for this user and item action.'
      };
    }
    this.processedFeedbackEvents.add(dedupeKey);

    // Compute numerical reward signal r_t
    let r = 0.5; // baseline neutral
    if (act === 'VISITED' || act === 'BOOKED') r = 1.0;
    else if (act === 'SAVED') r = 0.85;
    else if (act === 'SELECTED') r = 0.70;
    else if (act === 'CLICKED' || act === 'VIEWED') r = 0.30;
    else if (act === 'SKIPPED') r = -0.20;
    else if (act === 'REJECTED' || act === 'DISLIKED') r = -0.60;

    if (rating != null) {
      const numRating = Number(rating);
      if (numRating >= 4.5) r += 0.35;
      else if (numRating <= 2.5) r -= 0.40;
    }
    r = Math.max(-1.0, Math.min(1.5, Math.round(r * 100) / 100));

    // Obtain the TRUE traveler context vector (never a uniform dummy vector)
    const contextVector = explicitContext || this.getActiveContext(userId, recommendationId);

    // 1. Update User Arm if user is authenticated
    if (userId && userId !== 'anonymous' && userId !== 'global') {
      if (!this.userArms.has(userId)) {
        this.userArms.set(userId, initArmSet());
      }
      const uArms = this.userArms.get(userId);
      const uArm = uArms[armKey] || uArms['nature'];

      for (let i = 0; i < CONTEXT_DIM; i++) {
        for (let j = 0; j < CONTEXT_DIM; j++) {
          uArm.A[i][j] += contextVector[i] * contextVector[j];
        }
        uArm.b[i] += r * contextVector[i];
      }
      uArm.pullCount += 1;
      uArm.totalReward += r;
    }

    // 2. Update Global Arm with shared learning
    const gArm = this.globalArms[armKey] || this.globalArms['nature'];
    for (let i = 0; i < CONTEXT_DIM; i++) {
      for (let j = 0; j < CONTEXT_DIM; j++) {
        gArm.A[i][j] += contextVector[i] * contextVector[j];
      }
      gArm.b[i] += r * contextVector[i];
    }
    gArm.pullCount += 1;
    gArm.totalReward += r;
    gArm.recentRewards.push(r);
    if (gArm.recentRewards.length > 20) gArm.recentRewards.shift();

    const record = {
      timestamp: new Date().toISOString(),
      userId,
      poiName,
      category: armKey,
      action: act,
      reward: r,
      contextVectorSnapshot: contextVector.slice(0, 4),
      updatedPullCount: gArm.pullCount
    };

    this.interactionHistory.push(record);
    if (this.interactionHistory.length > 500) {
      this.interactionHistory.shift();
    }

    return {
      success: true,
      record,
      armKey,
      reward: r,
      globalPulls: gArm.pullCount
    };
  }

  getBanditState() {
    const summary = {};
    for (const [armKey, arm] of Object.entries(this.globalArms)) {
      summary[armKey] = {
        pullCount: arm.pullCount,
        avgReward: arm.pullCount > 0 ? Math.round((arm.totalReward / arm.pullCount) * 100) / 100 : 0,
        recentRewards: arm.recentRewards.slice(-5)
      };
    }
    return {
      activeArms: summary,
      totalInteractions: this.interactionHistory.length,
      recentHistory: this.interactionHistory.slice(-10)
    };
  }

  async persistStateToDb(dbPool) {
    if (!dbPool || typeof dbPool.query !== 'function') return false;
    try {
      // Persist global arms
      for (const [armId, arm] of Object.entries(this.globalArms)) {
        await dbPool.query(
          `INSERT INTO bandit_model_state (user_id, arm_id, a_matrix, b_vector, pulls, total_reward, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())
           ON CONFLICT (user_id, arm_id) DO UPDATE SET
             a_matrix = EXCLUDED.a_matrix,
             b_vector = EXCLUDED.b_vector,
             pulls = EXCLUDED.pulls,
             total_reward = EXCLUDED.total_reward,
             updated_at = NOW()`,
          ['global', armId, JSON.stringify(arm.A), JSON.stringify(arm.b), arm.pullCount, arm.totalReward]
        );
      }
      // Persist user arms
      for (const [userId, userArmSet] of this.userArms.entries()) {
        for (const [armId, arm] of Object.entries(userArmSet)) {
          if (arm.pullCount > 0) {
            await dbPool.query(
              `INSERT INTO bandit_model_state (user_id, arm_id, a_matrix, b_vector, pulls, total_reward, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, NOW())
               ON CONFLICT (user_id, arm_id) DO UPDATE SET
                 a_matrix = EXCLUDED.a_matrix,
                 b_vector = EXCLUDED.b_vector,
                 pulls = EXCLUDED.pulls,
                 total_reward = EXCLUDED.total_reward,
                 updated_at = NOW()`,
              [userId, armId, JSON.stringify(arm.A), JSON.stringify(arm.b), arm.pullCount, arm.totalReward]
            );
          }
        }
      }
      return true;
    } catch (err) {
      console.warn('Bandit DB persistence warning:', err.message);
      return false;
    }
  }

  async loadStateFromDb(userId = 'global', dbPool) {
    if (!dbPool || typeof dbPool.query !== 'function') return false;
    try {
      const res = await dbPool.query(
        'SELECT arm_id, a_matrix, b_vector, pulls, total_reward FROM bandit_model_state WHERE user_id = $1',
        [userId]
      );
      if (res.rows && res.rows.length > 0) {
        const targetArmSet = userId === 'global' ? this.globalArms : (this.userArms.get(userId) || initArmSet());
        for (const row of res.rows) {
          if (targetArmSet[row.arm_id]) {
            targetArmSet[row.arm_id].A = typeof row.a_matrix === 'string' ? JSON.parse(row.a_matrix) : row.a_matrix;
            targetArmSet[row.arm_id].b = typeof row.b_vector === 'string' ? JSON.parse(row.b_vector) : row.b_vector;
            targetArmSet[row.arm_id].pullCount = Number(row.pulls) || 0;
            targetArmSet[row.arm_id].totalReward = Number(row.total_reward) || 0;
          }
        }
        if (userId !== 'global') {
          this.userArms.set(userId, targetArmSet);
        }
        return true;
      }
      return false;
    } catch (err) {
      console.warn('Bandit DB load warning:', err.message);
      return false;
    }
  }

  async recordFeedbackToDb(record, dbPool) {
    if (!dbPool || typeof dbPool.query !== 'function') return false;
    try {
      const id = `FDBK_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await dbPool.query(
        `INSERT INTO recommendation_feedback (id, user_id, recommendation_id, poi_name, arm_id, action, reward, context_vector, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          id,
          record.userId || 'anonymous',
          record.recommendationId || null,
          record.poiName || 'unspecified',
          record.category || 'nature',
          record.action || 'VIEWED',
          record.reward || 0.5,
          JSON.stringify(record.contextVectorSnapshot || [])
        ]
      );
      return true;
    } catch (err) {
      console.warn('Bandit feedback DB record warning:', err.message);
      return false;
    }
  }
}

// Export singleton instance and classes
const contextualBanditInstance = new ContextualBanditEngine();

module.exports = {
  ContextualBanditEngine,
  contextualBandit: contextualBanditInstance,
  BANDIT_ARMS,
  CONTEXT_DIM
};

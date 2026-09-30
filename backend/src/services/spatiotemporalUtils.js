/**
 * SPATIOTEMPORAL MATH & GEOMETRIC PRIMITIVES
 *
 * Fundamental mathematical and geometric functions:
 * - 28-D Dense vector embedding generator & Cosine Similarity
 * - Time-dependent diurnal travel time calculations
 * - Submodular category utility curve & marginal value calculator
 * - Time parsing and formatting utilities
 */

const SEMANTIC_DIMENSIONS = [
  'nature', 'waterfalls', 'mountains', 'viewpoints', 'beaches', 'lakes',
  'rivers', 'heritage', 'forts', 'palaces', 'temples', 'architecture',
  'adventure', 'trekking', 'camping', 'photography', 'food', 'culinary',
  'local_culture', 'shopping', 'relaxation', 'wildlife', 'safari',
  'scenic_roads', 'peaceful', 'spiritual', 'caves', 'historical'
];

/**
 * Generate L2-normalized dense semantic vector from text and tags
 */
function generateSemanticEmbedding(textOrKeywords = '') {
  const text = (Array.isArray(textOrKeywords) ? textOrKeywords.join(' ') : String(textOrKeywords || '')).toLowerCase();
  const vector = new Array(SEMANTIC_DIMENSIONS.length).fill(0.05);

  SEMANTIC_DIMENSIONS.forEach((dim, idx) => {
    const dimWord = dim.replace('_', ' ');
    if (text.includes(dimWord) || text.includes(dim)) {
      vector[idx] += 1.0;
    }

    // Synonym associations
    if (dim === 'nature' && (text.includes('forest') || text.includes('greenery') || text.includes('valley'))) vector[idx] += 0.8;
    if (dim === 'waterfalls' && (text.includes('cascade') || text.includes('falls'))) vector[idx] += 0.9;
    if (dim === 'photography' && (text.includes('viewpoint') || text.includes('sunset') || text.includes('sunrise') || text.includes('vista'))) vector[idx] += 0.85;
    if (dim === 'adventure' && (text.includes('trekking') || text.includes('hiking') || text.includes('climbing') || text.includes('zipline'))) vector[idx] += 0.85;
    if (dim === 'heritage' && (text.includes('monument') || text.includes('ancient') || text.includes('unesco') || text.includes('ruins'))) vector[idx] += 0.85;
    if (dim === 'food' && (text.includes('dining') || text.includes('restaurant') || text.includes('cuisine') || text.includes('dhaba'))) vector[idx] += 0.9;
    if (dim === 'temples' && (text.includes('spiritual') || text.includes('shrine') || text.includes('darshan') || text.includes('pilgrimage'))) vector[idx] += 0.85;
    if (dim === 'relaxation' && (text.includes('peaceful') || text.includes('tranquil') || text.includes('quiet') || text.includes('calm'))) vector[idx] += 0.8;
  });

  // Compute L2 norm
  let sumSq = 0;
  for (let i = 0; i < vector.length; i++) {
    sumSq += vector[i] * vector[i];
  }
  const norm = Math.sqrt(sumSq) || 1.0;

  for (let i = 0; i < vector.length; i++) {
    vector[i] = vector[i] / norm;
  }

  return vector;
}

/**
 * Compute Cosine Similarity between two L2-normalized vectors (Dot product)
 */
function calculateCosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length !== vecB.length) return 0.5;
  let dot = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
  }
  return Math.max(0.0, Math.min(1.0, dot));
}

/**
 * Time-dependent travel time between nodes A and B departing at minute t
 * Models diurnal congestion (Morning peak 08:00-10:30, Evening peak 17:00-19:30)
 */
function calculateTimeDependentTravelTime(distanceKm, departureMinutesFromMidnight, baseSpeedKmph = 65) {
  const normMinutes = Math.max(8, Math.round((distanceKm / baseSpeedKmph) * 60));
  const t = ((departureMinutesFromMidnight % 1440) + 1440) % 1440;

  let congestionMultiplier = 1.0;
  // Morning rush (08:00 - 10:30)
  if (t >= 480 && t <= 630) {
    congestionMultiplier = 1.35;
  }
  // Evening rush (17:00 - 19:30)
  else if (t >= 1020 && t <= 1170) {
    congestionMultiplier = 1.45;
  }
  // Afternoon moderate (12:00 - 16:00)
  else if (t >= 720 && t <= 960) {
    congestionMultiplier = 1.15;
  }
  // Night / early morning flow
  else if (t < 360 || t > 1260) {
    congestionMultiplier = 0.95;
  }

  const travelMinutes = Math.round(normMinutes * congestionMultiplier);
  return {
    travelMinutes,
    congestionMultiplier,
    delayMinutes: Math.max(0, travelMinutes - normMinutes),
    trafficSeverity: congestionMultiplier > 1.3 ? 'HEAVY' : (congestionMultiplier > 1.1 ? 'MODERATE' : 'LIGHT')
  };
}

/**
 * Strictly concave submodular saturation curve for categories
 */
function submodularCategoryUtility(count) {
  if (count <= 0) return 0.0;
  if (count === 1) return 1.0;
  if (count === 2) return 1.45;
  if (count === 3) return 1.60;
  return 1.60 + 0.05 * (count - 3);
}

/**
 * Evaluate total submodular experience utility of a set of places S
 */
function evaluateSubmodularExperienceUtility(selectedPlaces, userEmbedding, categoryWeights = {}) {
  if (!selectedPlaces || selectedPlaces.length === 0) return 0;

  const categoryCounts = {};
  selectedPlaces.forEach(p => {
    const cat = String(p.category || 'attraction').toLowerCase();
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });

  let categoryUtility = 0;
  for (const [cat, count] of Object.entries(categoryCounts)) {
    const weight = categoryWeights[cat] || 1.0;
    categoryUtility += weight * submodularCategoryUtility(count);
  }

  let semanticFit = 0;
  selectedPlaces.forEach(p => {
    if (p.semanticEmbedding) {
      semanticFit += calculateCosineSimilarity(userEmbedding, p.semanticEmbedding);
    } else {
      semanticFit += 0.5;
    }
  });

  const avgSemantic = selectedPlaces.length > 0 ? (semanticFit / selectedPlaces.length) : 0;
  return Math.round((categoryUtility * 0.65 + avgSemantic * 10 * 0.35) * 100) / 100;
}

/**
 * Calculate Marginal Value of adding candidate POI to current itinerary S
 */
function calculateMarginalValue(candidate, currentItinerary, userEmbedding, categoryWeights = {}) {
  const currentVal = evaluateSubmodularExperienceUtility(currentItinerary, userEmbedding, categoryWeights);
  const nextVal = evaluateSubmodularExperienceUtility([...currentItinerary, candidate], userEmbedding, categoryWeights);
  return Math.max(0.01, Math.round((nextVal - currentVal) * 100) / 100);
}

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 540;
  const match = String(timeStr).trim().toUpperCase().match(/(\d+):(\d+)\s*(AM|PM)?/);
  if (!match) return 540;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const meridian = match[3];
  if (meridian === 'PM' && h < 12) h += 12;
  if (meridian === 'AM' && h === 12) h = 0;
  return h * 60 + m;
}

function formatMinutesTo12(totalMinutes) {
  const norm = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  const meridian = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  const displayM = m < 10 ? `0${m}` : `${m}`;
  return `${displayH}:${displayM} ${meridian}`;
}

module.exports = {
  SEMANTIC_DIMENSIONS,
  generateSemanticEmbedding,
  calculateCosineSimilarity,
  calculateTimeDependentTravelTime,
  submodularCategoryUtility,
  evaluateSubmodularExperienceUtility,
  calculateMarginalValue,
  parseTimeToMinutes,
  formatMinutesTo12
};

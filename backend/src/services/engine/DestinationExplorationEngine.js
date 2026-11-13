/**
 * DestinationExplorationEngine
 * 
 * Specialized Module for Phase B: Comprehensive Regional Destination Exploration.
 * 
 * Responsibilities:
 * - Treats destinations as expansive geographical regions rather than single point coordinates.
 * - Discovers multi-category attractions (viewpoints, waterfalls, heritage, temples, nature, adventure, beaches).
 * - Performs geographical clustering to partition attractions into coherent, low-travel daily exploration zones.
 * - Maximizes meaningful, diverse travel experiences without exhaustion or repetitive viewpoints.
 * - Solves the intra-cluster Traveling Salesperson Problem (TSP) using 2-Opt local search to eliminate backtracking.
 */

const { scorePlace } = require('./PlaceScoringEngine');
const { optimizeDayStopSequence } = require('./RouteOptimizationEngine');
const { calculateHaversineDistanceKm } = require('./RouteDiscoveryEngine');

/**
 * Priority ranking of exploration zones based on user's normalized interest profile.
 */
function rankRegionalZones(zones, userInterests) {
  return zones.map(z => {
    let affinity = 0.5;
    if (z.type === 'mountains' || z.type === 'hills') {
      affinity = (userInterests.mountains || 0.5) * 0.4 + (userInterests.scenery || 0.5) * 0.3 + (userInterests.trekking || 0.5) * 0.3;
    } else if (z.type === 'beaches' || z.type === 'coastal') {
      affinity = (userInterests.beaches || 0.5) * 0.6 + (userInterests.water_activities || 0.5) * 0.4;
    } else if (z.type === 'heritage' || z.type === 'historical') {
      affinity = (userInterests.historical || 0.5) * 0.5 + (userInterests.cultural || 0.5) * 0.3 + (userInterests.architecture || 0.5) * 0.2;
    } else if (z.type === 'wildlife' || z.type === 'nature') {
      affinity = (userInterests.nature || 0.5) * 0.5 + (userInterests.wildlife || 0.5) * 0.5;
    } else if (z.type === 'spiritual' || z.type === 'temples') {
      affinity = (userInterests.spiritual || 0.5) * 0.7 + (userInterests.cultural || 0.5) * 0.3;
    } else if (z.type === 'waterfalls') {
      affinity = (userInterests.nature || 0.5) * 0.5 + (userInterests.waterfalls || 0.5) * 0.5;
    }
    return { ...z, affinity };
  }).sort((a, b) => b.affinity - a.affinity);
}

/**
 * Performs spatial road clustering when predefined zones are not available.
 * Partitions places into K spatially proximate clusters using k-means/nearest-neighbor heuristic.
 */
function clusterPlacesSpatially(places, k) {
  if (!places || places.length === 0) return [];
  if (k <= 1 || places.length <= k) {
    return [places];
  }

  // Pick initial K seeds spread out geographically
  const seeds = [places[0]];
  while (seeds.length < k && seeds.length < places.length) {
    let farthestPlace = null;
    let maxMinDist = -1;

    places.forEach(p => {
      if (seeds.includes(p)) return;
      const minDistToSeeds = Math.min(...seeds.map(s => calculateHaversineDistanceKm(p.coordinates, s.coordinates)));
      if (minDistToSeeds > maxMinDist) {
        maxMinDist = minDistToSeeds;
        farthestPlace = p;
      }
    });

    if (farthestPlace) seeds.push(farthestPlace);
    else break;
  }

  // Assign each place to nearest seed
  const clusters = Array.from({ length: seeds.length }, () => []);
  places.forEach(p => {
    let bestSeedIdx = 0;
    let bestDist = 9999;
    seeds.forEach((seed, sIdx) => {
      const dist = calculateHaversineDistanceKm(p.coordinates, seed.coordinates);
      if (dist < bestDist) {
        bestDist = dist;
        bestSeedIdx = sIdx;
      }
    });
    clusters[bestSeedIdx].push(p);
  });

  return clusters.filter(c => c.length > 0);
}

/**
 * Selects 2-4 diverse attractions from a candidate pool to prevent category fatigue.
 * (e.g. 1 Viewpoint/Peak + 1 Waterfall/Nature + 1 Heritage/Culture + 1 Sunset/Lake).
 */
function selectDiverseAttractions(candidatePool, maxStops = 3) {
  if (!candidatePool || candidatePool.length === 0) return [];

  const selected = [];
  const usedCategories = new Set();
  let totalMinutes = 0;

  // If a major mountain trek or 3+ hour excursion exists, limit day to 3 stops max
  const hasLongExcursion = candidatePool.some(p => (p.estimatedVisitDurationMinutes || 60) >= 180);
  const effectiveMaxStops = hasLongExcursion ? Math.min(3, maxStops) : maxStops;

  // First pass: select top place from each distinct category
  for (const place of candidatePool) {
    if (selected.length >= effectiveMaxStops) break;
    const dur = place.estimatedVisitDurationMinutes || 60;
    if (totalMinutes + dur > 320 && selected.length >= 2) break;

    const cat = place.category || 'sightseeing';
    if (!usedCategories.has(cat)) {
      selected.push(place);
      usedCategories.add(cat);
      totalMinutes += dur;
    }
  }

  // Second pass: fill remaining slots with highest scoring places
  if (selected.length < effectiveMaxStops) {
    for (const place of candidatePool) {
      if (selected.length >= effectiveMaxStops) break;
      const dur = place.estimatedVisitDurationMinutes || 60;
      if (totalMinutes + dur > 320 && selected.length >= 2) break;

      if (!selected.some(s => s.placeId === place.placeId)) {
        selected.push(place);
        totalMinutes += dur;
      }
    }
  }

  // Ensure daylight outdoor safety: high-effort mountain treks are prioritized early in the day
  return selected.sort((a, b) => {
    const isTrekA = String(a.category).includes('trek') || (a.subCategories || []).some(s => s.includes('trek'));
    const isTrekB = String(b.category).includes('trek') || (b.subCategories || []).some(s => s.includes('trek'));
    if (isTrekA && !isTrekB) return -1;
    if (!isTrekA && isTrekB) return 1;
    return 0;
  });
}

function calculateZoneAffinity(zoneKey = '', userInterests = {}) {
  const zk = String(zoneKey || '').toLowerCase();
  let affinity = 0.2;

  if (zk.includes('temple') || zk.includes('spiritual') || zk.includes('darshan')) {
    affinity = (userInterests.spiritual || 0.1) * 0.7 + (userInterests.historical || 0.1) * 0.3;
  } else if (zk.includes('beach') || zk.includes('coastal') || zk.includes('cliff')) {
    affinity = (userInterests.beaches || 0.1) * 0.6 + (userInterests.relaxation || 0.1) * 0.4;
  } else if (zk.includes('peak') || zk.includes('trek') || zk.includes('highland') || zk.includes('mountain')) {
    affinity = (userInterests.trekking || 0.1) * 0.4 + (userInterests.adventure || 0.1) * 0.3 + (userInterests.mountains || 0.1) * 0.3;
  } else if (zk.includes('safari') || zk.includes('wildlife') || zk.includes('wilderness') || zk.includes('rapid')) {
    affinity = (userInterests.wildlife || 0.1) * 0.4 + (userInterests.adventure || 0.1) * 0.3 + (userInterests.waterfalls || 0.1) * 0.3;
  } else if (zk.includes('backwater') || zk.includes('lagoon') || zk.includes('canal') || zk.includes('sunset')) {
    affinity = (userInterests.relaxation || 0.1) * 0.5 + (userInterests.beaches || 0.1) * 0.3 + (userInterests.photography || 0.1) * 0.2;
  }

  return affinity;
}

/**
 * Plans the complete multi-day destination exploration region.
 * 
 * @param {Object} params
 * @param {string} params.destination - Destination name / region string
 * @param {number} params.destinationDays - Number of days available for destination exploration
 * @param {Object} params.userProfile - Normalized user profile and preferences
 * @param {Array} params.candidatePlaces - Raw pool of candidate places
 * @param {Object} params.destinationCoordinates - Center coordinates of destination
 * @returns {Array} Array of daily exploration plans
 */
function planDestinationExploration({
  destination,
  destinationDays = 3,
  userProfile,
  candidatePlaces = [],
  destinationCoordinates
}) {
  const destClean = String(destination || userProfile.destinationCity || '').toLowerCase().trim();
  const safeDays = Math.max(1, destinationDays);

  // 1. Filter candidate places belonging to the destination exploration region
  // Uses multi-level matching: city, region, state, or geographic radius proximity (<=85 km)
  const destCandidates = candidatePlaces.filter(p => {
    if (!p || !p.coordinates) return false;
    const pc = (p.city || '').toLowerCase();
    const pr = (p.region || '').toLowerCase();
    const ps = (p.state || '').toLowerCase();

    // Interstate corridor transit stops should not be treated as destination attractions
    if (pr.startsWith('corridor_') && !pc.includes(destClean) && !destClean.includes(pc)) {
      return false;
    }

    // Check textual match
    if (pc.includes(destClean) || destClean.includes(pc) || pr.includes(destClean) || destClean.includes(pr)) {
      return true;
    }

    // Check known aliases
    if (destClean.includes('kerala') && (pr === 'kerala' || ps === 'kerala')) return true;
    if (destClean.includes('munnar') && (pc === 'munnar' || pr === 'munnar')) return true;
    if (destClean.includes('goa') && (pc.includes('goa') || pr === 'goa' || ps === 'goa')) return true;
    if (destClean.includes('hampi') && (pc.includes('hampi') || pr === 'hampi' || pc === 'anegundi' || pc === 'hospet')) return true;
    if (destClean.includes('araku') && (pc.includes('araku') || pr === 'araku' || pc === 'borra' || pc.includes('visakhapatnam') || pc.includes('vizag'))) return true;
    if (destClean.includes('srisailam') && (pc.includes('srisailam') || pr === 'srisailam' || pc === 'mannanur' || pc === 'dindi')) return true;
    if (destClean.includes('tirupati') && (pc.includes('tirupati') || pr === 'tirupati')) return true;
    if ((destClean.includes('kanniyakumari') || destClean.includes('kanyakumari')) &&
        (pc.includes('kanniyakumari') || pc.includes('kanyakumari') || pc.includes('thuckalay') || pc.includes('padmanabhapuram') || pc.includes('thirparappu') || pc.includes('nagercoil') || pc.includes('vattakottai') || pr === 'kanniyakumari' || pr === 'kanyakumari')) return true;

    // Check geographic distance to destination coordinates
    if (destinationCoordinates && Number.isFinite(destinationCoordinates.lat) && Number.isFinite(destinationCoordinates.lng)) {
      const dist = calculateHaversineDistanceKm(p.coordinates, destinationCoordinates);
      const maxRadius = destClean.includes('kerala') ? 100 : ((destClean.includes('kanniyakumari') || destClean.includes('kanyakumari')) ? 65 : 45);
      if (dist <= maxRadius) return true;
    }

    return false;
  });

  // 2. Score candidate places using multi-factor PlaceScoringEngine
  const scoredPlaces = destCandidates.map(p => ({
    ...p,
    scoring: scorePlace(p, {
      normalizedInterests: userProfile.normalizedInterests,
      companionType: userProfile.travelCompanionType,
      remainingBudget: userProfile.totalBudget,
      distanceFromRouteKm: 5,
      isDestination: true
    })
  })).filter(p => p.scoring.isAccepted)
    .sort((a, b) => b.scoring.finalScore - a.scoring.finalScore);

  // 3. Partition into daily exploration clusters
  // Check if places have predefined exploration zones
  const zonesMap = new Map();
  scoredPlaces.forEach(p => {
    const zKey = p.zone || 'general_exploration';
    if (!zonesMap.has(zKey)) zonesMap.set(zKey, []);
    zonesMap.get(zKey).push(p);
  });

  let dailyClusters = [];

  if (zonesMap.size >= 1) {
    // Sort zones by composite score: place quality, average affinity, and thematic relevance
    const sortedZones = Array.from(zonesMap.entries()).sort((a, b) => {
      if (a[0] === 'general_exploration' && b[0] !== 'general_exploration') return 1;
      if (b[0] === 'general_exploration' && a[0] !== 'general_exploration') return -1;
      const maxScoreA = Math.max(...a[1].map(x => x.scoring.finalScore));
      const maxScoreB = Math.max(...b[1].map(x => x.scoring.finalScore));
      const avgA = a[1].reduce((sum, x) => sum + x.scoring.finalScore, 0) / a[1].length;
      const avgB = b[1].reduce((sum, x) => sum + x.scoring.finalScore, 0) / b[1].length;
      const affA = calculateZoneAffinity(a[0], userProfile.normalizedInterests);
      const affB = calculateZoneAffinity(b[0], userProfile.normalizedInterests);

      const compositeA = maxScoreA * 0.40 + avgA * 0.30 + affA * 0.30;
      const compositeB = maxScoreB * 0.40 + avgB * 0.30 + affB * 0.30;
      return compositeB - compositeA;
    });

    for (let i = 0; i < safeDays; i++) {
      const zoneEntry = sortedZones[i % sortedZones.length];
      const zoneStops = selectDiverseAttractions(zoneEntry[1], 4);
      dailyClusters.push({
        zoneName: formatZoneLabel(zoneEntry[0]),
        stops: zoneStops,
        hubName: zoneStops[0]?.city || userProfile.destinationCity,
        hubCoord: zoneStops[0]?.coordinates || destinationCoordinates
      });
    }
  } else {
    // Use spatial road clustering to partition available scored places
    const spatialGroups = clusterPlacesSpatially(scoredPlaces, safeDays);

    for (let i = 0; i < safeDays; i++) {
      const group = spatialGroups[i % spatialGroups.length] || scoredPlaces;
      const dayStops = selectDiverseAttractions(group, 4);
      dailyClusters.push({
        zoneName: `${userProfile.destinationCity} Highlights Zone ${i + 1}`,
        stops: dayStops,
        hubName: dayStops[0]?.city || userProfile.destinationCity,
        hubCoord: dayStops[0]?.coordinates || destinationCoordinates
      });
    }
  }

  // 4. Solve 2-Opt TSP for each day's cluster to eliminate backtracking
  dailyClusters = dailyClusters.map((cluster, cIdx) => {
    const startCoord = cluster.hubCoord;
    const optimized = optimizeDayStopSequence(startCoord, startCoord, cluster.stops, false);
    return {
      ...cluster,
      dayIndex: cIdx,
      stops: optimized
    };
  });

  return dailyClusters;
}

function formatZoneLabel(zoneKey) {
  const labels = {
    central_kerala_temple_circuit: 'Central Kerala Ancient Temple & Spiritual Circuit',
    highland_peaks_and_treks: 'Munnar Highland Peaks, Rhododendron Ridges & Tea Valleys',
    coastal_beaches_and_cliffs: 'Arabian Sea Coastal Cliffs, Golden Beaches & Seaside Promenades',
    backwater_lagoons_and_sunsets: 'Vembanad Backwater Lagoons, Houseboat Canals & Spice Harbors',
    wilderness_safari_and_rapids: 'Periyar & Western Ghats Wilderness, Rainforest Cascades & Bamboo Rafting',
    munnar_highlands: 'Munnar Tea Highlands & Western Ghats Panoramic Ridges',
    thekkady_wildlife: 'Thekkady Periyar Wildlife Sanctuary & Spice Valleys',
    central_waterfalls: 'Athirappilly Rain Forest Waterfalls & Cultural Enclaves',
    alleppey_backwaters: 'Alleppey Scenic Backwaters & Coastal Lagoons',
    north_goa_coastal: 'North Goa Historic Forts & Scenic Coastal Promenades',
    old_goa_panaji: 'Old Goa UNESCO Baroque Heritage & Panaji Latin Quarters',
    south_goa_serenity: 'South Goa Pristine Crescent Bays & Coastal Cliffs',
    western_ghats_nature: 'Western Ghats Waterfalls, Spice Plantations & Deep Jungle',
    sacred_center: 'Hampi Sacred Center, Tungabhadra River & Monoliths',
    royal_center: 'Hampi Royal Enclosure, Stone Chariot & Ancient Palaces',
    anegundi_kishkindha: 'Anegundi Kishkindha, Hanuman Birthplace & Coracle Lakes',
    caves_cascades: 'Borra Million-Year Caves & Forest Water Cascades',
    valley_highlands: 'Araku Valley Highlands, Tribal Culture & Coffee Estates',
    coastal_corridor: 'Visakhapatnam Blue Flag Beaches, Simhachalam & Submarine Heritage',
    sacred_jyotirlinga: 'Srisailam Ancient Jyotirlinga, Temple Prakaram Walls & Sacred Ghats',
    dam_gorge_reservoir: 'Srisailam Dam Crest, Krishna River Gorge & Panoramic Viewpoints',
    forest_caves_springs: 'Akkamahadevi Forest Caves, Mountain Springs & Amrabad Tiger Reserve',
    tirumala_hills: 'Tirumala Sacred Hills, Natural Arch & Spiritual Vistas',
    foothills_sacred: 'Tirupati Sacred Waterfalls, Foothill Shrines & Ancient Heritage',
    heritage_waterfalls: 'Chandragiri Historic Fort & Talakona National Park Waterfalls',
    valley_culture: 'Manali Pine Forest Shrines & Alpine Waterfalls',
    snow_adventure: 'Solang Valley Snow Ridges & Western Himalayan Adventures'
  };
  return labels[zoneKey] || zoneKey.replace(/_/g, ' ').toUpperCase();
}

module.exports = {
  planDestinationExploration,
  formatZoneLabel,
  clusterPlacesSpatially,
  selectDiverseAttractions,
  rankRegionalZones,
  GeographicClusteringEngine: {
    planDestinationExploration,
    clusterPlacesSpatially,
    selectDiverseAttractions,
    rankRegionalZones
  }
};


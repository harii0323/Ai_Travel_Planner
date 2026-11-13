/**
 * RoadRoutingProvider — Authoritative Routing Provider Abstraction
 * 
 * Implements the 4-Tier Routing Hierarchy:
 * Tier 1: Real routing provider (Configured Google Routes / Directions API)
 * Tier 2: Open-road routing provider (Configured OSRM / GraphHopper)
 * Tier 3: Limited highway graph (RoadNetworkGraphEngine - clearly identified as limited graph)
 * Tier 4: Geographic estimate (Haversine projection - clearly marked as estimated, never live_verified)
 */

const axios = require('axios');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const {
  highwayRoadGraph,
  haversineDistanceKm
} = require('./RoadNetworkGraphEngine');

const GOOGLE_MAPS_API_KEY = () => process.env.GOOGLE_MAPS_API_KEY || '';
const OSRM_ROUTER_URL = () => process.env.OSRM_ROUTER_URL || '';

// Known Geographic Center Coordinates for Indian Hubs, Destinations & Corridors
const KNOWN_CITY_COORDINATES = {
  hyderabad: { lat: 17.3850, lng: 78.4867, state: 'Telangana' },
  munnar: { lat: 10.0889, lng: 77.0595, state: 'Kerala' },
  kochi: { lat: 9.9312, lng: 76.2673, state: 'Kerala' },
  cochin: { lat: 9.9312, lng: 76.2673, state: 'Kerala' },
  bangalore: { lat: 12.9716, lng: 77.5946, state: 'Karnataka' },
  bengaluru: { lat: 12.9716, lng: 77.5946, state: 'Karnataka' },
  chennai: { lat: 13.0827, lng: 80.2707, state: 'Tamil Nadu' },
  delhi: { lat: 28.6139, lng: 77.2090, state: 'Delhi' },
  mumbai: { lat: 19.0760, lng: 72.8777, state: 'Maharashtra' },
  pune: { lat: 18.5204, lng: 73.8567, state: 'Maharashtra' },
  goa: { lat: 15.4909, lng: 73.8278, state: 'Goa' },
  panaji: { lat: 15.4909, lng: 73.8278, state: 'Goa' },
  hampi: { lat: 15.3350, lng: 76.4600, state: 'Karnataka' },
  srisailam: { lat: 16.0740, lng: 78.8680, state: 'Andhra Pradesh' },
  tirupati: { lat: 13.6288, lng: 79.4192, state: 'Andhra Pradesh' },
  visakhapatnam: { lat: 17.6868, lng: 83.2185, state: 'Andhra Pradesh' },
  vizag: { lat: 17.6868, lng: 83.2185, state: 'Andhra Pradesh' },
  vijayawada: { lat: 16.5062, lng: 80.6480, state: 'Andhra Pradesh' },
  araku: { lat: 18.3273, lng: 82.8775, state: 'Andhra Pradesh' },
  manali: { lat: 32.2396, lng: 77.1887, state: 'Himachal Pradesh' },
  shimla: { lat: 31.1048, lng: 77.1734, state: 'Himachal Pradesh' },
  ooty: { lat: 11.4102, lng: 76.6950, state: 'Tamil Nadu' },
  kodaikanal: { lat: 10.2381, lng: 77.4892, state: 'Tamil Nadu' },
  jaipur: { lat: 26.9124, lng: 75.7873, state: 'Rajasthan' },
  agra: { lat: 27.1767, lng: 78.0081, state: 'Uttar Pradesh' },
  varanasi: { lat: 25.3176, lng: 82.9739, state: 'Uttar Pradesh' },
  kolkata: { lat: 22.5726, lng: 88.3639, state: 'West Bengal' },
  kanyakumari: { lat: 8.0883, lng: 77.5385, state: 'Tamil Nadu' },
  kanniyakumari: { lat: 8.0883, lng: 77.5385, state: 'Tamil Nadu' },
  madurai: { lat: 9.9252, lng: 78.1198, state: 'Tamil Nadu' },
  mysore: { lat: 12.2958, lng: 76.6394, state: 'Karnataka' },
  mysuru: { lat: 12.2958, lng: 76.6394, state: 'Karnataka' },
  coimbatore: { lat: 11.0168, lng: 76.9558, state: 'Tamil Nadu' },
  wayanad: { lat: 11.6854, lng: 76.1320, state: 'Kerala' },
  alleppey: { lat: 9.4981, lng: 76.3388, state: 'Kerala' },
  alappuzha: { lat: 9.4981, lng: 76.3388, state: 'Kerala' },
  thekkady: { lat: 9.6031, lng: 77.1615, state: 'Kerala' },
  pondicherry: { lat: 11.9416, lng: 79.8083, state: 'Puducherry' },
  puducherry: { lat: 11.9416, lng: 79.8083, state: 'Puducherry' },
  kurnool: { lat: 15.8281, lng: 78.0373, state: 'Andhra Pradesh' },
  anantapur: { lat: 14.6819, lng: 77.6006, state: 'Andhra Pradesh' },
  salem: { lat: 11.6643, lng: 78.1460, state: 'Tamil Nadu' },
  dindigul: { lat: 10.3673, lng: 77.9803, state: 'Tamil Nadu' },
  hubli: { lat: 15.3647, lng: 75.1240, state: 'Karnataka' },
  belgaum: { lat: 15.8497, lng: 74.4977, state: 'Karnataka' },
  kolhapur: { lat: 16.7050, lng: 74.2433, state: 'Maharashtra' }
};

// In-memory route cache (30-minute TTL)
const routeCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000;

class RoadRoutingProvider {
  constructor() {
    this.name = 'RoadRoutingProvider';
    this.version = '3.0.0';
  }

  /**
   * Resolve an input location into clean name and verified coordinates
   */
  normalizeLocation(loc) {
    if (!loc) return null;
    let name = '';
    let lat = null;
    let lng = null;

    if (typeof loc === 'string') {
      const parts = loc.split(',');
      if (parts.length === 2 && !isNaN(Number(parts[0])) && !isNaN(Number(parts[1]))) {
        return { lat: parseFloat(parts[0]), lng: parseFloat(parts[1]), name: loc };
      }
      name = loc.trim();
    } else {
      name = loc.name || loc.city || loc.placeName || loc.formattedAddress || '';
      lat = loc.lat !== undefined ? Number(loc.lat) : (loc.latitude !== undefined ? Number(loc.latitude) : null);
      lng = loc.lng !== undefined ? Number(loc.lng) : (loc.longitude !== undefined ? Number(loc.longitude) : null);
      if (loc.coordinates) {
        if (lat === null && loc.coordinates.lat !== undefined) lat = Number(loc.coordinates.lat);
        if (lng === null && loc.coordinates.lng !== undefined) lng = Number(loc.coordinates.lng);
      }
    }

    // If coordinates already present and valid, return immediately
    if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0)) {
      return { name: name || `${lat.toFixed(4)},${lng.toFixed(4)}`, lat, lng };
    }

    // Resolve by known Indian cities/destinations registry
    const cleanName = name.split(',')[0].toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    for (const [key, coords] of Object.entries(KNOWN_CITY_COORDINATES)) {
      if (cleanName === key || cleanName.includes(key) || key.includes(cleanName)) {
        return { name, lat: coords.lat, lng: coords.lng };
      }
    }

    // Check highway graph nodes
    const nodeKey = highwayRoadGraph.resolveNodeKey(name);
    if (nodeKey) {
      const node = highwayRoadGraph.getNode(nodeKey);
      if (node && node.lat && node.lng) {
        return { name, lat: node.lat, lng: node.lng };
      }
    }

    return {
      name: name || 'Unknown Location',
      lat: null,
      lng: null
    };
  }

  /**
   * Primary route solver implementing Tier 1 -> Tier 2 -> Tier 3 -> Tier 4
   */
  async getRoute(origin, destination, options = {}) {
    const orig = this.normalizeLocation(origin);
    const dest = this.normalizeLocation(destination);
    if (!orig || !dest) {
      throw new Error('RoadRoutingProvider: Invalid origin or destination coordinates/names.');
    }

    const departureMinutes = options.departureMinutes !== undefined ? options.departureMinutes : 480; // 08:00 AM
    const transportMode = options.transportMode || 'car';
    const objective = options.objective || 'time';

    const origKey = orig.lat !== null && orig.lng !== null ? `${orig.lat.toFixed(4)},${orig.lng.toFixed(4)}` : orig.name.toLowerCase();
    const destKey = dest.lat !== null && dest.lng !== null ? `${dest.lat.toFixed(4)},${dest.lng.toFixed(4)}` : dest.name.toLowerCase();
    const cacheKey = `${origKey}_to_${destKey}_${transportMode}_${Math.floor(departureMinutes / 60)}_${objective}`;

    if (routeCache.has(cacheKey)) {
      const cached = routeCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return { ...cached.data, isFromCache: true };
      }
    }

    // =========================================================================
    // TIER 1: REAL ROUTING PROVIDER (Google Routes / Directions API)
    // =========================================================================
    const apiKey = GOOGLE_MAPS_API_KEY();
    if (apiKey && orig.lat !== null && orig.lng !== null && dest.lat !== null && dest.lng !== null) {
      try {
        const resp = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
          params: {
            origin: `${orig.lat},${orig.lng}`,
            destination: `${dest.lat},${dest.lng}`,
            mode: transportMode === 'bus' || transportMode === 'train' ? 'transit' : 'driving',
            departure_time: 'now',
            key: apiKey
          },
          timeout: 4500
        });

        if (resp.data?.status === 'OK' && resp.data.routes?.[0]?.legs?.[0]) {
          const leg = resp.data.routes[0].legs[0];
          const distKm = Math.round((leg.distance?.value || 0) / 1000);
          const hasTraffic = Boolean(leg.duration_in_traffic);
          const durMin = Math.round((leg.duration_in_traffic?.value || leg.duration?.value || 0) / 60);

          const result = {
            origin: orig,
            destination: dest,
            distanceKm: distKm,
            totalDistanceKm: distKm,
            durationMinutes: durMin,
            totalDurationMinutes: durMin,
            formattedDuration: `${Math.floor(durMin / 60)}h ${durMin % 60}m`,
            tier: 'Tier 1 (Real Routing Provider)',
            dataSource: 'google_directions_api',
            dataStatus: hasTraffic ? 'live_verified' : 'provider_retrieved',
            isLiveVerified: hasTraffic,
            isLimitedGraph: false,
            isEstimate: false,
            polyline: resp.data.routes[0].overview_polyline?.points || null,
            trafficSummary: hasTraffic ? 'Live Google Traffic Monitored' : 'Standard Provider Duration (Static Flow)',
            timestamp: new Date().toISOString()
          };

          routeCache.set(cacheKey, { timestamp: Date.now(), data: result });
          return result;
        }
      } catch (err) {
        // Fall through to Tier 2
      }
    }

    // =========================================================================
    // TIER 2: CONFIGURED OPEN-ROAD ROUTING ENGINE (OSRM / GraphHopper)
    // =========================================================================
    const osrmUrl = OSRM_ROUTER_URL();
    if (osrmUrl && orig.lat !== null && orig.lng !== null && dest.lat !== null && dest.lng !== null) {
      try {
        const url = `${osrmUrl}/route/v1/driving/${orig.lng},${orig.lat};${dest.lng},${dest.lat}?overview=false`;
        const resp = await axios.get(url, { timeout: 3500 });
        if (resp.data?.code === 'Ok' && resp.data.routes?.[0]) {
          const r = resp.data.routes[0];
          const distKm = Math.round((r.distance || 0) / 1000);
          const durMin = Math.round((r.duration || 0) / 60);

          const result = {
            origin: orig,
            destination: dest,
            distanceKm: distKm,
            totalDistanceKm: distKm,
            durationMinutes: durMin,
            totalDurationMinutes: durMin,
            formattedDuration: `${Math.floor(durMin / 60)}h ${durMin % 60}m`,
            tier: 'Tier 2 (Open Road Routing Engine)',
            dataSource: 'osrm_open_road_router',
            dataStatus: 'provider_retrieved',
            isLiveVerified: false, // OSRM has no live traffic
            isLimitedGraph: false,
            isEstimate: false,
            trafficSummary: 'Open-Road Network Distance Model (Static Speed Curves)',
            timestamp: new Date().toISOString()
          };

          routeCache.set(cacheKey, { timestamp: Date.now(), data: result });
          return result;
        }
      } catch (err) {
        // Fall through to Tier 3
      }
    }

    // =========================================================================
    // TIER 3: LIMITED HIGHWAY GRAPH (RoadNetworkGraphEngine)
    // Disclosed clearly as a limited graph path, NOT a full national map
    // =========================================================================
    const origNodeKey = highwayRoadGraph.resolveNodeKey(orig.name);
    const destNodeKey = highwayRoadGraph.resolveNodeKey(dest.name);

    if (origNodeKey && destNodeKey && origNodeKey !== destNodeKey) {
      const graphRoute = objective === 'distance'
        ? highwayRoadGraph.findShortestPathDijkstra(origNodeKey, destNodeKey, 'distance', departureMinutes)
        : highwayRoadGraph.findShortestPathAStar(origNodeKey, destNodeKey, 'time', departureMinutes);

      if (graphRoute && graphRoute.found && graphRoute.totalDistanceKm > 0) {
        const result = {
          origin: orig,
          destination: dest,
          distanceKm: graphRoute.totalDistanceKm,
          totalDistanceKm: graphRoute.totalDistanceKm,
          durationMinutes: graphRoute.durationMinutes || graphRoute.totalDurationMinutes,
          totalDurationMinutes: graphRoute.durationMinutes || graphRoute.totalDurationMinutes,
          formattedDuration: `${Math.floor((graphRoute.durationMinutes || graphRoute.totalDurationMinutes) / 60)}h ${(graphRoute.durationMinutes || graphRoute.totalDurationMinutes) % 60}m`,
          totalTolls: graphRoute.totalTolls || 0,
          waypoints: graphRoute.waypoints || [],
          pathNodes: graphRoute.path,
          tier: 'Tier 3 (Limited Highway Corridor Graph)',
          dataSource: 'limited_highway_corridor_graph',
          dataStatus: 'graph_modeled',
          isLiveVerified: false,
          isLimitedGraph: true,
          isEstimate: false,
          routingLimitation: 'Calculated along known 25-node national highway backbone; local town streets are approximated.',
          trafficSummary: 'Diurnal Highway Traffic Model',
          timestamp: new Date().toISOString()
        };

        routeCache.set(cacheKey, { timestamp: Date.now(), data: result });
        return result;
      }
    }

    // =========================================================================
    // TIER 4: GEOGRAPHIC ESTIMATE (Haversine Projection Approximation)
    // Explicitly marked as estimated, NEVER claimed as live_verified
    // =========================================================================
    let directKm = 50;
    if (orig.lat !== null && orig.lng !== null && dest.lat !== null && dest.lng !== null) {
      directKm = haversineDistanceKm(orig, dest);
    } else {
      directKm = 100; // Baseline default when coordinates absent
    }

    // Winding road factor (1.25 for plains, 1.35 for ghat/hilly terrain)
    const roadKm = Math.max(5, Math.round(directKm * 1.28));
    // Average speed model (55 km/h mixed road speed)
    let avgSpeedKmh = 55;
    if (transportMode === 'bike') avgSpeedKmh = 45;
    else if (transportMode === 'bus') avgSpeedKmh = 40;

    // Time-dependent rush hour dilation
    const t = ((departureMinutes % 1440) + 1440) % 1440;
    let trafficMultiplier = 1.0;
    if ((t >= 480 && t <= 630) || (t >= 1020 && t <= 1170)) trafficMultiplier = 1.20;

    const estMinutes = Math.max(10, Math.round((roadKm / avgSpeedKmh) * 60 * trafficMultiplier));

    const result = {
      origin: orig,
      destination: dest,
      distanceKm: roadKm,
      totalDistanceKm: roadKm,
      durationMinutes: estMinutes,
      totalDurationMinutes: estMinutes,
      formattedDuration: `${Math.floor(estMinutes / 60)}h ${estMinutes % 60}m`,
      directDistanceKm: Math.round(directKm),
      tier: 'Tier 4 (Geodesic Projection Fallback)',
      dataSource: 'geodesic_haversine_projection_model',
      dataStatus: 'estimated',
      isLiveVerified: false,
      isLimitedGraph: false,
      isEstimate: true,
      routingLimitation: orig.lat === null || dest.lat === null
        ? 'Coordinates unavailable for one or both endpoints; distance and duration are modeled estimates.'
        : 'No live provider or highway graph route available; distance and duration are modeled estimates.',
      trafficSummary: trafficMultiplier > 1.0 ? 'Rush Hour Modeled (+20% delay)' : 'Standard Flow Estimate',
      timestamp: new Date().toISOString()
    };

    routeCache.set(cacheKey, { timestamp: Date.now(), data: result });
    return result;
  }

  /**
   * Returns point-to-point road travel duration in minutes
   */
  async getTravelTime(origin, destination, departureTime = 480) {
    const route = await this.getRoute(origin, destination, { departureMinutes: departureTime });
    return route.durationMinutes;
  }

  /**
   * Returns point-to-point road distance in kilometers
   */
  async getDistance(origin, destination) {
    const route = await this.getRoute(origin, destination);
    return route.distanceKm;
  }

  /**
   * Pre-computes an N x N pairwise distance & duration transition matrix.
   * Essential for 2-Opt and 3-Opt to avoid repetitive API requests.
   */
  async getRouteMatrix(locations = [], options = {}) {
    if (!Array.isArray(locations) || locations.length === 0) {
      return { matrix: [], distances: [], durations: [], locations: [], size: 0 };
    }

    const n = locations.length;
    const normLocations = locations.map(l => this.normalizeLocation(l));
    const matrix = Array.from({ length: n }, () => Array.from({ length: n }, () => null));

    // Fill diagonal (exact zero self-distance)
    for (let i = 0; i < n; i++) {
      matrix[i][i] = {
        distanceKm: 0,
        totalDistanceKm: 0,
        durationMinutes: 0,
        totalDurationMinutes: 0,
        isLiveVerified: true,
        dataStatus: 'exact_zero',
        dataSource: 'self_transition',
        trafficSummary: 'No transit required (self)',
        retrievalTimestamp: new Date().toISOString()
      };
    }

    // Memoize pairs across identical names/coords
    const pairCache = new Map();

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const fromLoc = normLocations[i];
        const toLoc = normLocations[j];

        const pairKey = `${fromLoc.name}_${fromLoc.lat}_${fromLoc.lng}-->${toLoc.name}_${toLoc.lat}_${toLoc.lng}`;
        if (pairCache.has(pairKey)) {
          matrix[i][j] = { ...pairCache.get(pairKey) };
          continue;
        }

        try {
          const res = await this.getRoute(fromLoc, toLoc, options);
          const cell = {
            distanceKm: res.distanceKm,
            totalDistanceKm: res.distanceKm,
            durationMinutes: res.durationMinutes,
            totalDurationMinutes: res.durationMinutes,
            isLiveVerified: Boolean(res.isLiveVerified),
            dataStatus: res.dataStatus || 'estimated',
            dataSource: res.dataSource || 'geodesic_haversine_projection_model',
            trafficSummary: res.trafficSummary || 'Modeled Flow Estimate',
            retrievalTimestamp: new Date().toISOString()
          };
          matrix[i][j] = cell;
          pairCache.set(pairKey, cell);
        } catch (pairErr) {
          // Never substitute zero on failure! Compute transparent Tier 4 fallback
          let estDirect = 50;
          if (fromLoc.lat !== null && toLoc.lat !== null) {
            estDirect = haversineDistanceKm(fromLoc, toLoc);
          }
          const estRoadKm = Math.max(5, Math.round(estDirect * 1.28));
          const estMins = Math.max(10, Math.round((estRoadKm / 55) * 60));

          const fallbackCell = {
            distanceKm: estRoadKm,
            totalDistanceKm: estRoadKm,
            durationMinutes: estMins,
            totalDurationMinutes: estMins,
            isLiveVerified: false,
            dataStatus: 'estimated',
            dataSource: 'geodesic_haversine_projection_model',
            trafficSummary: 'Pair routing fallback estimate',
            retrievalTimestamp: new Date().toISOString()
          };
          matrix[i][j] = fallbackCell;
          pairCache.set(pairKey, fallbackCell);
        }
      }
    }

    // Numerical 2D arrays for quick algorithmic lookups
    const distances = matrix.map(row => row.map(cell => cell ? cell.distanceKm : 0));
    const durations = matrix.map(row => row.map(cell => cell ? cell.durationMinutes : 0));

    // Calculate matrix provenance summary
    const usedSources = new Set();
    matrix.forEach(row => row.forEach(cell => {
      if (cell && cell.dataSource) usedSources.add(cell.dataSource);
    }));

    return {
      size: n,
      locations: normLocations,
      matrix,
      distances,
      durations,
      dataProvenance: {
        sources: Array.from(usedSources),
        pairCount: n * (n - 1),
        isAllEstimated: !Array.from(usedSources).some(s => s === 'google_directions_api' || s === 'osrm_open_road_router' || s === 'limited_highway_corridor_graph')
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generates distinct alternative return corridors based on highway classifications
   */
  async getAlternativeRoutes(origin, destination, options = {}) {
    const { generateAlternativeReturnRoutes } = require('./routeDiversityEngine');
    const primary = await this.getRoute(destination, origin, options);

    return generateAlternativeReturnRoutes({
      origin: typeof destination === 'string' ? destination : (destination.name || destination.city),
      destination: typeof origin === 'string' ? origin : (origin.name || origin.city),
      baseDistance: primary.distanceKm,
      baseDurationMinutes: primary.durationMinutes,
      transportMode: options.transportMode || 'car',
      numTravelers: options.numTravelers || 1
    });
  }

  /**
   * Returns data provenance metadata for transparency
   */
  getDataProvenance() {
    const apiKey = GOOGLE_MAPS_API_KEY();
    const osrmUrl = OSRM_ROUTER_URL();
    return {
      provider: apiKey ? 'google_routes_api' : (osrmUrl ? 'osrm_open_road_router' : 'road_network_graph_engine'),
      activeTier: apiKey ? 1 : (osrmUrl ? 2 : 3),
      isLiveConfigured: Boolean(apiKey || osrmUrl),
      hasHighwayGraph: true,
      hasGeodesicFallback: true,
      cacheEntries: routeCache.size
    };
  }

  /**
   * Check whether a specific point-to-point query is live verified
   */
  async isRouteVerified(origin, destination) {
    const route = await this.getRoute(origin, destination);
    return route.isLiveVerified === true;
  }
}

const roadRoutingProviderInstance = new RoadRoutingProvider();

module.exports = {
  RoadRoutingProvider,
  roadRoutingProvider: roadRoutingProviderInstance
};


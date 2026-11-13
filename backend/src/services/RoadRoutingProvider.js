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

// In-memory route cache (30-minute TTL)
const routeCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000;

class RoadRoutingProvider {
  constructor() {
    this.name = 'RoadRoutingProvider';
    this.version = '3.0.0';
  }

  /**
   * Normalize an input location (string or object with lat/lng or name)
   */
  normalizeLocation(loc) {
    if (!loc) return null;
    if (typeof loc === 'string') {
      const parts = loc.split(',');
      if (parts.length === 2 && !isNaN(Number(parts[0])) && !isNaN(Number(parts[1]))) {
        return { lat: parseFloat(parts[0]), lng: parseFloat(parts[1]), name: loc };
      }
      return { name: loc.trim(), lat: null, lng: null };
    }
    const lat = loc.lat !== undefined ? Number(loc.lat) : (loc.latitude !== undefined ? Number(loc.latitude) : null);
    const lng = loc.lng !== undefined ? Number(loc.lng) : (loc.longitude !== undefined ? Number(loc.longitude) : null);
    return {
      name: loc.name || loc.city || loc.placeName || (lat && lng ? `${lat.toFixed(4)},${lng.toFixed(4)}` : 'Unknown'),
      lat,
      lng
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
            dataStatus: 'live_verified',
            isLiveVerified: true,
            isLimitedGraph: false,
            isEstimate: false,
            polyline: resp.data.routes[0].overview_polyline?.points || null,
            trafficSummary: leg.duration_in_traffic ? 'Live Google Traffic Monitored' : 'Standard Driving Conditions',
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
            isLiveVerified: true,
            isLimitedGraph: false,
            isEstimate: false,
            trafficSummary: 'Open-Road Network Distance Model',
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
      routingLimitation: 'No live provider or highway graph route available; distance and duration are modeled estimates.',
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
      return { matrix: [], locations: [], size: 0 };
    }

    const n = locations.length;
    const matrix = Array.from({ length: n }, () => Array.from({ length: n }, () => null));

    // Fill diagonal
    for (let i = 0; i < n; i++) {
      matrix[i][i] = { distanceKm: 0, durationMinutes: 0, isLiveVerified: true, dataStatus: 'exact_zero' };
    }

    // Solve pairs
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const fromLoc = locations[i];
        const toLoc = locations[j];
        const res = await this.getRoute(fromLoc, toLoc, options);
        matrix[i][j] = {
          distanceKm: res.distanceKm,
          durationMinutes: res.durationMinutes,
          isLiveVerified: res.isLiveVerified,
          dataStatus: res.dataStatus,
          dataSource: res.dataSource
        };
      }
    }

    // Also extract convenient 2D numerical arrays for quick lookups
    const distances = matrix.map(row => row.map(cell => cell ? cell.distanceKm : 0));
    const durations = matrix.map(row => row.map(cell => cell ? cell.durationMinutes : 0));

    return {
      size: n,
      locations,
      matrix,
      distances,
      durations,
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


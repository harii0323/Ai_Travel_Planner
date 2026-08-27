import React from 'react';

const GOOGLE_MAPS_EMBED_KEY = process.env.REACT_APP_GOOGLE_MAPS_EMBED_KEY;

function getStopKey(stop) {
  const label = getStopLabel(stop);
  return label.toLowerCase().trim();
}

function getStopLabel(stop) {
  if (!stop) return '';

  if (stop.location?.lat && stop.location?.lng) {
    return `${stop.location.lat},${stop.location.lng}`;
  }

  return stop.name || stop.formattedAddress || '';
}

function getDistanceAlongRoute(stop) {
  const value = stop?.routeSectionKm ?? stop?.distanceAlongRoute ?? stop?.journeyOrder ?? stop?.distance;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function getCoordinates(stop) {
  const lat = stop?.location?.lat ?? stop?.coordinates?.lat ?? stop?.latitude;
  const lng = stop?.location?.lng ?? stop?.coordinates?.lng ?? stop?.longitude;
  const numberLat = Number(lat);
  const numberLng = Number(lng);

  if (!Number.isFinite(numberLat) || !Number.isFinite(numberLng)) {
    return null;
  }

  return { lat: numberLat, lng: numberLng };
}

function calculateStraightLineDistanceKm(fromStop, toStop) {
  const from = getCoordinates(fromStop);
  const to = getCoordinates(toStop);

  if (!from || !to) return null;

  const earthRadiusKm = 6371;
  const toRadians = degrees => degrees * (Math.PI / 180);
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLng = toRadians(to.lng - from.lng);
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLng / 2) ** 2;

  return Math.round(earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function formatDistance(distanceKm) {
  const distance = Number(distanceKm);
  if (!Number.isFinite(distance)) return '';
  return `${Math.max(0, Math.round(distance))} km`;
}

function decorateStopDistances(stops, fallbackSegmentDistance = null) {
  return stops.map((stop, index) => {
    if (index === 0) {
      return { ...stop, distanceFromPreviousKm: null };
    }

    const previousStop = stops[index - 1];
    const currentAlong = getDistanceAlongRoute(stop);
    const previousAlong = getDistanceAlongRoute(previousStop);
    let distanceFromPreviousKm = null;

    if (currentAlong !== null && previousAlong !== null && currentAlong >= previousAlong) {
      distanceFromPreviousKm = currentAlong - previousAlong;
    } else if (currentAlong !== null && previousAlong === null) {
      distanceFromPreviousKm = currentAlong;
    } else {
      distanceFromPreviousKm = calculateStraightLineDistanceKm(previousStop, stop);
    }

    if (
      distanceFromPreviousKm === null &&
      fallbackSegmentDistance !== null &&
      stops.length > 1
    ) {
      distanceFromPreviousKm = fallbackSegmentDistance / (stops.length - 1);
    }

    return { ...stop, distanceFromPreviousKm };
  });
}

function buildSegmentStops(route) {
  if (!route.routeSegments?.length) {
    return null;
  }

  return route.routeSegments.flatMap((segment, segmentIndex) => {
    const primaryRoute = segment.primaryRoute || {};
    const segmentStops = [
      {
        name: primaryRoute.from,
        type: segmentIndex === 0 ? 'Start' : `${segment.phase || 'Route'} start`,
        phase: segment.phase
      },
      ...(segment.intermediateStops || segment.recommendedStops || []),
      {
        name: primaryRoute.to,
        type: segmentIndex === route.routeSegments.length - 1 ? 'Destination' : `${segment.phase || 'Route'} end`,
        phase: segment.phase
      }
    ].filter(stop => getStopLabel(stop));

    return decorateStopDistances(segmentStops, segment.totalDistance || primaryRoute.distance);
  });
}

function getAllStops(route) {
  const primaryRoute = route.primaryRoute || {};
  const segmentedStops = buildSegmentStops(route);
  const stopCandidates = segmentedStops || [
    { name: primaryRoute.from, type: 'Start' },
    ...(route.intermediateStops || []),
    ...(route.recommendedStops || []),
    { name: primaryRoute.to, type: 'Destination' }
  ];

  const seen = new Set();
  const uniqueStops = stopCandidates
    .filter(stop => getStopLabel(stop))
    .filter(stop => {
      const key = `${stop.phase || stop.type || 'route'}:${getStopKey(stop)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return segmentedStops ? uniqueStops : decorateStopDistances(uniqueStops, primaryRoute.distance || route.totalDistance);
}

function getTravelMode(mode) {
  const normalizedMode = String(mode || 'driving').toLowerCase();
  const modeMap = {
    bus: 'transit',
    train: 'transit',
    metro: 'transit',
    public: 'transit',
    walking: 'walking',
    bicycling: 'bicycling',
    bicycle: 'bicycling'
  };

  return modeMap[normalizedMode] || 'driving';
}

function buildQueryParams(params) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

function buildPlaceUrl(stop) {
  const query = getStopLabel(stop);
  return `https://www.google.com/maps/search/?${buildQueryParams({
    api: '1',
    query
  })}`;
}

function getMarkerLabel(index) {
  const markerLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return markerLabels[index] || '';
}

function buildStaticMapUrl(routeStops) {
  if (!GOOGLE_MAPS_EMBED_KEY || routeStops.length === 0) {
    return null;
  }

  const markerParams = routeStops.map((stop, index) => {
    const markerParts = [
      `color:${index === 0 ? 'green' : index === routeStops.length - 1 ? 'red' : 'blue'}`,
      getStopLabel(stop)
    ].filter(Boolean);

    const markerLabel = getMarkerLabel(index);
    if (markerLabel) markerParts.splice(1, 0, `label:${markerLabel}`);

    return `markers=${encodeURIComponent(markerParts.join('|'))}`;
  });

  const params = [
    'size=960x420',
    'scale=2',
    'maptype=roadmap',
    ...markerParams,
    `key=${encodeURIComponent(GOOGLE_MAPS_EMBED_KEY)}`
  ];

  return `https://maps.googleapis.com/maps/api/staticmap?${params.join('&')}`;
}

function RouteMap({ route = {} }) {
  const primaryRoute = route.primaryRoute || {};
  const origin = primaryRoute.from;
  const destination = primaryRoute.to;
  const routeStops = getAllStops(route);
  const stops = routeStops.slice(1, -1);
  const waypoints = stops.map(getStopLabel).join('|');
  const travelMode = getTravelMode(primaryRoute.transportMode);

  if (!origin || !destination) {
    return null;
  }

  const directionsParams = buildQueryParams({
    api: '1',
    origin,
    destination,
    travelmode: travelMode,
    waypoints
  });

  const externalMapUrl = `https://www.google.com/maps/dir/?${directionsParams}`;
  const staticMapUrl = buildStaticMapUrl(routeStops);

  const embedParams = GOOGLE_MAPS_EMBED_KEY && buildQueryParams({
    key: GOOGLE_MAPS_EMBED_KEY,
    origin,
    destination,
    mode: travelMode,
    waypoints
  });

  const embedUrl = embedParams
    ? `https://www.google.com/maps/embed/v1/directions?${embedParams}`
    : null;

  return (
    <div className="route-map-panel">
      <div className="route-map-header">
        <div>
          <h4>Visual Route Map</h4>
          <p>{origin} to {destination}</p>
        </div>
        <a href={externalMapUrl} target="_blank" rel="noreferrer" className="map-open-link">
          Open in Google Maps
        </a>
      </div>

      {staticMapUrl ? (
        <div className="route-static-map-wrap">
          <img
            className="route-static-map"
            src={staticMapUrl}
            alt={`Map with ${routeStops.length} route stops from ${origin} to ${destination}`}
          />
        </div>
      ) : embedUrl ? (
        <>
          <iframe
            className="route-map-frame"
            title={`Route map from ${origin} to ${destination}`}
            src={embedUrl}
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className="route-map-note">
            Showing route waypoints. Add REACT_APP_GOOGLE_MAPS_EMBED_KEY with Static Maps enabled to show labeled pins for every stop.
          </div>
        </>
      ) : (
        <div className="route-map-fallback" aria-label={`Route overview from ${origin} to ${destination}`}>
          <div className="route-map-track">
            {routeStops.map((stop, index) => (
              <a
                key={`${stop.phase || stop.type}-${getStopLabel(stop)}-${index}`}
                className="route-map-stop"
                href={buildPlaceUrl(stop)}
                target="_blank"
                rel="noreferrer"
                title={`Open ${stop.name || getStopLabel(stop)} in Google Maps`}
              >
                <span className="route-stop-marker">{getMarkerLabel(index) || index + 1}</span>
                <div className="route-stop-copy">
                  <span className="route-stop-type">{stop.type || stop.phase || `Stop ${index}`}</span>
                  <strong>{stop.name || getStopLabel(stop)}</strong>
                  {(stop.category || stop.types?.[0]) && (
                    <span className="route-stop-meta">{stop.category || stop.types?.[0]}</span>
                  )}
                  {stop.distanceFromPreviousKm !== null && stop.distanceFromPreviousKm !== undefined && (
                    <span className="route-stop-distance">
                      {formatDistance(stop.distanceFromPreviousKm)} from previous stop
                    </span>
                  )}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {(staticMapUrl || embedUrl) && (
        <div className="route-stop-links" aria-label="Open route stops in Google Maps">
          {routeStops.map((stop, index) => (
            <a
              key={`link-${stop.phase || stop.type}-${getStopLabel(stop)}-${index}`}
              className="route-stop-link"
              href={buildPlaceUrl(stop)}
              target="_blank"
              rel="noreferrer"
              title={`Open ${stop.name || getStopLabel(stop)} in Google Maps`}
            >
              <span>{getMarkerLabel(index) || index + 1}</span>
              <strong>
                {stop.name || getStopLabel(stop)}
                {stop.distanceFromPreviousKm !== null && stop.distanceFromPreviousKm !== undefined && (
                  <small>{formatDistance(stop.distanceFromPreviousKm)} from previous</small>
                )}
              </strong>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default RouteMap;

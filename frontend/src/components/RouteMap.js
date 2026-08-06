import React from 'react';

const GOOGLE_MAPS_EMBED_KEY = process.env.REACT_APP_GOOGLE_MAPS_EMBED_KEY;

function getStopLabel(stop) {
  if (!stop) return '';

  if (stop.location?.lat && stop.location?.lng) {
    return `${stop.location.lat},${stop.location.lng}`;
  }

  return stop.name || stop.formattedAddress || '';
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

function RouteMap({ route = {} }) {
  const primaryRoute = route.primaryRoute || {};
  const origin = primaryRoute.from;
  const destination = primaryRoute.to;
  const stops = (route.intermediateStops || []).filter(stop => getStopLabel(stop));
  const waypoints = stops.map(getStopLabel).slice(0, 10).join('|');
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

  const routeStops = [
    { name: origin, type: 'Start' },
    ...stops.map((stop, index) => ({
      name: stop.name,
      type: stop.phase || `Stop ${index + 1}`,
      meta: stop.category || stop.types?.[0]
    })),
    { name: destination, type: 'Destination' }
  ];

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

      {embedUrl ? (
        <iframe
          className="route-map-frame"
          title={`Route map from ${origin} to ${destination}`}
          src={embedUrl}
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
        />
      ) : (
        <div className="route-map-fallback" aria-label={`Route overview from ${origin} to ${destination}`}>
          <div className="route-map-track">
            {routeStops.map((stop, index) => (
              <div key={`${stop.type}-${stop.name}-${index}`} className="route-map-stop">
                <span className="route-stop-marker">{index + 1}</span>
                <div className="route-stop-copy">
                  <span className="route-stop-type">{stop.type}</span>
                  <strong>{stop.name}</strong>
                  {stop.meta && <span className="route-stop-meta">{stop.meta}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default RouteMap;

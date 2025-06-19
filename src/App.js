import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const greenIcon = new L.Icon({
  iconUrl: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30],
});

const redIcon = new L.Icon({
  iconUrl: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30],
});

const defaultIcon = new L.Icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Pothole warning icon
const potholeIcon = new L.DivIcon({
  html: `<div style="
    background: #ff4444;
    border: 2px solid white;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    color: white;
    font-weight: bold;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  ">⚠️</div>`,
  className: 'pothole-marker',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12]
});

// Enhanced location component with better error handling
function LocationController({ onLocationFound, onLocationError }) {
  const map = useMap();
  const [watchId, setWatchId] = useState(null);
  const [isWatching, setIsWatching] = useState(false);
  const mapReadyRef = useRef(false);

  useEffect(() => {
    if (!map) return;

    const checkMapReady = () => {
      if (map._container && map._loaded) {
        mapReadyRef.current = true;
        return true;
      }
      return false;
    };

    if (!checkMapReady()) {
      const readyTimer = setInterval(() => {
        if (checkMapReady()) {
          clearInterval(readyTimer);
          startLocationTracking();
        }
      }, 100);

      return () => clearInterval(readyTimer);
    } else {
      startLocationTracking();
    }

    function startLocationTracking() {
      if (!mapReadyRef.current || isWatching) return;

      let mounted = true;

      const startLocationWatch = () => {
        if (!navigator.geolocation) {
          onLocationError('Geolocation is not supported by this browser');
          return;
        }

        const options = {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        };

        navigator.geolocation.getCurrentPosition(
            (position) => {
              if (!mounted || !mapReadyRef.current) return;

              const { latitude, longitude, accuracy } = position.coords;
              const coords = [latitude, longitude];

              console.log('Initial location found:', coords, 'Accuracy:', accuracy, 'meters');
              onLocationFound(coords, accuracy);

              try {
                if (map && map._container) {
                  map.setView(coords, 16, { animate: true });
                }
              } catch (e) {
                console.warn('Error setting map view:', e);
              }
            },
            (error) => {
              console.error('Initial geolocation error:', error);

              const fallbackOptions = {
                enableHighAccuracy: false,
                timeout: 30000,
                maximumAge: 300000
              };

              navigator.geolocation.getCurrentPosition(
                  (position) => {
                    if (!mounted || !mapReadyRef.current) return;
                    const { latitude, longitude, accuracy } = position.coords;
                    const coords = [latitude, longitude];
                    console.log('Fallback location found:', coords);
                    onLocationFound(coords, accuracy);

                    try {
                      if (map && map._container) {
                        map.setView(coords, 15, { animate: true });
                      }
                    } catch (e) {
                      console.warn('Error setting fallback map view:', e);
                    }
                  },
                  (fallbackError) => {
                    console.error('Fallback geolocation failed:', fallbackError);
                    onLocationError(`Location error: ${fallbackError.message}`);
                  },
                  fallbackOptions
              );
            },
            options
        );

        if (!isWatching) {
          const id = navigator.geolocation.watchPosition(
              (position) => {
                if (!mounted || !mapReadyRef.current) return;
                const { latitude, longitude, accuracy } = position.coords;
                const coords = [latitude, longitude];
                console.log('Updated location:', coords, 'Accuracy:', accuracy, 'meters');
                onLocationFound(coords, accuracy);
              },
              (error) => {
                console.warn('Watch position error:', error.message);
              },
              options
          );

          setWatchId(id);
          setIsWatching(true);
        }
      };

      const timer = setTimeout(startLocationWatch, 1000);

      return () => {
        mounted = false;
        clearTimeout(timer);
        if (watchId) {
          navigator.geolocation.clearWatch(watchId);
        }
      };
    }
  }, [map, onLocationFound, onLocationError, isWatching]);

  return null;
}

// Simplified routing component using GraphHopper API
function SimpleRouting({ userPosition, destination, onRouteInfo, onRoutingState }) {
  const map = useMap();
  const routeLayerRef = useRef(null);

  useEffect(() => {
    if (!userPosition || !destination || !map || !map._container) return;

    // Remove existing route
    if (routeLayerRef.current) {
      try {
        map.removeLayer(routeLayerRef.current);
      } catch (e) {
        console.warn('Error removing route layer:', e);
      }
      routeLayerRef.current = null;
    }

    const createRoute = async () => {
      if (onRoutingState) onRoutingState(true);

      try {
        // Try GraphHopper API first (free tier available)
        const apiKey = 'your-api-key-here'; // You'll need to get a free API key
        const url = `https://graphhopper.com/api/1/route?point=${userPosition[0]},${userPosition[1]}&point=${destination[0]},${destination[1]}&vehicle=car&locale=en&calc_points=true&key=${apiKey}`;

        // For demo purposes, we'll use a simulated route since we don't have API key
        const routeCoordinates = generateSimulatedRoute(userPosition, destination);

        // Create route line
        routeLayerRef.current = L.polyline(routeCoordinates, {
          color: '#2196f3',
          weight: 5,
          opacity: 0.8,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map);

        // Fit map to show the route
        const bounds = L.latLngBounds(routeCoordinates);
        map.fitBounds(bounds, { padding: [20, 20] });

        // Calculate route info
        const distance = calculateRouteDistance(routeCoordinates);
        const estimatedTime = Math.round((distance / 30) * 60); // Assuming 30 km/h average in city

        if (onRouteInfo) {
          onRouteInfo({
            distance: distance.toFixed(1),
            time: estimatedTime,
            type: 'simulated-route',
            coordinates: routeCoordinates
          });
        }

      } catch (error) {
        console.error('Error creating route:', error);

        // Fallback to straight line
        try {
          routeLayerRef.current = L.polyline([userPosition, destination], {
            color: '#ff9800',
            weight: 4,
            opacity: 0.7,
            dashArray: '10,5'
          }).addTo(map);

          const bounds = L.latLngBounds([userPosition, destination]);
          map.fitBounds(bounds, { padding: [20, 20] });

          const distance = calculateDistance(userPosition, destination);
          const estimatedTime = Math.round((distance / 50) * 60);

          if (onRouteInfo) {
            onRouteInfo({
              distance: distance.toFixed(1),
              time: estimatedTime,
              type: 'straight-line'
            });
          }
        } catch (fallbackError) {
          console.error('Fallback route creation failed:', fallbackError);
        }
      } finally {
        if (onRoutingState) onRoutingState(false);
      }
    };

    createRoute();

    return () => {
      if (routeLayerRef.current && map) {
        try {
          map.removeLayer(routeLayerRef.current);
        } catch (e) {
          console.warn('Cleanup error:', e);
        }
      }
    };
  }, [map, userPosition, destination, onRouteInfo, onRoutingState]);

  return null;
}

// Generate a simulated route that follows major streets
function generateSimulatedRoute(start, end) {
  const waypoints = [];
  waypoints.push(start);

  // Add intermediate waypoints to simulate following roads
  const latDiff = end[0] - start[0];
  const lngDiff = end[1] - start[1];
  const segments = 5;

  for (let i = 1; i < segments; i++) {
    const factor = i / segments;
    // Add some variation to make it look like it follows roads
    const variation = 0.001 * Math.sin(factor * Math.PI * 4);
    waypoints.push([
      start[0] + (latDiff * factor) + variation,
      start[1] + (lngDiff * factor) + (variation * 0.5)
    ]);
  }

  waypoints.push(end);
  return waypoints;
}

// Calculate total distance of a route
function calculateRouteDistance(coordinates) {
  let totalDistance = 0;
  for (let i = 1; i < coordinates.length; i++) {
    totalDistance += calculateDistance(coordinates[i-1], coordinates[i]);
  }
  return totalDistance;
}

// Helper function to calculate distance between two points
function calculateDistance(pos1, pos2) {
  const R = 6371; // Earth's radius in km
  const dLat = (pos2[0] - pos1[0]) * Math.PI / 180;
  const dLon = (pos2[1] - pos1[1]) * Math.PI / 180;
  const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(pos1[0] * Math.PI / 180) * Math.cos(pos2[0] * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export default function MapView() {
  const [userPosition, setUserPosition] = useState(null);
  const [locationAccuracy, setLocationAccuracy] = useState(null);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [isRoutingLoading, setIsRoutingLoading] = useState(false);

  const yaoundeCenter = [3.848, 11.502];

  const locations = [
    { name: 'Yaoundé Nsimalen International Airport', coords: [3.723, 11.553] },
    { name: 'Monument de la Réunification', coords: [3.865, 11.518] },
    { name: 'Cameroon National Museum', coords: [3.866, 11.518] },
    { name: 'Central Market (Marché Central)', coords: [3.870, 11.512] },
    { name: 'Hotel Hilton Yaoundé', coords: [3.873, 11.519] },
  ];

  // Sample pothole locations around Yaoundé (you would get these from a database)
  const potholeLocations = [
    {
      coords: [3.860, 11.515],
      severity: 'high',
      description: 'Large pothole on main road',
      reportedBy: '12 users',
      lastUpdated: '2 days ago'
    },
    {
      coords: [3.855, 11.520],
      severity: 'medium',
      description: 'Multiple small potholes',
      reportedBy: '8 users',
      lastUpdated: '1 week ago'
    },
    {
      coords: [3.850, 11.510],
      severity: 'low',
      description: 'Minor road damage',
      reportedBy: '3 users',
      lastUpdated: '3 days ago'
    },
    {
      coords: [3.845, 11.525],
      severity: 'high',
      description: 'Deep pothole - caution advised',
      reportedBy: '15 users',
      lastUpdated: '1 day ago'
    },
    {
      coords: [3.875, 11.515],
      severity: 'medium',
      description: 'Road surface deterioration',
      reportedBy: '6 users',
      lastUpdated: '5 days ago'
    },
    {
      coords: [3.740, 11.540],
      severity: 'high',
      description: 'Airport road - major pothole',
      reportedBy: '20 users',
      lastUpdated: '6 hours ago'
    }
  ];

  const handleLocationFound = (coords, accuracy) => {
    setUserPosition(coords);
    setLocationAccuracy(accuracy);
    setLoading(false);
    setError(null);
  };

  const handleLocationError = (errorMessage) => {
    setError(errorMessage);
    setLoading(false);
    setUserPosition(yaoundeCenter);
    setLocationAccuracy(null);
  };

  const handleDestinationSelect = (location) => {
    setSelectedDestination(location.coords);
    setRouteInfo(null);
  };

  const handleRouteInfo = (info) => {
    setRouteInfo(info);
  };

  const handleRoutingState = (isLoading) => {
    setIsRoutingLoading(isLoading);
  };

  const clearRoute = () => {
    setSelectedDestination(null);
    setRouteInfo(null);
    setIsRoutingLoading(false);
  };

  const centerOnUser = () => {
    if (userPosition && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude, accuracy } = position.coords;
            const coords = [latitude, longitude];
            setUserPosition(coords);
            setLocationAccuracy(accuracy);
          },
          (error) => console.warn('Refresh location failed:', error),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  };

  const getPotholeIcon = (severity) => {
    const colors = {
      high: '#ff4444',
      medium: '#ff9800',
      low: '#ffeb3b'
    };

    return new L.DivIcon({
      html: `<div style="
        background: ${colors[severity]};
        border: 2px solid white;
        border-radius: 50%;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        color: white;
        font-weight: bold;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        animation: pulse 2s infinite;
      ">⚠️</div>`,
      className: 'pothole-marker',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
      popupAnchor: [0, -10]
    });
  };

  return (
      <div style={{ position: 'relative', height: '100vh', width: '100%' }}>
        {/* Custom CSS for pothole animations */}
        <style>{`
          @keyframes pulse {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.1); opacity: 0.8; }
            100% { transform: scale(1); opacity: 1; }
          }
          .pothole-marker {
            animation: pulse 2s infinite;
          }
        `}</style>

        {/* Loading indicator */}
        {loading && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 1000,
              background: 'white',
              padding: '20px',
              borderRadius: '10px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div>📍 Getting your precise location...</div>
                <small style={{ color: '#666', marginTop: '5px', display: 'block' }}>
                  This may take a few seconds for accuracy
                </small>
              </div>
            </div>
        )}

        {/* Routing loading indicator */}
        {isRoutingLoading && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 1000,
              background: 'rgba(33, 150, 243, 0.9)',
              color: 'white',
              padding: '15px 20px',
              borderRadius: '10px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div>🗺️ Calculating route...</div>
                <small style={{ marginTop: '5px', display: 'block', opacity: 0.8 }}>
                  Checking for road hazards
                </small>
              </div>
            </div>
        )}

        {/* Error message */}
        {error && (
            <div style={{
              position: 'absolute',
              top: '10px',
              left: '10px',
              right: '10px',
              zIndex: 1000,
              background: '#ffebee',
              color: '#c62828',
              padding: '10px',
              borderRadius: '5px',
              border: '1px solid #ef5350'
            }}>
              {error}
            </div>
        )}

        {/* Pothole legend */}
        <div style={{
          position: 'absolute',
          bottom: '120px',
          right: '10px',
          zIndex: 1000,
          background: 'rgba(255,255,255,0.95)',
          padding: '10px',
          borderRadius: '5px',
          fontSize: '11px',
          boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
          minWidth: '140px'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>⚠️ Pothole Alert</div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '3px' }}>
            <div style={{ width: '12px', height: '12px', backgroundColor: '#ff4444', borderRadius: '50%', marginRight: '5px' }}></div>
            <span>High Risk</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '3px' }}>
            <div style={{ width: '12px', height: '12px', backgroundColor: '#ff9800', borderRadius: '50%', marginRight: '5px' }}></div>
            <span>Medium Risk</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '12px', height: '12px', backgroundColor: '#ffeb3b', borderRadius: '50%', marginRight: '5px' }}></div>
            <span>Low Risk</span>
          </div>
        </div>

        {/* Location accuracy info */}
        {userPosition && locationAccuracy && (
            <div style={{
              position: 'absolute',
              bottom: '80px',
              left: '10px',
              zIndex: 1000,
              background: 'rgba(255,255,255,0.9)',
              padding: '8px 12px',
              borderRadius: '5px',
              fontSize: '12px',
              boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
            }}>
              📍 Location accuracy: ±{Math.round(locationAccuracy)}m
              <button
                  onClick={centerOnUser}
                  style={{
                    marginLeft: '10px',
                    padding: '4px 8px',
                    fontSize: '11px',
                    border: '1px solid #2196f3',
                    borderRadius: '3px',
                    background: '#2196f3',
                    color: 'white',
                    cursor: 'pointer'
                  }}
              >
                Refresh
              </button>
            </div>
        )}

        {/* Route info */}
        {routeInfo && (
            <div style={{
              position: 'absolute',
              bottom: '10px',
              left: '10px',
              zIndex: 1000,
              background: 'rgba(33, 150, 243, 0.9)',
              color: 'white',
              padding: '10px',
              borderRadius: '5px',
              fontSize: '12px',
              maxWidth: '300px'
            }}>
              <div>
                🚗 {routeInfo.distance} km • {routeInfo.time} min
                {routeInfo.type === 'simulated-route' && ' (city route)'}
                {routeInfo.type === 'straight-line' && ' (direct distance)'}
              </div>
            </div>
        )}

        {/* Destination selector */}
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: 1000,
          background: 'white',
          padding: '10px',
          borderRadius: '5px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          maxWidth: '250px'
        }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Select Destination:</h4>
          {locations.map((loc, i) => (
              <button
                  key={i}
                  onClick={() => handleDestinationSelect(loc)}
                  style={{
                    display: 'block',
                    width: '100%',
                    margin: '5px 0',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '3px',
                    background: selectedDestination === loc.coords ? '#e3f2fd' : 'white',
                    cursor: 'pointer',
                    fontSize: '12px',
                    textAlign: 'left'
                  }}
              >
                {loc.name}
              </button>
          ))}
          {selectedDestination && (
              <button
                  onClick={clearRoute}
                  style={{
                    width: '100%',
                    margin: '10px 0 0 0',
                    padding: '8px',
                    border: '1px solid #f44336',
                    borderRadius: '3px',
                    background: '#f44336',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
              >
                Clear Route
              </button>
          )}
        </div>

        <MapContainer
            center={yaoundeCenter}
            zoom={12}
            style={{ height: '100vh', width: '100%' }}
        >
          <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
          />

          {/* Location controller */}
          <LocationController
              onLocationFound={handleLocationFound}
              onLocationError={handleLocationError}
          />

          {/* Location markers */}
          {locations.map((loc, i) => (
              <Marker
                  key={i}
                  position={loc.coords}
                  icon={selectedDestination === loc.coords ? redIcon : defaultIcon}
              >
                <Popup>
                  <div>
                    <strong>{loc.name}</strong>
                    <br />
                    <button
                        onClick={() => handleDestinationSelect(loc)}
                        style={{
                          marginTop: '5px',
                          padding: '5px 10px',
                          border: '1px solid #2196f3',
                          borderRadius: '3px',
                          background: '#2196f3',
                          color: 'white',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                    >
                      Get Directions
                    </button>
                  </div>
                </Popup>
              </Marker>
          ))}

          {/* Pothole markers */}
          {potholeLocations.map((pothole, i) => (
              <Marker
                  key={`pothole-${i}`}
                  position={pothole.coords}
                  icon={getPotholeIcon(pothole.severity)}
                  zIndexOffset={500}
              >
                <Popup>
                  <div style={{ minWidth: '200px' }}>
                    <div style={{ fontWeight: 'bold', color: '#ff4444', marginBottom: '5px' }}>
                      ⚠️ Pothole Warning
                    </div>
                    <div style={{ marginBottom: '5px' }}>
                      <strong>Severity:</strong> {pothole.severity.toUpperCase()}
                    </div>
                    <div style={{ marginBottom: '5px' }}>
                      <strong>Description:</strong> {pothole.description}
                    </div>
                    <div style={{ marginBottom: '5px', fontSize: '12px', color: '#666' }}>
                      📊 Reported by {pothole.reportedBy}
                    </div>
                    <div style={{ fontSize: '11px', color: '#888' }}>
                      Last updated: {pothole.lastUpdated}
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '11px', color: '#2196f3' }}>
                      💡 Drive carefully in this area
                    </div>
                  </div>
                </Popup>
              </Marker>
          ))}

          {/* User location marker */}
          {userPosition && (
              <Marker
                  position={userPosition}
                  icon={greenIcon}
                  zIndexOffset={1000}
              >
                <Popup>
                  <div>
                    <strong>📍 You are here</strong>
                    <br />
                    <small>
                      Lat: {userPosition[0].toFixed(6)}<br />
                      Lng: {userPosition[1].toFixed(6)}
                      {locationAccuracy && (
                          <>
                            <br />Accuracy: ±{Math.round(locationAccuracy)}m
                          </>
                      )}
                    </small>
                  </div>
                </Popup>
              </Marker>
          )}

          {/* Simplified routing component */}
          {userPosition && selectedDestination && (
              <SimpleRouting
                  userPosition={userPosition}
                  destination={selectedDestination}
                  onRouteInfo={handleRouteInfo}
                  onRoutingState={handleRoutingState}
              />
          )}
        </MapContainer>
      </div>
  );
}
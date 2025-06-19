import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import 'leaflet-routing-machine';
import './index.css';

// Fix for default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const greenIcon = new L.Icon({
  iconUrl: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

const redIcon = new L.Icon({
  iconUrl: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
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

// Component to handle map centering when user position is found
function MapController({ userPosition, shouldCenter }) {
  const map = useMap();

  useEffect(() => {
    if (userPosition && shouldCenter && map) {
      // Center the map immediately on user location
      map.setView(userPosition, 15, {
        animate: true,
        duration: 1
      });
    }
  }, [map, userPosition, shouldCenter]);

  return null;
}

// Component to handle routing logic
function RoutingMachine({ userPosition, destination, routeColor = 'blue' }) {
  const map = useMap();
  const routingControlRef = useRef(null);

  useEffect(() => {
    if (!userPosition || !destination) return;

    // Remove existing routing control
    if (routingControlRef.current) {
      map.removeControl(routingControlRef.current);
    }

    // Create new routing control
    routingControlRef.current = L.Routing.control({
      waypoints: [
        L.latLng(userPosition[0], userPosition[1]),
        L.latLng(destination[0], destination[1]),
      ],
      routeWhileDragging: false,
      addWaypoints: false,
      draggableWaypoints: false,
      show: false,
      createMarker: () => null, // Don't create markers for waypoints
      lineOptions: {
        styles: [
          { color: routeColor, weight: 6, opacity: 0.7 },
          { color: 'white', weight: 2, opacity: 1 }
        ]
      },
      altLineOptions: {
        styles: [
          { color: 'gray', weight: 4, opacity: 0.5, dashArray: '10,10' },
          { color: 'white', weight: 2, opacity: 0.8, dashArray: '10,10' }
        ]
      }
    }).addTo(map);

    // Hide the routing instructions panel
    const routingContainer = document.querySelector('.leaflet-routing-container');
    if (routingContainer) {
      routingContainer.style.display = 'none';
    }

    return () => {
      if (routingControlRef.current) {
        map.removeControl(routingControlRef.current);
      }
    };
  }, [map, userPosition, destination, routeColor]);

  return null;
}

export default function MapView() {
  const [userPosition, setUserPosition] = useState(null);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const [shouldCenterOnUser, setShouldCenterOnUser] = useState(false);
  const mapRef = useRef(null);

  const yaoundeCenter = [3.848, 11.502];

  const locations = [
    { name: 'Yaoundé Nsimalen International Airport', coords: [3.723, 11.553] },
    { name: 'Monument de la Réunification', coords: [3.865, 11.518] },
    { name: 'Cameroon National Museum', coords: [3.866, 11.518] },
    { name: 'Central Market (Marché Central)', coords: [3.870, 11.512] },
    { name: 'Hotel Hilton Yaoundé', coords: [3.873, 11.519] },
  ];

  // Get user location on component mount
  useEffect(() => {
    const getUserLocation = () => {
      if (!navigator.geolocation) {
        setError('Geolocation is not supported by this browser');
        setLoading(false);
        return;
      }

      const options = {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0 // Always get fresh location
      };

      navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            const coords = [latitude, longitude];
            setUserPosition(coords);
            setShouldCenterOnUser(true);
            setLoading(false);
            console.log('User location obtained:', coords);
          },
          (err) => {
            console.error('Geolocation error:', err.message);
            setError(`Location error: ${err.message}`);
            setLoading(false);

            // Fallback to Yaoundé center if geolocation fails
            setUserPosition(yaoundeCenter);
            setShouldCenterOnUser(true);
          },
          options
      );
    };

    // Small delay to ensure map is ready
    const timer = setTimeout(() => {
      getUserLocation();
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  const handleDestinationSelect = (location) => {
    setSelectedDestination(location.coords);
  };

  const clearRoute = () => {
    setSelectedDestination(null);
  };

  const handleMapReady = (mapInstance) => {
    mapRef.current = mapInstance;
    setMapReady(true);
  };

  return (
      <div style={{ position: 'relative', height: '100vh', width: '100%' }}>
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
              <div>Getting your location...</div>
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
            whenCreated={handleMapReady}
            style={{ height: '100vh', width: '100%' }}
        >
          <TileLayer
              attribution='&copy; OpenStreetMap contributors & CartoDB'
              url='https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
          />

          {/* Map controller for centering */}
          <MapController
              userPosition={userPosition}
              shouldCenter={shouldCenterOnUser}
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

          {/* User location marker - only show when position is available */}
          {userPosition && (
              <Marker
                  position={userPosition}
                  icon={greenIcon}
                  zIndexOffset={1000} // Ensure user marker is on top
                  eventHandlers={{
                    add: (e) => {
                      const markerEl = e.target._icon;
                      if (markerEl) {
                        markerEl.classList.add('bouncing');
                        // Reset the centering flag after marker is added
                        setTimeout(() => setShouldCenterOnUser(false), 1000);
                      }
                    },
                  }}
              >
                <Popup>
                  <div>
                    <strong>You are here</strong>
                    <br />
                    <small>
                      Lat: {userPosition[0].toFixed(6)}<br />
                      Lng: {userPosition[1].toFixed(6)}
                    </small>
                  </div>
                </Popup>
              </Marker>
          )}

          {/* Routing component */}
          {userPosition && selectedDestination && mapReady && (
              <RoutingMachine
                  userPosition={userPosition}
                  destination={selectedDestination}
                  routeColor="#2196f3"
              />
          )}
        </MapContainer>
      </div>
  );
}
import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import 'leaflet-routing-machine';
import './index.css';

const greenIcon = new L.Icon({
  iconUrl: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

export default function MapView() {
  const [userPosition, setUserPosition] = useState(null);
  const mapRef = useRef(null);

  const yaoundeCenter = [3.848, 11.502];

  const locations = [
    { name: 'Yaoundé Nsimalen International Airport', coords: [3.723, 11.553] },
    { name: 'Monument de la Réunification', coords: [3.865, 11.518] },
    { name: 'Cameroon National Museum', coords: [3.866, 11.518] },
    { name: 'Central Market (Marché Central)', coords: [3.870, 11.512] },
    { name: 'Hotel Hilton Yaoundé', coords: [3.873, 11.519] },
  ];

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          const { latitude, longitude } = pos.coords;
          const coords = [latitude, longitude];
          setUserPosition(coords);
          console.log('User location:', coords);
          // Move the map to the user's location
          if (mapRef.current) {
            mapRef.current.setView(coords, 13);
          }
        },
        err => {
          console.error('Geolocation error:', err.message);
        },
        { enableHighAccuracy: true }
      );
    }
  }, []);

  useEffect(() => {
    if (userPosition && mapRef.current) {
      L.Routing.control({
        waypoints: [
          L.latLng(userPosition[0], userPosition[1]),
          L.latLng(3.865, 11.518),
        ],
        routeWhileDragging: false,
        addWaypoints: false,
        draggableWaypoints: false,
        show: false,
      }).addTo(mapRef.current);
    }
  }, [userPosition]);

  return (
    <MapContainer
      center={yaoundeCenter}
      zoom={13}
      whenCreated={(mapInstance) => (mapRef.current = mapInstance)}
      style={{ height: '100vh', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; OpenStreetMap contributors & CartoDB'
        url='https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
      />

      {locations.map((loc, i) => (
        <Marker key={i} position={loc.coords}>
          <Popup>{loc.name}</Popup>
        </Marker>
      ))}

      {userPosition && (
        <Marker
          position={userPosition}
          icon={greenIcon}
          eventHandlers={{
            add: (e) => {
              const markerEl = e.target._icon;
              if (markerEl) markerEl.classList.add('bouncing');
            },
          }}
        >
          <Popup>You are here</Popup>
        </Marker>
      )}
    </MapContainer>
  );
}

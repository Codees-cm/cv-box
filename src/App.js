import { useEffect } from 'react';
import MapView from './MapView'; // Assuming MapView is in the same directory

function App() {
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        position => {
          const { latitude, longitude } = position.coords;
          console.log('User location:', latitude, longitude);
        },
        error => {
          console.error('Geolocation error:', error.message);
        }
      );
    } else {
      console.warn('Geolocation is not supported by this browser.');
    }
  }, []);

  return <MapView />;
}

export default App;

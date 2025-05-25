import React, { useEffect, useCallback, useState } from 'react';
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

const MapContainer = ({
  mapRef,
  map,
  setMap,
  currentLocation,
  setCurrentLocation,
  selectedLocation,
  setSelectedLocation,
  setLoadingLocation,
  setErrorMessage,
  setStatusMessage,
  markers,
  routes
}) => {
  const [locationAttempts, setLocationAttempts] = useState(0);
  const MAX_LOCATION_ATTEMPTS = 3;

  const getLocation = useCallback(() => {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        position => {
          const { latitude, longitude } = position.coords;
          resolve({ lat: latitude, lng: longitude });
        },
        error => {
          reject(error);
        },
        { enableHighAccuracy: true, timeout: 3000000, maximumAge: 0 }
      );
    });
  }, []);

  const initMap = useCallback(async () => {
    setLoadingLocation(true);
    
    try {
      // Try to get location
      const position = await getLocation();
      setCurrentLocation(position);
      setLoadingLocation(false);
      setLocationAttempts(0); // Reset attempts on success
      
      if (!map) {
        const googleMap = new window.google.maps.Map(mapRef.current, {
          center: position,
          zoom: 14,
          styles: [
            { featureType: 'all', elementType: 'geometry.fill', stylers: [{ color: '#1a1a2e' }] },
            { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#4777fe' }] },
            { featureType: 'poi', stylers: [{ visibility: 'off' }] },
            { featureType: 'transit', stylers: [{ visibility: 'off' }] },
            { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#0f3460' }] },
          ],
          disableDefaultUI: true,
          gestureHandling: 'greedy',
          zoomControl: true,
        });
        setMap(googleMap);

        googleMap.addListener('click', (event) => {
          const latLng = { lat: event.latLng.lat(), lng: event.latLng.lng() };
          setSelectedLocation(latLng);
          setStatusMessage(`Selected: ${latLng.lat.toFixed(4)}, ${latLng.lng.toFixed(4)}`);
          setTimeout(() => setStatusMessage(''), 3000);
        });
      } else {
        map.panTo(position);
      }
      
      // Set up continuous location tracking
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentLocation({ lat: latitude, lng: longitude });
          if (map) map.panTo({ lat: latitude, lng: longitude });
        },
        (error) => {
          console.warn('Watch position error:', error.message);
          // Don't show error for watch updates
        },
        { enableHighAccuracy: true, timeout: 3000000, maximumAge: 10000 }
      );
      
      return watchId;
    } catch (error) {
      console.error('Location error:', error);
      
      // Increment attempts and try again if under max attempts
      const newAttempts = locationAttempts + 1;
      setLocationAttempts(newAttempts);
      
      if (newAttempts < MAX_LOCATION_ATTEMPTS) {
        setErrorMessage(`Location error: ${error.message}. Retrying (${newAttempts}/${MAX_LOCATION_ATTEMPTS})...`);
        
        // Wait 2 seconds before retrying
        setTimeout(() => {
          initMap();
        }, 2000);
      } else {
        // Use default location after max attempts
        setErrorMessage(`Location error: ${error.message}. Using default location.`);
        setLoadingLocation(false);
        
        const defaultLocation = { lat: 37.7749, lng: -122.4194 };
        setCurrentLocation(defaultLocation);

        if (!map) {
          const googleMap = new window.google.maps.Map(mapRef.current, {
            center: defaultLocation,
            zoom: 14,
            styles: [
              { featureType: 'all', elementType: 'geometry.fill', stylers: [{ color: '#1a1a2e' }] },
              { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#4777fe' }] },
              { featureType: 'poi', stylers: [{ visibility: 'off' }] },
              { featureType: 'transit', stylers: [{ visibility: 'off' }] },
              { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#0f3460' }] },
            ],
            disableDefaultUI: true,
            gestureHandling: 'greedy',
            zoomControl: true,
          });
          setMap(googleMap);
          
          googleMap.addListener('click', (event) => {
            const latLng = { lat: event.latLng.lat(), lng: event.latLng.lng() };
            setSelectedLocation(latLng);
            setStatusMessage(`Selected: ${latLng.lat.toFixed(4)}, ${latLng.lng.toFixed(4)}`);
            setTimeout(() => setStatusMessage(''), 3000);
          });
        }
      }
    }
  }, [map, mapRef, setMap, setCurrentLocation, setLoadingLocation, setErrorMessage, setSelectedLocation, setStatusMessage, getLocation, locationAttempts]);

  // Add this to the MapContainer component after initializing the map
useEffect(() => {
  if (map && currentLocation) {
    // Create or update current location marker
    const createLocationMarker = () => {
      // Clear existing marker if any
      if (window.currentLocationMarker) {
        window.currentLocationMarker.setMap(null);
      }
      
      // Create new marker
      window.currentLocationMarker = new window.google.maps.Marker({
        position: currentLocation,
        map: map,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#4285F4',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
        },
        title: 'Your Location',
        zIndex: 1000
      });
      
      // Add accuracy circle
      if (window.locationAccuracyCircle) {
        window.locationAccuracyCircle.setMap(null);
      }
      
      window.locationAccuracyCircle = new window.google.maps.Circle({
        map: map,
        center: currentLocation,
        radius: 50, // 50 meters accuracy
        strokeColor: '#4285F4',
        strokeOpacity: 0.2,
        strokeWeight: 1,
        fillColor: '#4285F4',
        fillOpacity: 0.1,
      });
    };
    
    createLocationMarker();
  }
}, [map, currentLocation]);

  useEffect(() => {
    let watchId;
    
    const loadGoogleMaps = () => {
      if (!window.google && GOOGLE_MAPS_API_KEY) {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
        script.async = true;
        script.onload = async () => {
          watchId = await initMap();
        };
        script.onerror = () => {
          setErrorMessage('Failed to load Google Maps.');
          setLoadingLocation(false);
        };
        document.head.appendChild(script);
      } else if (window.google) {
        initMap().then(id => {
          watchId = id;
        });
      } else {
        setErrorMessage('Google Maps API key is missing.');
        setLoadingLocation(false);
      }
    };

    loadGoogleMaps();

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      
      if (markers && markers.length) {
        markers.forEach(marker => {
          if (marker && marker.setMap) marker.setMap(null);
        });
      }
      
      if (routes && routes.length) {
        routes.forEach(route => {
          if (route && route.setMap) route.setMap(null);
        });
      }
    };
  }, [initMap, markers, routes, setErrorMessage, setLoadingLocation]);

  // Add a manual refresh button
  const handleRefreshLocation = useCallback(() => {
    setLocationAttempts(0);
    initMap();
  }, [initMap]);

  return (
    <>
      <div ref={mapRef} className="map" style={{ width: '100%', height: '100vh' }}></div>
      {locationAttempts >= MAX_LOCATION_ATTEMPTS && (
        <button 
          onClick={handleRefreshLocation}
          style={{
            position: 'absolute',
            bottom: '20px',
            right: '20px',
            padding: '10px 15px',
            backgroundColor: '#4777fe',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            zIndex: 10
          }}
        >
          Retry Location
        </button>
      )}
    </>
  );
};

export default MapContainer;

import React, { useEffect, useCallback, useState, useRef } from 'react';
import polyline from '@mapbox/polyline';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const RouteHandler = ({
  map,
  currentLocation,
  routes,
  setRoutes,
  safetyData,
  setLoadingRoutes,
  setErrorMessage
}) => {
  const routesFetched = useRef(false);
  const currentRoutesRef = useRef([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const currentLocationMarkerRef = useRef(null);

  // Clear all existing routes from the map
  const clearExistingRoutes = useCallback(() => {
    if (currentRoutesRef.current && currentRoutesRef.current.length > 0) {
      currentRoutesRef.current.forEach(route => {
        if (route && route.setMap) {
          route.setMap(null);
        }
      });
      currentRoutesRef.current = [];
    }
  }, []);

  // Create or update the current location marker
  const updateCurrentLocationMarker = useCallback(() => {
    if (!map || !currentLocation) return;
    
    // Remove existing marker if it exists
    if (currentLocationMarkerRef.current) {
      currentLocationMarkerRef.current.setMap(null);
    }
    
    // Create new marker
    currentLocationMarkerRef.current = new window.google.maps.Marker({
      position: currentLocation,
      map: map,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#4285F4',
        fillOpacity: 1,
        strokeColor: '#FFFFFF',
        strokeWeight: 2,
      },
      title: 'Your Location',
      zIndex: 1000
    });
  }, [map, currentLocation]);

  const fetchRouteFromAPI = async (start, end) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/routes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: { location: { latLng: { latitude: start.lat, longitude: start.lng } } },
          destination: { location: { latLng: { latitude: end.lat, longitude: end.lng } } },
          travelMode: 'WALK',
          computeAlternativeRoutes: false,
          units: 'METRIC',
        }),
      });
      
      if (!response.ok) {
        // If API fails, create a direct line between points
        return {
          points: [[start.lat, start.lng], [end.lat, end.lng]],
          distance: getDistanceInMeters(start, end),
          duration: { seconds: getDistanceInMeters(start, end) * 0.8 },
        };
      }
      
      const data = await response.json();
      
      if (!data.routes || !data.routes[0] || !data.routes[0].polyline) {
        throw new Error('Invalid route data structure');
      }
      
      return {
        points: polyline.decode(data.routes[0].polyline.encodedPolyline),
        distance: data.routes[0].distanceMeters,
        duration: data.routes[0].duration,
      };
    } catch (error) {
      console.error("Route API error:", error);
      // Fallback to direct line
      return {
        points: [[start.lat, start.lng], [end.lat, end.lng]],
        distance: getDistanceInMeters(start, end),
        duration: { seconds: getDistanceInMeters(start, end) * 0.8 },
      };
    }
  };

  const getDistanceInMeters = (point1, point2) => {
    const R = 6371e3;
    const lat1 = point1.lat * Math.PI / 180;
    const lat2 = point2.lat * Math.PI / 180;
    const deltaLat = (point2.lat - point1.lat) * Math.PI / 180;
    const deltaLng = (point2.lng - point1.lng) * Math.PI / 180;
    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const displayRoutes = useCallback(async (googleMap, routesData) => {
    if (!googleMap || !routesData || routesData.length === 0) {
      setLoadingRoutes(false);
      return;
    }
    
    // First clear any existing routes
    clearExistingRoutes();
    
    const newRoutes = [];
    
    // Sort routes by safety score (highest first) and limit to top 3
    const topRoutes = routesData
      .sort((a, b) => b.safetyScore - a.safetyScore)
      .slice(0, 3);
    
    for (const routeData of topRoutes) {
      try {
        const routeInfo = await fetchRouteFromAPI(routeData.start, routeData.end);
        
        if (!routeInfo.points || routeInfo.points.length === 0) {
          continue;
        }
        
        const path = routeInfo.points.map(point => ({ lat: point[0], lng: point[1] }));
        
        // Determine route color based on safety score
        const routeColor = routeData.safetyScore >= 0.7 ? '#22c55e' : 
                          routeData.safetyScore >= 0.5 ? '#f97316' : '#ef4444';

        // Create a thicker, more visible polyline
        const routePolyline = new window.google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: routeColor,
          strokeOpacity: 0.9,
          strokeWeight: 6,
          map: googleMap,
          zIndex: Math.floor(100 * routeData.safetyScore),
        });
        
        // Add click listener for route information
        routePolyline.addListener('click', () => {
          const infoWindow = new window.google.maps.InfoWindow({
            content: `
              <div style="color: #fff; background: ${routeColor}; padding: 8px; border-radius: 5px;">
                <div style="font-weight: 600">Safety: ${Math.round(routeData.safetyScore * 100)}%</div>
                <div>Distance: ${(routeInfo.distance / 1000).toFixed(1)} km</div>
                <div>Time: ${Math.floor(routeInfo.duration.seconds / 60)} min</div>
                <div>Incidents: ${routeData.incidents}</div>
              </div>`,
            position: path[Math.floor(path.length / 2)],
          });
          infoWindow.open(googleMap);
        });

        // Add route to our tracking array
        newRoutes.push(routePolyline);
        currentRoutesRef.current.push(routePolyline);
      } catch (error) {
        console.error('Error creating route polyline:', error);
      }
    }
    
    // Update state with new routes
    setRoutes(newRoutes);
    setLoadingRoutes(false);
  }, [clearExistingRoutes, setRoutes, setLoadingRoutes]);

  const fetchSafetyData = useCallback(async (googleMap, location) => {
    if (routesFetched.current || isProcessing || !location) {
      return;
    }
    
    setIsProcessing(true);
    setLoadingRoutes(true);
    
    try {
      const timestamp = Date.now();
      const url = `${API_BASE_URL}/api/safety/routes?location=${encodeURIComponent(JSON.stringify(location))}&ts=${timestamp}`;
      
      const response = await fetch(url);
      
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      
      const data = await response.json();
      
      if (!data || !Array.isArray(data) || data.length === 0) {
        throw new Error('No routes data received from server');
      }
      
      await displayRoutes(googleMap, data);
      routesFetched.current = true;
    } catch (error) {
      console.error('Error fetching safety data:', error);
      setErrorMessage('Could not fetch safety data. Using demo data.');
      
      const demoData = [
        { start: location, end: { lat: location.lat + 0.01, lng: location.lng + 0.01 }, safetyScore: 0.8, incidents: 2 },
        { start: location, end: { lat: location.lat - 0.01, lng: location.lng - 0.01 }, safetyScore: 0.4, incidents: 5 },
        { start: location, end: { lat: location.lat + 0.01, lng: location.lng - 0.01 }, safetyScore: 0.6, incidents: 3 },
      ];
      
      await displayRoutes(googleMap, demoData);
    } finally {
      setIsProcessing(false);
      setLoadingRoutes(false);
    }
  }, [displayRoutes, setErrorMessage, setLoadingRoutes, isProcessing]);

  // Reset route fetched flag when location changes
  useEffect(() => {
    if (currentLocation) {
      routesFetched.current = false;
    }
  }, [currentLocation]);

  // Update current location marker whenever location changes
  useEffect(() => {
    updateCurrentLocationMarker();
  }, [updateCurrentLocationMarker]);

  // Main effect to fetch routes when map and location are ready
  useEffect(() => {
    if (map && currentLocation && !routesFetched.current && !isProcessing) {
      fetchSafetyData(map, currentLocation);
    }
  }, [map, currentLocation, fetchSafetyData, isProcessing]);

  return null;
};

export default RouteHandler;

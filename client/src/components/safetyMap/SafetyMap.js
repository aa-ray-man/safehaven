import React, { useState, useRef } from 'react';
import MapContainer from './MapContainer';
import RouteHandler from './RouteHandler';
import ReportHandler from './ReportHandler';
import SocketHandler from './SocketHandler';
import './SafetyMap.css';

const SafetyMap = () => {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [safetyData, setSafetyData] = useState([]);
  const [markers, setMarkers] = useState([]);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [showDebug, setShowDebug] = useState(false);


  return (
    <div className="safety-map-container">
      <MapContainer
        mapRef={mapRef}
        map={map}
        setMap={setMap}
        currentLocation={currentLocation}
        setCurrentLocation={setCurrentLocation}
        selectedLocation={selectedLocation}
        setSelectedLocation={setSelectedLocation}
        setLoadingLocation={setLoadingLocation}
        setErrorMessage={setErrorMessage}
        setStatusMessage={setStatusMessage}
        markers={markers}
        routes={routes}
      />
      
      <RouteHandler
        map={map}
        currentLocation={currentLocation}
        routes={routes}
        setRoutes={setRoutes}
        safetyData={safetyData}
        setLoadingRoutes={setLoadingRoutes}
        setErrorMessage={setErrorMessage}
      />
      
      <ReportHandler
        map={map}
        currentLocation={currentLocation}
        selectedLocation={selectedLocation}
        setSelectedLocation={setSelectedLocation} // Add this prop
        safetyData={safetyData}
        setSafetyData={setSafetyData}
        markers={markers}
        setMarkers={setMarkers}
        setErrorMessage={setErrorMessage}
        setStatusMessage={setStatusMessage}
      />
      
      <SocketHandler
        map={map}
        currentLocation={currentLocation}
        setSafetyData={setSafetyData}
        setMarkers={setMarkers}
        setErrorMessage={setErrorMessage}
        setStatusMessage={setStatusMessage}
      />
      // Add this to your SafetyMap component
const [showDebug, setShowDebug] = useState(false);

// Add this inside your return statement
{showDebug && (
  <div className="debug-panel">
    <h3>Debug Info</h3>
    <p>Current Location: {currentLocation ? `${currentLocation.lat.toFixed(5)}, ${currentLocation.lng.toFixed(5)}` : 'None'}</p>
    <p>Map Initialized: {map ? 'Yes' : 'No'}</p>
    <p>Routes: {routes.length}</p>
    <p>Markers: {markers.length}</p>
    <p>Safety Data Points: {safetyData.length}</p>
    <button onClick={() => {
      if (map && currentLocation) {
        // Force route refresh
        fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/safety/routes?location=${encodeURIComponent(JSON.stringify(currentLocation))}&force=true&ts=${Date.now()}`)
          .then(res => res.json())
          .then(data => console.log("Forced routes refresh:", data));
      }
    }}>Force Refresh Routes</button>
  </div>
)}

// Add toggle button
<button 
  onClick={() => setShowDebug(!showDebug)}
  style={{
    position: 'absolute',
    top: '10px',
    right: '10px',
    padding: '5px 10px',
    backgroundColor: '#333',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    zIndex: 100
  }}
>
  {showDebug ? 'Hide Debug' : 'Debug'}
</button>


      {(loadingLocation || loadingRoutes) && (
        <div className="loading-indicator">
          <div className="spinner"></div>
          <div>{loadingLocation ? 'Finding location...' : 'Calculating routes...'}</div>
        </div>
      )}

      {errorMessage && (
        <div className="error-message">
          <div className="error-icon">⚠️</div>
          <div>{errorMessage}</div>
        </div>
      )}

      {statusMessage && (
        <div className="status-message">
          {statusMessage}
        </div>
      )}
    </div>

  );
};

export default SafetyMap;
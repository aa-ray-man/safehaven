import React, { useState, useCallback, useEffect } from 'react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const ReportHandler = ({
  map,
  currentLocation,
  selectedLocation,
  setSelectedLocation,
  safetyData,
  setSafetyData,
  markers,
  setMarkers,
  setErrorMessage,
  setStatusMessage,
}) => {
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportType, setReportType] = useState('unsafe');
  const [reportSeverity, setReportSeverity] = useState(3);
  const [reportDescription, setReportDescription] = useState('');
  const [reportStatus, setReportStatus] = useState('');

  const addReportMarker = (googleMap, report) => {
    if (!report || !report.location) {
      console.error('Invalid report or location:', report);
      return null;
    }

    let position;
    if (report.location.lat !== undefined && report.location.lng !== undefined) {
      position = { lat: Number(report.location.lat), lng: Number(report.location.lng) };
    } else if (report.location.latitude !== undefined && report.location.longitude !== undefined) {
      position = { lat: Number(report.location.latitude), lng: Number(report.location.longitude) };
    } else {
      console.error('Invalid location format:', report.location);
      return null;
    }

    if (isNaN(position.lat) || isNaN(position.lng)) {
      console.error('Latitude or longitude is not a number:', position);
      return null;
    }

    const markerColor = report.type === 'safe' ? '#22c55e' : report.type === 'suspicious' ? '#f97316' : '#ef4444';
    const marker = new window.google.maps.Marker({
      position,
      map: googleMap,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: markerColor,
        fillOpacity: 0.8,
        strokeColor: '#ffffff',
        strokeWeight: 1,
      },
      title: report.description,
    });

    const infoWindow = new window.google.maps.InfoWindow({
      content: `
        <div style="color: #fff; background: ${markerColor}; padding: 8px; border-radius: 5px;">
          <div style="font-weight: 600">${report.type.charAt(0).toUpperCase() + report.type.slice(1)} Area</div>
          <div>${report.description}</div>
          <div style="font-size: 0.85em">Reported: ${new Date(report.timestamp).toLocaleString()}</div>
        </div>`,
    });

    marker.addListener('click', () => infoWindow.open(googleMap, marker));
    return marker;
  };

  const fetchReports = useCallback(
    async (googleMap, location) => {
      try {
        if (!location || (!location.lat && !location.latitude) || (!location.lng && !location.longitude)) {
          console.error('Invalid location for fetchReports:', location);
          throw new Error('Invalid location data for fetching reports');
        }

        const normalizedLocation = {
          lat: Number(location.lat || location.latitude),
          lng: Number(location.lng || location.longitude),
        };

        if (isNaN(normalizedLocation.lat) || isNaN(normalizedLocation.lng)) {
          console.error('Normalized location is invalid:', normalizedLocation);
          throw new Error('Invalid location coordinates');
        }

        const response = await fetch(
          `${API_BASE_URL}/api/safety/reports?location=${encodeURIComponent(JSON.stringify(normalizedLocation))}&radius=1`
        );
        if (response.ok) {
          const rawReports = await response.json();
          const reports = rawReports.map((report) => {
            if (!report || !report.location) {
              console.error('Report missing location:', report);
              return null;
            }
            
            // Handle GeoJSON Point format
            if (report.location.type === 'Point' && Array.isArray(report.location.coordinates)) {
              return {
                ...report,
                location: {
                  lng: report.location.coordinates[0],
                  lat: report.location.coordinates[1]
                }
              };
            }
            
            // Handle direct lat/lng format
            const loc = report.location;
            const lat = Number(loc.lat || loc.latitude);
            const lng = Number(loc.lng || loc.longitude);
            if (isNaN(lat) || isNaN(lng)) {
              console.error('Invalid report location from API:', report);
              return null;
            }
            return { ...report, location: { lat, lng } };
          }).filter(Boolean);
          

          localStorage.setItem('safetyReports', JSON.stringify(reports));

          markers.forEach((marker) => marker.setMap(null));
          const newMarkers = reports.map((report) => addReportMarker(googleMap, report)).filter(Boolean);
          setMarkers(newMarkers);
          setSafetyData(reports);
        } else {
          throw new Error(`Server responded with ${response.status}`);
        }
      } catch (error) {
        console.error('Error in fetchReports:', error);
        setErrorMessage(`Error fetching reports: ${error.message}`);
      }
    },
    [markers, setMarkers, setSafetyData, setErrorMessage]
  );

  const submitReport = async (e) => {
    e.preventDefault();
    const reportLocation = selectedLocation || currentLocation;

    if (!reportLocation || (!reportLocation.lat && !reportLocation.latitude) || (!reportLocation.lng && !reportLocation.longitude)) {
      setReportStatus('error');
      setStatusMessage('Invalid location data');
      console.error('Invalid reportLocation:', reportLocation);
      return;
    }

    const normalizedLocation = {
      lat: Number(reportLocation.lat || reportLocation.latitude),
      lng: Number(reportLocation.lng || reportLocation.longitude),
    };

    if (isNaN(normalizedLocation.lat) || isNaN(normalizedLocation.lng)) {
      setReportStatus('error');
      setStatusMessage('Invalid location coordinates');
      console.error('Normalized location is invalid:', normalizedLocation);
      return;
    }

    if (!reportDescription || reportDescription.length < 5) {
      setReportStatus('error');
      setStatusMessage('Description too short');
      return;
    }

    setReportStatus('submitting');
    setStatusMessage('Submitting report...');

    try {
      const response = await fetch(`${API_BASE_URL}/api/safety/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: normalizedLocation,
          description: reportDescription,
          type: reportType,
          severity: reportSeverity,
        }),
      });

      if (!response.ok) throw new Error('Failed to submit report');

      const data = await response.json();
      setReportDescription('');
      setReportStatus('success');
      setStatusMessage('Report submitted successfully');
      setShowReportForm(false);
      setSelectedLocation(null);

      if (map && data.report) {
        const newMarker = addReportMarker(map, data.report);
        if (newMarker) {
          setMarkers((prev) => [...prev, newMarker]);
          setSafetyData((prev) => [...prev, data.report]);
        }
      }

      setTimeout(() => setReportStatus(''), 5000);
    } catch (error) {
      setReportStatus('error');
      setStatusMessage(`Error: ${error.message}`);
    }
  };

  useEffect(() => {
    if (map && currentLocation) {
      const lat = Number(currentLocation.lat || currentLocation.latitude);
      const lng = Number(currentLocation.lng || currentLocation.longitude);
      if (isNaN(lat) || isNaN(lng)) {
        console.error('Invalid currentLocation in useEffect:', currentLocation);
        setErrorMessage('Current location is invalid');
        return;
      }
      fetchReports(map, currentLocation);
    }
  }, [map, currentLocation, fetchReports, setErrorMessage]);

  return (
    <>
      <div className="control-panel">
        <button className="report-button" onClick={() => setShowReportForm(!showReportForm)}>
          {showReportForm ? 'Close' : 'Submit Report'}
        </button>
      </div>
      {showReportForm && (
        <div className="report-form">
          <form onSubmit={submitReport}>
            <h3>Submit Safety Report</h3>
            <div className="form-group">
              <label>Location</label>
              <div>
                {selectedLocation
                  ? `${Number(selectedLocation.lat || selectedLocation.latitude || 0).toFixed(4)}, ${Number(selectedLocation.lng || selectedLocation.longitude || 0).toFixed(4)}`
                  : currentLocation
                  ? `${Number(currentLocation.lat || currentLocation.latitude || 0).toFixed(4)}, ${Number(currentLocation.lng || currentLocation.longitude || 0).toFixed(4)} (Current)`
                  : 'No location selected'}
              </div>
            </div>
            <div className="form-group">
              <label>Type</label>
              <div className="report-type-selector">
                {['unsafe', 'suspicious', 'incident', 'safe'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={reportType === type ? `selected ${type}` : type}
                    onClick={() => setReportType(type)}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>Severity</label>
              <input
                type="range"
                min="1"
                max="5"
                value={reportSeverity}
                onChange={(e) => setReportSeverity(parseInt(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                placeholder="Describe what you observed..."
                rows="3"
                required
              />
            </div>
            <div className="form-actions">
              <button type="button" onClick={() => setShowReportForm(false)} className="cancel-button">
                Cancel
              </button>
              <button type="submit" className="submit-button" disabled={reportStatus === 'submitting'}>
                {reportStatus === 'submitting' ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};

export default ReportHandler;

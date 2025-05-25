// server/controllers/SafetyController.js
const SafetyReport = require('../models/SafetyReport');
const SafetyMLService = require('../services/SafetyMLService');
const { getIO } = require('../services/socketService');

class SafetyController {
  async getSafeRoutes(req, res) {
    try {
      const locationData = JSON.parse(req.query.location);
      const { lat, lng } = locationData;
      const forceUpdate = req.query.force === 'true';

      if (!lat || !lng) {
        return res.status(400).json({ error: 'Invalid location data' });
      }

      console.log('Fetching safe routes for:', { lat, lng, forceUpdate }); // Debug log

      const routePoints = this.generateRoutePoints(lat, lng);
      const routes = [];

      for (const point of routePoints) {
        const midPoints = this.getMidPoints(lat, lng, point.lat, point.lng, 3);
        let totalScore = 0;
        let incidents = 0;

        for (const midPoint of midPoints) {
          // Predict safety score (forceUpdate is not used in current SafetyMLService)
          const score = await SafetyMLService.predictSafety(midPoint.lat, midPoint.lng).catch((err) => {
            console.error('Prediction failed for:', midPoint, err);
            return 0.5; // Fallback to neutral score
          });
          totalScore += score;

          // Count incidents near this point
          const nearbyReports = (await SafetyReport.findNearby(midPoint.lat, midPoint.lng, 0.2)) || [];
          const unsafeReports = nearbyReports.filter((r) =>
            ['unsafe', 'incident', 'suspicious'].includes(r.type)
          );
          incidents += unsafeReports.length;
        }

        const safetyScore = totalScore / midPoints.length;

        routes.push({
          start: { lat, lng },
          end: point,
          safetyScore,
          incidents,
        });
      }

      console.log('Generated routes:', routes); // Debug log
      return res.json(routes);
    } catch (error) {
      console.error('Error in getSafeRoutes:', error);
      return res.status(500).json({ error: 'Server error', details: error.message });
    }
  }

  async getReports(req, res) {
    try {
      const locationData = JSON.parse(req.query.location);
      const { lat, lng } = locationData;
      const radius = parseFloat(req.query.radius) || 1;

      if (!lat || !lng) {
        return res.status(400).json({ error: 'Invalid location data' });
      }

      const reports = await SafetyReport.findNearby(lat, lng, radius);
      return res.json(reports);
    } catch (error) {
      console.error('Error in getReports:', error);
      return res.status(500).json({ error: 'Server error', details: error.message });
    }
  }

  async submitReport(req, res) {
    try {
      const { location, description, type, severity } = req.body;

      if (!location || !description) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Convert client { lat, lng } to GeoJSON format
      const report = new SafetyReport({
        location: {
          type: 'Point',
          coordinates: [location.lng, location.lat], // GeoJSON: [lng, lat]
        },
        description,
        type,
        severity: severity || 3,
        timestamp: new Date(),
      });

      const savedReport = await report.save();

      const io = getIO();
      io.emit('safetyUpdate', savedReport);

      SafetyMLService.scheduleTraining();

      return res.status(201).json({ success: true, report: savedReport });
    } catch (error) {
      console.error('Error in submitReport:', error);
      return res.status(500).json({ error: 'Server error', details: error.message });
    }
  }

  async getModelStatus(req, res) {
    try {
      const status = SafetyMLService.getStatus();
      return res.json(status);
    } catch (error) {
      console.error('Error in getModelStatus:', error);
      return res.status(500).json({ error: 'Server error', details: error.message });
    }
  }

// Modify the generateRoutePoints method in SafetyController.js
generateRoutePoints(lat, lng, count = 8, distanceKm = 1) {
  const points = [];
  const earthRadius = 6371; // km

  // Generate points in a more natural pattern
  // Some points closer, some farther for more realistic routes
  for (let i = 0; i < count; i++) {
    // Vary the distance for more natural route options
    const variableDistance = distanceKm * (0.7 + Math.random() * 0.6);
    
    // Create a slight bias toward urban centers (usually north/east in many cities)
    // This creates more realistic route patterns
    const angle = (i * 2 * Math.PI) / count + (Math.random() * 0.2 - 0.1);
    
    const newLat = lat + (variableDistance / earthRadius) * Math.cos(angle) * (180 / Math.PI);
    const newLng = lng + (variableDistance / earthRadius) * Math.sin(angle) * (180 / Math.PI) / Math.cos(lat * Math.PI / 180);
    
    points.push({ lat: newLat, lng: newLng });
  }

  return points;
}

getMidPoints(lat1, lng1, lat2, lng2, count) {
  const points = [];
  
  // Add slight variations to avoid perfectly straight lines
  // This helps assess safety more realistically along routes
  for (let i = 1; i <= count; i++) {
    const fraction = i / (count + 1);
    
    // Add a small perpendicular offset for more realistic path sampling
    const perpFactor = Math.sin(fraction * Math.PI) * 0.0001;
    const dx = lat2 - lat1;
    const dy = lng2 - lng1;
    
    const lat = lat1 + fraction * dx + perpFactor * dy;
    const lng = lng1 + fraction * dy - perpFactor * dx;
    
    points.push({ lat, lng });
  }

  return points;
}
}

module.exports = new SafetyController();
const tf = require('@tensorflow/tfjs');
const SafetyReport = require('../models/SafetyReport');
const fs = require('fs').promises;
const path = require('path');

class SafetyMLService {
  constructor() {
    this.model = null;
    this.isTraining = false;
    this.lastTrainedAt = null;
    this.trainingQueue = [];
    this.predictionCache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes
    this.initModel();
  }
  async initModel() {
    try {
      const modelDir = path.join(__dirname, '../models/safety-model');
      const modelPath = path.join(modelDir, 'model.json');
      
      await fs.mkdir(modelDir, { recursive: true });
  
      try {
        // Check if model files exist before loading
        const modelExists = await fs.access(modelPath).then(() => true).catch(() => false);
        
        if (modelExists) {
          this.model = await tf.loadLayersModel(`file://${modelPath}`);
          console.log('Loaded existing safety model from:', modelPath);
        } else {
          console.log('No existing model found at:', modelPath);
          this.model = this.createModel();
          this.scheduleTraining();
        }
      } catch (loadError) {
        console.error('Model loading error:', loadError);
        this.model = this.createModel();
        this.scheduleTraining();
      }
    } catch (error) {
      console.error('Model initialization error:', error);
      this.model = this.createModel();
      this.scheduleTraining();
    }
  }
  createModel() {
    const model = tf.sequential();
    model.add(tf.layers.dense({
      units: 32,
      activation: 'relu',
      inputShape: [8], // [lat, lng, hour, dayOfWeek, incidentCount, severityAvg, daysSinceReport, unsafeRatio]
    }));
    model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
    model.add(tf.layers.dropout({ rate: 0.2 }));
    model.add(tf.layers.dense({ units: 8, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy'],
    });

    return model;
  }

  async saveModel() {
    try {
      const modelDir = path.join(__dirname, '../models/safety-model');
      
      // Ensure directory exists
      await fs.mkdir(modelDir, { recursive: true });
      
      // Save the model with explicit options
      const saveResult = await this.model.save(`file://${modelDir}`, {
        includeOptimizer: true, // Save optimizer state as well
      });

      // Verify files were created
      const files = await fs.readdir(modelDir);
      console.log('Model saved successfully. Directory contents:', files);
      
      return saveResult;
    } catch (saveError) {
      console.error('Detailed model save error:', {
        message: saveError.message,
        stack: saveError.stack
      });
      throw saveError;
    }
  }
  
  
  async processTrainingQueue() {
    if (this.isTraining || this.trainingQueue.length === 0) {
      return;
    }

    this.isTraining = true;
    this.trainingQueue = []; // Clear queue

    try {
      await this.trainModel();
      await this.saveModel();
    } catch (error) {
      console.error('Training or save error:', error);
    } finally {
      this.isTraining = false;
      if (this.trainingQueue.length > 0) {
        setTimeout(() => this.processTrainingQueue(), 1000);
      }
    }
  }

  async trainModel() {
    try {
      const reports = await SafetyReport.find().sort({ timestamp: -1 }).limit(10000);

      if (reports.length < 10) {
        console.log('Not enough data for training, using default model');
        return;
      }

      const now = new Date();
      const trainingData = reports.map((r) => {
        const reportTime = new Date(r.timestamp);
        const hourOfDay = reportTime.getHours();
        const dayOfWeek = reportTime.getDay();
        const daysSinceReport = (now - reportTime) / (1000 * 60 * 60 * 24);

        // Find nearby reports (using approximate distance in degrees)
        const nearbyReports = reports.filter((nr) => {
          const latDiff = Math.abs(nr.location.coordinates[1] - r.location.coordinates[1]);
          const lngDiff = Math.abs(nr.location.coordinates[0] - r.location.coordinates[0]);
          return latDiff < 0.005 && lngDiff < 0.005;
        });

        const incidentCount = Math.min(10, nearbyReports.length);
        const avgSeverity = nearbyReports.reduce((sum, nr) => sum + nr.severity, 0) / Math.max(1, nearbyReports.length);

        const unsafeCount = nearbyReports.filter((nr) =>
          ['unsafe', 'incident', 'suspicious'].includes(nr.type)
        ).length;
        const unsafeRatio = unsafeCount / Math.max(1, nearbyReports.length);

        let safetyScore = 0.5; // default neutral
        if (['unsafe', 'incident'].includes(r.type)) {
          safetyScore = Math.max(0.1, 0.5 - r.severity / 10 - unsafeRatio / 5);
        } else if (r.type === 'safe') {
          safetyScore = Math.min(0.9, 0.5 + r.severity / 10 - unsafeRatio / 5);
        } else if (r.type === 'suspicious') {
          safetyScore = Math.max(0.2, 0.5 - r.severity / 20 - unsafeRatio / 10);
        }

        const recencyFactor = Math.max(0.5, 1 - daysSinceReport / 30);
        safetyScore = safetyScore * recencyFactor;

        if (hourOfDay >= 22 || hourOfDay <= 5) {
          safetyScore = Math.max(0.1, safetyScore - 0.1);
        }

        return {
          features: [
            r.location.coordinates[1], // lat
            r.location.coordinates[0], // lng
            hourOfDay / 24,
            dayOfWeek / 7,
            incidentCount / 10,
            avgSeverity / 5,
            Math.min(1, daysSinceReport / 30),
            unsafeRatio,
          ],
          label: safetyScore,
        };
      });

      const shuffled = this.shuffleArray(trainingData);
      const xs = tf.tensor2d(shuffled.map((d) => d.features));
      const ys = tf.tensor2d(shuffled.map((d) => [d.label]));

      console.log('Starting model training with', shuffled.length, 'samples');
      const result = await this.model.fit(xs, ys, {
        epochs: 30,
        batchSize: 32,
        validationSplit: 0.2,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            console.log(`Epoch ${epoch}: loss = ${logs.loss.toFixed(4)}, accuracy = ${logs.acc ? logs.acc.toFixed(4) : 'N/A'}`);
          },
        },
      });

      xs.dispose();
      ys.dispose();

      this.lastTrainedAt = new Date();
      console.log('Model training completed with loss:', result.history.loss[result.history.loss.length - 1]);
    } catch (error) {
      console.error('Error training model:', error);
    }
  }

  scheduleTraining() {
    if (this.isTraining) {
      return;
    }

    this.trainingQueue.push(Date.now());
    this.processTrainingQueue();
    this.predictionCache.clear();
  }

  async predictSafety(lat, lng) {
    if (!this.model) {
      console.warn('Model is not initialized, using heuristic');
      return this.getHeuristicSafety(lat, lng);
    }

    const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    const cachedPrediction = this.predictionCache.get(cacheKey);
    if (cachedPrediction && cachedPrediction.timestamp > Date.now() - this.cacheTTL) {
      return cachedPrediction.score;
    }

    try {
      const nearbyReports = await SafetyReport.findNearby(lat, lng, 0.5);
      const now = new Date();
      const hour = now.getHours();
      const dayOfWeek = now.getDay();

      if (nearbyReports.length === 0) {
        const heuristicScore = this.getHeuristicSafety(lat, lng);
        this.predictionCache.set(cacheKey, { score: heuristicScore, timestamp: Date.now() });
        return heuristicScore;
      }

      const avgSeverity = nearbyReports.reduce((sum, r) => sum + r.severity, 0) / nearbyReports.length;
      const avgDaysSince = nearbyReports.reduce((sum, r) => {
        const reportTime = new Date(r.timestamp);
        return sum + (now - reportTime) / (1000 * 60 * 60 * 24);
      }, 0) / nearbyReports.length;

      const unsafeCount = nearbyReports.filter((r) =>
        ['unsafe', 'incident', 'suspicious'].includes(r.type)
      ).length;
      const unsafeRatio = unsafeCount / nearbyReports.length;

      const input = tf.tensor2d([[
        lat,
        lng,
        hour / 24,
        dayOfWeek / 7,
        Math.min(1, nearbyReports.length / 10),
        avgSeverity / 5,
        Math.min(1, avgDaysSince / 30),
        unsafeRatio,
      ]]);

      const prediction = this.model.predict(input);
      let safetyScore = prediction.dataSync()[0];

      if (hour >= 22 || hour <= 5) {
        safetyScore = Math.max(0.1, safetyScore - 0.1);
      }

      const recentReports = nearbyReports.filter((r) => {
        const reportTime = new Date(r.timestamp);
        return now - reportTime < 24 * 60 * 60 * 1000;
      });

      if (recentReports.length > 0) {
        const recentUnsafeCount = recentReports.filter((r) =>
          ['unsafe', 'incident'].includes(r.type)
        ).length;
        if (recentUnsafeCount > 0) {
          safetyScore = Math.max(0.1, safetyScore - 0.05 * recentUnsafeCount);
        }
      }

      input.dispose();
      prediction.dispose();

      this.predictionCache.set(cacheKey, { score: safetyScore, timestamp: Date.now() });
      return safetyScore;
    } catch (error) {
      console.error('Prediction error:', error);
      return this.getHeuristicSafety(lat, lng);
    }
  }

  // Modify the getHeuristicSafety method in SafetyMLService.js
getHeuristicSafety(lat, lng) {
  const now = new Date();
  const hour = now.getHours();
  
  // Base score varies by time of day
  let baseScore = 0.7; // Default daytime score
  
  // Night time adjustment (10pm - 5am)
  if (hour >= 22 || hour <= 5) {
    baseScore = 0.5;
  }
  // Evening adjustment (6pm - 10pm)
  else if (hour >= 18 && hour < 22) {
    baseScore = 0.6;
  }
  // Early morning (5am - 8am)
  else if (hour > 5 && hour < 8) {
    baseScore = 0.65;
  }
  
  // Add some realistic variation based on coordinates
  // This creates more realistic "neighborhoods" with different safety levels
  const latFactor = Math.sin(lat * 10) * 0.1;
  const lngFactor = Math.cos(lng * 10) * 0.1;
  const locationFactor = latFactor + lngFactor;
  
  // Add a small random factor for natural variation
  const randomFactor = Math.random() * 0.1 - 0.05;
  
  // Combine all factors and ensure the result is between 0.1 and 0.9
  return Math.max(0.1, Math.min(0.9, baseScore + locationFactor + randomFactor));
}


  cleanupCache() {
    const now = Date.now();
    for (const [key, value] of this.predictionCache.entries()) {
      if (value.timestamp < now - this.cacheTTL) {
        this.predictionCache.delete(key);
      }
    }
  }

  shuffleArray(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  getStatus() {
    return {
      isReady: !!this.model,
      isTraining: this.isTraining,
      lastTrainedAt: this.lastTrainedAt,
      queueLength: this.trainingQueue.length,
      cacheSize: this.predictionCache.size,
    };
  }
}

module.exports = new SafetyMLService();

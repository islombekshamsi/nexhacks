/**
 * Trend Engine
 * Rolling median calculations, baseline tracking, and alert generation
 */

class TrendEngine {
  constructor(options = {}) {
    // Configuration
    this.windowSize = options.windowSize || 30;          // Rolling window samples
    this.baselineWindow = options.baselineWindow || 10;  // Samples for baseline
    this.advisoryThreshold = options.advisoryThreshold || 0.15;  // 15% deviation
    this.criticalThreshold = options.criticalThreshold || 0.30;  // 30% deviation

    // Data buffers for each metric
    this.buffers = {
      pupil_left_size: [],
      pupil_right_size: [],
      face_symmetry: [],
      eye_openness_left: [],
      eye_openness_right: [],
      pupil_asymmetry: []
    };

    // Baselines (established from first N samples)
    this.baselines = {};
    this.baselineEstablished = false;
    this.baselineSamples = 0;

    // Rolling medians
    this.medians = {};

    // Alert state (latched until acknowledged)
    this.alerts = {
      active: [],
      history: []
    };

    // Timestamps
    this.startTime = Date.now();
    this.lastUpdate = null;
  }

  /**
   * Add a new analysis sample
   * @param {Object} analysis - Analysis from Overshoot VLM
   * @returns {Object} Trend data with alerts
   */
  addSample(analysis) {
    if (analysis.signalLost) {
      return this.getSignalLostState();
    }

    const timestamp = Date.now();
    this.lastUpdate = timestamp;

    // Calculate derived metrics
    const pupilAsymmetry = Math.abs(
      analysis.pupil_left_size - analysis.pupil_right_size
    );

    // Add to buffers
    this.addToBuffer('pupil_left_size', analysis.pupil_left_size);
    this.addToBuffer('pupil_right_size', analysis.pupil_right_size);
    this.addToBuffer('face_symmetry', analysis.face_symmetry);
    this.addToBuffer('eye_openness_left', analysis.eye_openness_left);
    this.addToBuffer('eye_openness_right', analysis.eye_openness_right);
    this.addToBuffer('pupil_asymmetry', pupilAsymmetry);

    // Update baselines if not yet established
    if (!this.baselineEstablished) {
      this.baselineSamples++;
      if (this.baselineSamples >= this.baselineWindow) {
        this.establishBaselines();
      }
    }

    // Calculate rolling medians
    this.updateMedians();

    // Check for alerts
    const newAlerts = this.checkAlerts(timestamp);

    // Build trend data
    return {
      timestamp,
      current: {
        pupil_left_size: analysis.pupil_left_size,
        pupil_right_size: analysis.pupil_right_size,
        face_symmetry: analysis.face_symmetry,
        eye_openness_left: analysis.eye_openness_left,
        eye_openness_right: analysis.eye_openness_right,
        pupil_asymmetry: pupilAsymmetry,
        gaze_direction: analysis.gaze_direction,
        confidence: analysis.confidence
      },
      medians: { ...this.medians },
      baselines: this.baselineEstablished ? { ...this.baselines } : null,
      baselineEstablished: this.baselineEstablished,
      baselineProgress: this.baselineEstablished
        ? 1
        : this.baselineSamples / this.baselineWindow,
      deviations: this.baselineEstablished ? this.calculateDeviations() : null,
      alerts: {
        active: [...this.alerts.active],
        new: newAlerts
      },
      signalLost: false,
      latency: analysis.latency
    };
  }

  /**
   * Add value to a metric buffer
   */
  addToBuffer(metric, value) {
    const buffer = this.buffers[metric];
    buffer.push(value);

    // Keep buffer at window size
    while (buffer.length > this.windowSize) {
      buffer.shift();
    }
  }

  /**
   * Establish baselines from initial samples
   */
  establishBaselines() {
    for (const metric of Object.keys(this.buffers)) {
      const buffer = this.buffers[metric];
      if (buffer.length >= this.baselineWindow) {
        this.baselines[metric] = this.calculateMedian(
          buffer.slice(0, this.baselineWindow)
        );
      }
    }
    this.baselineEstablished = true;
    console.log('Baselines established:', this.baselines);
  }

  /**
   * Update rolling medians for all metrics
   */
  updateMedians() {
    for (const metric of Object.keys(this.buffers)) {
      const buffer = this.buffers[metric];
      if (buffer.length > 0) {
        this.medians[metric] = this.calculateMedian(buffer);
      }
    }
  }

  /**
   * Calculate median of an array
   */
  calculateMedian(arr) {
    if (arr.length === 0) return 0;

    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  /**
   * Calculate deviations from baseline
   */
  calculateDeviations() {
    const deviations = {};

    for (const metric of Object.keys(this.baselines)) {
      const baseline = this.baselines[metric];
      const current = this.medians[metric];

      if (baseline !== 0) {
        deviations[metric] = {
          absolute: current - baseline,
          percentage: (current - baseline) / baseline,
          level: this.getDeviationLevel((current - baseline) / baseline)
        };
      } else {
        deviations[metric] = {
          absolute: current,
          percentage: 0,
          level: 'normal'
        };
      }
    }

    return deviations;
  }

  /**
   * Get deviation level based on percentage
   */
  getDeviationLevel(percentage) {
    const absPercent = Math.abs(percentage);
    if (absPercent >= this.criticalThreshold) return 'critical';
    if (absPercent >= this.advisoryThreshold) return 'advisory';
    return 'normal';
  }

  /**
   * Check for new alerts
   */
  checkAlerts(timestamp) {
    if (!this.baselineEstablished) return [];

    const newAlerts = [];
    const deviations = this.calculateDeviations();

    for (const [metric, deviation] of Object.entries(deviations)) {
      // Skip normal deviations
      if (deviation.level === 'normal') continue;

      // Check if alert already exists for this metric
      const existingAlert = this.alerts.active.find(
        a => a.metric === metric && a.level === deviation.level
      );

      if (!existingAlert) {
        const alert = {
          id: `${metric}-${timestamp}`,
          metric,
          level: deviation.level,
          deviation: deviation.percentage,
          baseline: this.baselines[metric],
          current: this.medians[metric],
          timestamp,
          acknowledged: false
        };

        this.alerts.active.push(alert);
        newAlerts.push(alert);
      }
    }

    // Remove alerts that have returned to normal
    this.alerts.active = this.alerts.active.filter(alert => {
      const currentDeviation = deviations[alert.metric];
      if (!currentDeviation) return false;

      // Keep if still at or above the alert level
      if (alert.level === 'critical') {
        return currentDeviation.level === 'critical';
      }
      return currentDeviation.level !== 'normal';
    });

    return newAlerts;
  }

  /**
   * Acknowledge an alert
   * @param {string} alertId - Alert ID to acknowledge
   * @returns {boolean} Success
   */
  acknowledgeAlert(alertId) {
    const alert = this.alerts.active.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = Date.now();
      alert.timeToAck = alert.acknowledgedAt - alert.timestamp;

      // Move to history
      this.alerts.history.push({ ...alert });
      this.alerts.active = this.alerts.active.filter(a => a.id !== alertId);

      return true;
    }
    return false;
  }

  /**
   * Acknowledge all alerts
   */
  acknowledgeAllAlerts() {
    const now = Date.now();
    for (const alert of this.alerts.active) {
      alert.acknowledged = true;
      alert.acknowledgedAt = now;
      alert.timeToAck = now - alert.timestamp;
      this.alerts.history.push({ ...alert });
    }
    this.alerts.active = [];
  }

  /**
   * Get signal lost state
   */
  getSignalLostState() {
    return {
      timestamp: Date.now(),
      signalLost: true,
      current: null,
      medians: { ...this.medians },
      baselines: this.baselineEstablished ? { ...this.baselines } : null,
      baselineEstablished: this.baselineEstablished,
      alerts: {
        active: [...this.alerts.active],
        new: []
      }
    };
  }

  /**
   * Reset the engine (clear all data)
   */
  reset() {
    for (const metric of Object.keys(this.buffers)) {
      this.buffers[metric] = [];
    }
    this.baselines = {};
    this.baselineEstablished = false;
    this.baselineSamples = 0;
    this.medians = {};
    this.alerts = { active: [], history: [] };
    this.startTime = Date.now();
    this.lastUpdate = null;
  }

  /**
   * Get summary statistics
   */
  getSummary() {
    return {
      uptime: Date.now() - this.startTime,
      samplesProcessed: this.buffers.pupil_left_size.length,
      baselineEstablished: this.baselineEstablished,
      baselines: { ...this.baselines },
      currentMedians: { ...this.medians },
      activeAlerts: this.alerts.active.length,
      totalAlerts: this.alerts.history.length + this.alerts.active.length,
      averageTimeToAck: this.calculateAverageTimeToAck()
    };
  }

  /**
   * Calculate average time to acknowledge alerts
   */
  calculateAverageTimeToAck() {
    const ackedAlerts = this.alerts.history.filter(a => a.timeToAck);
    if (ackedAlerts.length === 0) return null;

    const total = ackedAlerts.reduce((sum, a) => sum + a.timeToAck, 0);
    return total / ackedAlerts.length;
  }
}

module.exports = TrendEngine;

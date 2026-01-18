/**
 * Arize Phoenix Logger
 * Observability for neuro monitoring metrics
 */

const { trace, SpanStatusCode } = require('@opentelemetry/api');

class ArizeLogger {
  constructor(options = {}) {
    this.serviceName = options.serviceName || 'neuro-monitor';
    this.endpoint = options.endpoint || process.env.PHOENIX_ENDPOINT || 'http://localhost:6006';

    // In-memory metrics buffer (for when Phoenix isn't available)
    this.metricsBuffer = [];
    this.maxBufferSize = 1000;

    // Aggregate stats
    this.stats = {
      totalAnalyses: 0,
      totalAlerts: 0,
      totalLatency: 0,
      alertsByLevel: { advisory: 0, critical: 0 },
      timeToAckTotal: 0,
      timeToAckCount: 0,
      errors: 0,
      startTime: Date.now()
    };

    // Try to get tracer
    this.tracer = trace.getTracer(this.serviceName);
  }

  /**
   * Log a vision analysis event
   * @param {Object} analysis - Analysis from Overshoot VLM
   * @param {Object} trendData - Trend data from TrendEngine
   */
  logAnalysis(analysis, trendData) {
    const timestamp = Date.now();

    // Update stats
    this.stats.totalAnalyses++;
    if (analysis.latency) {
      this.stats.totalLatency += analysis.latency;
    }

    const metric = {
      type: 'analysis',
      timestamp,
      data: {
        // Core metrics
        pupil_left_size: analysis.pupil_left_size,
        pupil_right_size: analysis.pupil_right_size,
        face_symmetry: analysis.face_symmetry,
        confidence: analysis.confidence,
        latency: analysis.latency,

        // Trend data
        baselineEstablished: trendData?.baselineEstablished,
        activeAlerts: trendData?.alerts?.active?.length || 0,

        // Deviations (if available)
        deviations: trendData?.deviations ? {
          pupil_left: trendData.deviations.pupil_left_size?.percentage,
          pupil_right: trendData.deviations.pupil_right_size?.percentage,
          symmetry: trendData.deviations.face_symmetry?.percentage
        } : null,

        signalLost: analysis.signalLost || false
      }
    };

    this.addToBuffer(metric);

    // Log with OpenTelemetry if available
    if (this.tracer) {
      const span = this.tracer.startSpan('vision_analysis');
      span.setAttribute('pupil_left_size', analysis.pupil_left_size || 0);
      span.setAttribute('pupil_right_size', analysis.pupil_right_size || 0);
      span.setAttribute('face_symmetry', analysis.face_symmetry || 0);
      span.setAttribute('confidence', analysis.confidence || 0);
      span.setAttribute('latency_ms', analysis.latency || 0);
      span.setAttribute('signal_lost', analysis.signalLost || false);
      span.end();
    }
  }

  /**
   * Log an alert event
   * @param {Object} alert - Alert from TrendEngine
   */
  logAlert(alert) {
    const timestamp = Date.now();

    // Update stats
    this.stats.totalAlerts++;
    this.stats.alertsByLevel[alert.level]++;

    const metric = {
      type: 'alert',
      timestamp,
      data: {
        alertId: alert.id,
        metric: alert.metric,
        level: alert.level,
        deviation: alert.deviation,
        baseline: alert.baseline,
        current: alert.current,
        acknowledged: alert.acknowledged
      }
    };

    this.addToBuffer(metric);

    // Log with OpenTelemetry
    if (this.tracer) {
      const span = this.tracer.startSpan('alert_triggered');
      span.setAttribute('alert_id', alert.id);
      span.setAttribute('metric', alert.metric);
      span.setAttribute('level', alert.level);
      span.setAttribute('deviation', alert.deviation);
      span.setStatus({
        code: alert.level === 'critical' ? SpanStatusCode.ERROR : SpanStatusCode.OK
      });
      span.end();
    }

    console.log(`[ALERT] ${alert.level.toUpperCase()}: ${alert.metric} deviated ${(alert.deviation * 100).toFixed(1)}%`);
  }

  /**
   * Log alert acknowledgment
   * @param {Object} alert - Acknowledged alert
   */
  logAcknowledgment(alert) {
    const timestamp = Date.now();

    // Update time-to-ack stats
    if (alert.timeToAck) {
      this.stats.timeToAckTotal += alert.timeToAck;
      this.stats.timeToAckCount++;
    }

    const metric = {
      type: 'acknowledgment',
      timestamp,
      data: {
        alertId: alert.id,
        metric: alert.metric,
        level: alert.level,
        timeToAck: alert.timeToAck
      }
    };

    this.addToBuffer(metric);

    // Log with OpenTelemetry
    if (this.tracer) {
      const span = this.tracer.startSpan('alert_acknowledged');
      span.setAttribute('alert_id', alert.id);
      span.setAttribute('time_to_ack_ms', alert.timeToAck || 0);
      span.end();
    }
  }

  /**
   * Log interrogation session
   * @param {Object} session - Interrogation session data
   */
  logInterrogation(session) {
    const timestamp = Date.now();

    const metric = {
      type: 'interrogation',
      timestamp,
      data: {
        sessionId: session.id,
        questionsAsked: session.questionsAsked,
        questionsAnswered: session.questionsAnswered,
        totalDuration: session.duration,
        averageResponseTime: session.averageResponseTime,
        responses: session.responses
      }
    };

    this.addToBuffer(metric);

    // Log with OpenTelemetry
    if (this.tracer) {
      const span = this.tracer.startSpan('interrogation_session');
      span.setAttribute('session_id', session.id);
      span.setAttribute('questions_asked', session.questionsAsked);
      span.setAttribute('questions_answered', session.questionsAnswered);
      span.setAttribute('duration_ms', session.duration);
      span.setAttribute('avg_response_time_ms', session.averageResponseTime || 0);
      span.end();
    }
  }

  /**
   * Log error
   * @param {string} type - Error type
   * @param {Error|string} error - Error object or message
   */
  logError(type, error) {
    this.stats.errors++;

    const metric = {
      type: 'error',
      timestamp: Date.now(),
      data: {
        errorType: type,
        message: error.message || error,
        stack: error.stack
      }
    };

    this.addToBuffer(metric);

    // Log with OpenTelemetry
    if (this.tracer) {
      const span = this.tracer.startSpan('error');
      span.setAttribute('error_type', type);
      span.setAttribute('error_message', error.message || error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.end();
    }

    console.error(`[ERROR] ${type}:`, error.message || error);
  }

  /**
   * Add metric to buffer
   */
  addToBuffer(metric) {
    this.metricsBuffer.push(metric);

    // Keep buffer size manageable
    while (this.metricsBuffer.length > this.maxBufferSize) {
      this.metricsBuffer.shift();
    }
  }

  /**
   * Get dashboard data
   * @returns {Object} Dashboard metrics
   */
  getDashboard() {
    const uptime = Date.now() - this.stats.startTime;

    return {
      uptime,
      uptimeFormatted: this.formatDuration(uptime),

      // Throughput
      totalAnalyses: this.stats.totalAnalyses,
      analysesPerSecond: this.stats.totalAnalyses / (uptime / 1000),

      // Latency
      averageLatency: this.stats.totalAnalyses > 0
        ? this.stats.totalLatency / this.stats.totalAnalyses
        : 0,

      // Alerts
      totalAlerts: this.stats.totalAlerts,
      alertsByLevel: { ...this.stats.alertsByLevel },

      // Time to acknowledge
      averageTimeToAck: this.stats.timeToAckCount > 0
        ? this.stats.timeToAckTotal / this.stats.timeToAckCount
        : null,

      // Errors
      errors: this.stats.errors,
      errorRate: this.stats.totalAnalyses > 0
        ? this.stats.errors / this.stats.totalAnalyses
        : 0,

      // Recent metrics
      recentMetrics: this.metricsBuffer.slice(-50)
    };
  }

  /**
   * Format duration in human-readable format
   */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }

  /**
   * Export metrics for external analysis
   * @returns {Array} All buffered metrics
   */
  exportMetrics() {
    return [...this.metricsBuffer];
  }

  /**
   * Reset stats (for testing)
   */
  reset() {
    this.metricsBuffer = [];
    this.stats = {
      totalAnalyses: 0,
      totalAlerts: 0,
      totalLatency: 0,
      alertsByLevel: { advisory: 0, critical: 0 },
      timeToAckTotal: 0,
      timeToAckCount: 0,
      errors: 0,
      startTime: Date.now()
    };
  }
}

module.exports = ArizeLogger;

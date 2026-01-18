/**
 * Voice Analyzer - Web Audio API for acoustic biomarker analysis
 * Based on Nature 2024 research for neurological assessment
 * Measures: Jitter, Shimmer, HNR, Pitch, Syllable Rate
 */

class VoiceAnalyzer {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.mediaStream = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;

    // Analysis buffers
    this.pitchBuffer = [];
    this.amplitudeBuffer = [];
    this.sampleRate = 44100;

    // Meyda analyzer for spectral features
    this.meydaAnalyzer = null;
    this.meydaFeatures = [];
  }

  async init() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.sampleRate = this.audioContext.sampleRate;

      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: this.sampleRate
        }
      });

      // Create analyser node
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0;

      // Connect microphone to analyser
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      source.connect(this.analyser);

      console.log('VoiceAnalyzer initialized, sample rate:', this.sampleRate);
      return true;
    } catch (error) {
      console.error('VoiceAnalyzer init error:', error);
      return false;
    }
  }

  /**
   * Start capturing audio for analysis
   * @param {number} durationMs - Duration to record in milliseconds
   * @returns {Promise<Object>} Analysis results
   */
  async startCapture(durationMs) {
    if (!this.audioContext || !this.mediaStream) {
      throw new Error('VoiceAnalyzer not initialized');
    }

    // Resume audio context if suspended
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    this.isRecording = true;
    this.pitchBuffer = [];
    this.amplitudeBuffer = [];
    this.meydaFeatures = [];
    this.audioChunks = [];

    // Setup MediaRecorder for raw audio capture
    this.mediaRecorder = new MediaRecorder(this.mediaStream);
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.audioChunks.push(e.data);
      }
    };
    this.mediaRecorder.start(100); // Collect chunks every 100ms

    // Initialize Meyda if available
    if (window.Meyda) {
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.meydaAnalyzer = Meyda.createMeydaAnalyzer({
        audioContext: this.audioContext,
        source: source,
        bufferSize: 2048,
        featureExtractors: ['rms', 'spectralCentroid', 'spectralFlatness', 'zcr'],
        callback: (features) => {
          if (this.isRecording && features) {
            this.meydaFeatures.push({
              rms: features.rms || 0,
              spectralCentroid: features.spectralCentroid || 0,
              spectralFlatness: features.spectralFlatness || 0,
              zcr: features.zcr || 0,
              timestamp: Date.now()
            });
          }
        }
      });
      this.meydaAnalyzer.start();
    }

    // Real-time analysis loop
    const frameSize = 2048;
    const timeData = new Float32Array(frameSize);
    const analysisInterval = 50; // Analyze every 50ms

    return new Promise((resolve) => {
      const analyzeLoop = setInterval(() => {
        if (!this.isRecording) {
          clearInterval(analyzeLoop);
          return;
        }

        this.analyser.getFloatTimeDomainData(timeData);

        // Calculate pitch using autocorrelation
        const pitch = this.calculatePitch(timeData);
        if (pitch > 50 && pitch < 500) { // Valid human voice range
          this.pitchBuffer.push(pitch);
        }

        // Calculate RMS amplitude
        const rms = this.calculateRMS(timeData);
        this.amplitudeBuffer.push(rms);

      }, analysisInterval);

      // Stop after duration
      setTimeout(async () => {
        this.isRecording = false;
        clearInterval(analyzeLoop);

        if (this.meydaAnalyzer) {
          this.meydaAnalyzer.stop();
        }

        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        }

        // Wait for final chunks
        await new Promise(r => setTimeout(r, 200));

        // Calculate all metrics
        const results = this.calculateAllMetrics();
        resolve(results);

      }, durationMs);
    });
  }

  /**
   * Stop recording early
   */
  stopCapture() {
    this.isRecording = false;
    if (this.meydaAnalyzer) {
      this.meydaAnalyzer.stop();
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }

  /**
   * Calculate pitch using autocorrelation (YIN-like algorithm)
   * @param {Float32Array} buffer - Audio samples
   * @returns {number} Fundamental frequency in Hz
   */
  calculatePitch(buffer) {
    const minPeriod = Math.floor(this.sampleRate / 500); // Max 500Hz
    const maxPeriod = Math.floor(this.sampleRate / 50);  // Min 50Hz

    let bestCorrelation = 0;
    let bestPeriod = 0;

    // Autocorrelation
    for (let period = minPeriod; period < maxPeriod && period < buffer.length / 2; period++) {
      let correlation = 0;
      let norm1 = 0;
      let norm2 = 0;

      for (let i = 0; i < buffer.length - period; i++) {
        correlation += buffer[i] * buffer[i + period];
        norm1 += buffer[i] * buffer[i];
        norm2 += buffer[i + period] * buffer[i + period];
      }

      const normalizedCorrelation = correlation / Math.sqrt(norm1 * norm2 + 1e-10);

      if (normalizedCorrelation > bestCorrelation) {
        bestCorrelation = normalizedCorrelation;
        bestPeriod = period;
      }
    }

    if (bestCorrelation > 0.5 && bestPeriod > 0) {
      return this.sampleRate / bestPeriod;
    }

    return 0;
  }

  /**
   * Calculate RMS (Root Mean Square) amplitude
   * @param {Float32Array} buffer - Audio samples
   * @returns {number} RMS value
   */
  calculateRMS(buffer) {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  }

  /**
   * Calculate Jitter - pitch period variability
   * Formula: (1/(N-1)) * Sum|T(i) - T(i+1)| / Mean(T)
   * @returns {number} Jitter percentage
   */
  calculateJitter() {
    if (this.pitchBuffer.length < 3) return 0;

    // Convert frequencies to periods
    const periods = this.pitchBuffer.map(f => 1 / f);

    let sumDiff = 0;
    let sumPeriod = 0;

    for (let i = 0; i < periods.length - 1; i++) {
      sumDiff += Math.abs(periods[i] - periods[i + 1]);
      sumPeriod += periods[i];
    }
    sumPeriod += periods[periods.length - 1];

    const meanPeriod = sumPeriod / periods.length;
    const jitter = (sumDiff / (periods.length - 1)) / meanPeriod;

    return jitter * 100; // Return as percentage
  }

  /**
   * Calculate Shimmer - amplitude variability
   * Formula: (1/(N-1)) * Sum|A(i) - A(i+1)| / Mean(A)
   * @returns {number} Shimmer percentage
   */
  calculateShimmer() {
    if (this.amplitudeBuffer.length < 3) return 0;

    // Filter out very quiet samples (likely silence)
    const amps = this.amplitudeBuffer.filter(a => a > 0.01);
    if (amps.length < 3) return 0;

    let sumDiff = 0;
    let sumAmp = 0;

    for (let i = 0; i < amps.length - 1; i++) {
      sumDiff += Math.abs(amps[i] - amps[i + 1]);
      sumAmp += amps[i];
    }
    sumAmp += amps[amps.length - 1];

    const meanAmp = sumAmp / amps.length;
    const shimmer = (sumDiff / (amps.length - 1)) / meanAmp;

    return shimmer * 100; // Return as percentage
  }

  /**
   * Calculate HNR (Harmonics-to-Noise Ratio)
   * Simplified estimation using spectral flatness
   * @returns {number} HNR in dB
   */
  calculateHNR() {
    if (this.meydaFeatures.length === 0) {
      // Fallback estimation from pitch stability
      if (this.pitchBuffer.length < 5) return 15;

      const mean = this.pitchBuffer.reduce((a, b) => a + b, 0) / this.pitchBuffer.length;
      const variance = this.pitchBuffer.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / this.pitchBuffer.length;
      const cv = Math.sqrt(variance) / mean; // Coefficient of variation

      // Lower CV = more harmonic = higher HNR
      return Math.max(5, Math.min(35, 30 - cv * 100));
    }

    // Use spectral flatness from Meyda
    const avgFlatness = this.meydaFeatures.reduce((sum, f) => sum + f.spectralFlatness, 0) / this.meydaFeatures.length;

    // Flatness of 0 = pure tone (infinite HNR), flatness of 1 = white noise (0 HNR)
    // Convert to dB scale (typical range 5-35 dB)
    const hnr = Math.max(5, Math.min(35, -10 * Math.log10(avgFlatness + 0.001)));

    return hnr;
  }

  /**
   * Calculate pitch range (F0 variation)
   * @returns {number} Pitch range in Hz
   */
  calculatePitchRange() {
    if (this.pitchBuffer.length < 5) return 0;

    // Remove outliers using IQR
    const sorted = [...this.pitchBuffer].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;

    const filtered = sorted.filter(p => p >= q1 - 1.5 * iqr && p <= q3 + 1.5 * iqr);

    if (filtered.length < 3) return 0;

    return filtered[filtered.length - 1] - filtered[0];
  }

  /**
   * Detect syllables for DDK test (pa-ta-ka)
   * @returns {Object} Syllable analysis {count, rate, regularity}
   */
  detectSyllables() {
    if (this.amplitudeBuffer.length < 10) {
      return { count: 0, rate: 0, regularity: 0 };
    }

    // Smooth the amplitude envelope
    const smoothed = this.smoothArray(this.amplitudeBuffer, 3);

    // Find peaks (syllable onsets)
    const threshold = Math.max(...smoothed) * 0.3;
    const minPeakDistance = 3; // Minimum samples between peaks

    const peaks = [];
    for (let i = 1; i < smoothed.length - 1; i++) {
      if (smoothed[i] > threshold &&
          smoothed[i] > smoothed[i - 1] &&
          smoothed[i] >= smoothed[i + 1]) {
        if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minPeakDistance) {
          peaks.push(i);
        }
      }
    }

    const count = peaks.length;

    // Calculate rate (syllables per second)
    // amplitudeBuffer is sampled every 50ms
    const durationSeconds = (this.amplitudeBuffer.length * 50) / 1000;
    const rate = count / durationSeconds;

    // Calculate regularity (coefficient of variation of inter-peak intervals)
    let regularity = 1;
    if (peaks.length > 2) {
      const intervals = [];
      for (let i = 1; i < peaks.length; i++) {
        intervals.push(peaks[i] - peaks[i - 1]);
      }
      const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance = intervals.reduce((sum, i) => sum + Math.pow(i - mean, 2), 0) / intervals.length;
      const cv = Math.sqrt(variance) / mean;
      regularity = Math.max(0, 1 - cv); // 1 = perfectly regular, 0 = highly irregular
    }

    return { count, rate, regularity };
  }

  /**
   * Calculate loudness variation (in dB)
   * @returns {number} Loudness variation in dB
   */
  calculateLoudnessVariation() {
    if (this.amplitudeBuffer.length < 5) return 0;

    // Filter out silence
    const amps = this.amplitudeBuffer.filter(a => a > 0.01);
    if (amps.length < 5) return 0;

    // Convert to dB
    const dBValues = amps.map(a => 20 * Math.log10(a + 1e-10));

    const mean = dBValues.reduce((a, b) => a + b, 0) / dBValues.length;
    const variance = dBValues.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / dBValues.length;

    return Math.sqrt(variance);
  }

  /**
   * Estimate speech rate from amplitude patterns
   * @returns {number} Estimated words per minute
   */
  estimateSpeechRate() {
    const syllables = this.detectSyllables();
    // Average English word has ~1.5 syllables
    return (syllables.rate * 60) / 1.5;
  }

  /**
   * Calculate pause ratio
   * @returns {number} Ratio of silent time to total time (0-1)
   */
  calculatePauseRatio() {
    if (this.amplitudeBuffer.length < 5) return 0;

    const threshold = 0.02; // Silence threshold
    const silentSamples = this.amplitudeBuffer.filter(a => a < threshold).length;

    return silentSamples / this.amplitudeBuffer.length;
  }

  /**
   * Smooth an array using moving average
   * @param {Array} arr - Input array
   * @param {number} windowSize - Window size for averaging
   * @returns {Array} Smoothed array
   */
  smoothArray(arr, windowSize) {
    const result = [];
    for (let i = 0; i < arr.length; i++) {
      let sum = 0;
      let count = 0;
      for (let j = Math.max(0, i - windowSize); j <= Math.min(arr.length - 1, i + windowSize); j++) {
        sum += arr[j];
        count++;
      }
      result.push(sum / count);
    }
    return result;
  }

  /**
   * Calculate all metrics and return comprehensive results
   * @returns {Object} All voice biomarker metrics
   */
  calculateAllMetrics() {
    const jitter = this.calculateJitter();
    const shimmer = this.calculateShimmer();
    const hnr = this.calculateHNR();
    const pitchRange = this.calculatePitchRange();
    const syllableData = this.detectSyllables();
    const loudnessVariation = this.calculateLoudnessVariation();
    const speechRate = this.estimateSpeechRate();
    const pauseRatio = this.calculatePauseRatio();

    // Calculate mean pitch
    const meanPitch = this.pitchBuffer.length > 0
      ? this.pitchBuffer.reduce((a, b) => a + b, 0) / this.pitchBuffer.length
      : 0;

    return {
      // Core phonation metrics
      jitter: parseFloat(jitter.toFixed(3)),
      shimmer: parseFloat(shimmer.toFixed(3)),
      hnr: parseFloat(hnr.toFixed(1)),

      // Pitch metrics
      meanPitch: parseFloat(meanPitch.toFixed(1)),
      pitchRange: parseFloat(pitchRange.toFixed(1)),

      // DDK metrics
      syllableCount: syllableData.count,
      syllableRate: parseFloat(syllableData.rate.toFixed(2)),
      syllableRegularity: parseFloat(syllableData.regularity.toFixed(2)),

      // Prosody metrics
      loudnessVariation: parseFloat(loudnessVariation.toFixed(2)),
      speechRate: parseFloat(speechRate.toFixed(0)),
      pauseRatio: parseFloat(pauseRatio.toFixed(3)),

      // Raw data counts (for debugging)
      pitchSamples: this.pitchBuffer.length,
      amplitudeSamples: this.amplitudeBuffer.length,
      meydaSamples: this.meydaFeatures.length,

      timestamp: Date.now()
    };
  }

  /**
   * Get real-time audio level (0-1)
   * @returns {number} Current audio level
   */
  getLevel() {
    if (!this.analyser) return 0;

    const dataArray = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(dataArray);

    return this.calculateRMS(dataArray);
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.meydaAnalyzer) {
      this.meydaAnalyzer.stop();
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}

// Export for use in other modules
window.VoiceAnalyzer = VoiceAnalyzer;

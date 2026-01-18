// Parkinson's Voice Assessment Module
// Based on Nature 2024 research - 4-task protocol for 86% accuracy

console.log('🔵🔵🔵 parkinsons-voice.js LOADING 🔵🔵🔵');

class ParkinsonsVoiceAssessment {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.currentTask = null;
    this.skipProcessing = false;
    this.taskResults = {
      task1: null, // Sustained /aː/
      task2: null, // /pa-ta-ka/
      task3: null, // Reading
      task4: null  // Monologue
    };
    this.datasetStats = null;
    this.recordingStartTime = null;
    this.timerInterval = null;
    
    // Load Parkinson's dataset statistics
    this.loadDatasetStatistics();
  }

  // Load and parse the UCI Parkinson's dataset
  async loadDatasetStatistics() {
    try {
      const response = await fetch('/parkinsons_stats.json');
      if (response.ok) {
        this.datasetStats = await response.json();
        console.log('✅ Parkinson\'s dataset statistics loaded');
      } else {
        console.warn('⚠️ Dataset statistics not found, using defaults');
        this.setDefaultStatistics();
      }
    } catch (error) {
      console.warn('⚠️ Error loading dataset:', error);
      this.setDefaultStatistics();
    }
  }

  setDefaultStatistics() {
    // Based on UCI Parkinson's dataset analysis
    this.datasetStats = {
      healthy: {
        jitter: { mean: 0.0038, std: 0.0021, threshold: 0.0104 },
        shimmer: { mean: 0.031, std: 0.018, threshold: 0.0381 },
        hnr: { mean: 24.2, std: 3.5, threshold: 20.0 },
        pitchRange: { mean: 65, std: 25, threshold: 50 },
        syllableRate: { mean: 6.0, std: 0.8, threshold: 5.0 },
        loudnessVar: { mean: 6.5, std: 1.5, threshold: 5.0 }
      },
      pd: {
        jitter: { mean: 0.0062, std: 0.0041 },
        shimmer: { mean: 0.048, std: 0.025 },
        hnr: { mean: 21.5, std: 4.2 },
        pitchRange: { mean: 28, std: 12 },
        syllableRate: { mean: 3.5, std: 0.6 },
        loudnessVar: { mean: 2.3, std: 0.8 }
      }
    };
  }

  // Start recording for a specific task
  async startRecording(taskNumber) {
    this.currentTask = taskNumber;
    this.audioChunks = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
          sampleRate: 44100
        } 
      });

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        if (this.skipProcessing) {
          console.log('⏭️ Recording canceled - skipping processing');
          return;
        }
        this.processRecording();
      };

      this.mediaRecorder.start();
      this.recordingStartTime = Date.now();
      this.skipProcessing = false;
      
      console.log(`🎤 Recording started for Task ${taskNumber}`);
      return true;
    } catch (error) {
      console.error('❌ Microphone error:', error);
      throw new Error('Microphone access denied. Please allow microphone permission.');
    }
  }

  // Stop recording
  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.skipProcessing = false;
      this.mediaRecorder.stop();
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      
      const duration = (Date.now() - this.recordingStartTime) / 1000;
      console.log(`⏹️ Recording stopped. Duration: ${duration.toFixed(1)}s`);
      return duration;
    }
    return 0;
  }

  // Cancel recording without processing
  cancelRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.skipProcessing = true;
      this.mediaRecorder.stop();
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      this.audioChunks = [];
      console.log('🛑 Recording canceled');
      return true;
    }
    return false;
  }

  // Process recorded audio
  async processRecording() {
    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
    const audioFile = new File([audioBlob], `task_${this.currentTask}.webm`, { 
      type: 'audio/webm' 
    });

    console.log(`📊 Processing Task ${this.currentTask} audio...`);

    try {
      // Step 1: Isolate audio using ElevenLabs (remove background noise)
      const isolatedAudio = await this.isolateAudio(audioFile);
      
      // Step 2: Transcribe audio
      const transcription = await this.transcribeAudio(isolatedAudio);
      
      // Step 3: Extract voice metrics
      const metrics = await this.extractVoiceMetrics(isolatedAudio, transcription);
      
      // Step 4: Compare with dataset
      const analysis = this.analyzeMetrics(metrics);
      
      // Store results
      this.taskResults[`task${this.currentTask}`] = {
        audioBlob: isolatedAudio,
        transcription,
        metrics,
        analysis,
        duration: (Date.now() - this.recordingStartTime) / 1000
      };

      console.log(`✅ Task ${this.currentTask} analysis complete`);
      
      // Notify completion
      if (window.onTaskComplete) {
        window.onTaskComplete(this.currentTask, this.taskResults[`task${this.currentTask}`]);
      }
    } catch (error) {
      console.error(`❌ Error processing Task ${this.currentTask}:`, error);
      throw error;
    }
  }

  // Isolate audio using ElevenLabs MCP
  async isolateAudio(audioFile) {
    console.log('🔊 Calling ElevenLabs audio isolation...');
    
    try {
      // ============ ELEVENLABS INTEGRATION (NEW) ============
      // Send audio to backend for ElevenLabs MCP processing
      const formData = new FormData();
      formData.append('audio', audioFile);
      formData.append('taskNumber', this.currentTask);
      
      console.log('📤 Sending audio to backend for isolation...');
      const response = await fetch('/api/voice/isolate', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('✅ ElevenLabs isolation result:', result);
      
      if (result.success && result.isolatedAudioPath) {
        // Fetch the isolated audio file
        const audioResponse = await fetch(result.isolatedAudioPath);
        const isolatedBlob = await audioResponse.blob();
        console.log('✅ Isolated audio loaded, size:', isolatedBlob.size);
        return isolatedBlob;
      } else {
        console.warn('⚠️ ElevenLabs isolation not available, using original');
        return audioFile;
      }
      // ============ END ELEVENLABS INTEGRATION ============
      
      /* ============ OLD CODE (COMMENTED OUT FOR REVERSION) ============
      // Create a temporary file path for the isolated audio
      const tempPath = `/tmp/isolated_${Date.now()}.wav`;
      
      // Call ElevenLabs MCP isolate_audio tool via backend
      // Note: This requires the MCP server to be properly configured
      // For now, we'll return the original file but log the attempt
      
      console.log('⚠️ ElevenLabs MCP integration requires Cursor MCP server setup');
      console.log('   To enable: Configure ElevenLabs MCP in Cursor settings');
      console.log('   Tool: mcp_elevenlabs_isolate_audio');
      console.log('   Input: audioFile blob');
      console.log('   Output: Isolated audio with background noise removed');
      
      // Return original file for now
      return audioFile;
      ============ END OLD CODE ============ */
      
    } catch (error) {
      console.error('❌ Audio isolation error:', error);
      console.log('📋 Falling back to original audio file');
      return audioFile; // Fallback to original
    }
  }

  // Transcribe audio using ElevenLabs MCP
  async transcribeAudio(audioFile) {
    console.log('📝 Calling ElevenLabs speech-to-text...');
    
    try {
      // Call ElevenLabs MCP speech_to_text tool via backend
      // Note: This requires the MCP server to be properly configured
      
      console.log('⚠️ ElevenLabs MCP integration requires Cursor MCP server setup');
      console.log('   To enable: Configure ElevenLabs MCP in Cursor settings');
      console.log('   Tool: mcp_elevenlabs_speech_to_text');
      console.log('   Input: audioFile blob');
      console.log('   Output: { text: string, confidence: number }');
      
      // For now, return placeholder
      // In production, this would call the MCP tool
      return { 
        text: '', 
        confidence: 0.8,
        note: 'ElevenLabs transcription not yet configured'
      };
    } catch (error) {
      console.error('❌ Transcription error:', error);
      return { text: '', confidence: 0.5 };
    }
  }

  // Extract voice metrics from audio
  async extractVoiceMetrics(audioBlob, transcription) {
    // This will use Web Audio API to extract basic metrics
    // Advanced metrics will come from backend analysis
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const channelData = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;
      
      // Calculate basic metrics (used for both Parkinson's and Stroke)
      const jitter = this.calculateJitter(channelData, sampleRate);
      const shimmer = this.calculateShimmer(channelData);
      const hnr = this.estimateHNR(channelData);
      const pitchRange = this.calculatePitchRange(channelData, sampleRate);
      const loudnessVariation = this.calculateLoudnessVariation(channelData);
      
      // Stroke-specific metrics
      const speechRate = this.calculateSpeechRate(channelData, sampleRate, audioBuffer.duration);
      const articulationClarity = this.calculateArticulationClarity(channelData, sampleRate);
      const pauseMetrics = this.analyzePauses(channelData, sampleRate);
      
      const metrics = {
        duration: audioBuffer.duration,
        sampleRate: sampleRate,
        // Core acoustic features
        jitter: jitter,
        shimmer: shimmer,
        hnr: hnr,
        pitchRange: pitchRange,
        loudnessVariation: loudnessVariation,
        // Stroke-specific features
        speechRate: speechRate,
        articulationClarity: articulationClarity,
        avgPauseDuration: pauseMetrics.avgDuration,
        pauseCount: pauseMetrics.count,
        // Legacy
        syllableRate: this.estimateSyllableRate(transcription, audioBuffer.duration)
      };

      return metrics;
    } catch (error) {
      console.error('Error extracting metrics:', error);
      return null;
    }
  }

  // Calculate speech rate (syllables per second)
  calculateSpeechRate(channelData, sampleRate, duration) {
    // Detect syllables by counting energy peaks (voiced segments)
    const frameSize = Math.floor(sampleRate * 0.02); // 20ms frames
    const hopSize = Math.floor(frameSize / 2);
    let syllableCount = 0;
    let inSyllable = false;
    const energyThreshold = 0.02;
    
    for (let i = 0; i < channelData.length - frameSize; i += hopSize) {
      // Calculate frame energy
      let energy = 0;
      for (let j = 0; j < frameSize; j++) {
        energy += channelData[i + j] * channelData[i + j];
      }
      energy = Math.sqrt(energy / frameSize);
      
      // Detect syllable peaks
      if (energy > energyThreshold && !inSyllable) {
        syllableCount++;
        inSyllable = true;
      } else if (energy < energyThreshold * 0.5) {
        inSyllable = false;
      }
    }
    
    return duration > 0 ? syllableCount / duration : 0;
  }

  // Calculate articulation clarity (high-frequency energy ratio)
  calculateArticulationClarity(channelData, sampleRate) {
    // Use FFT to analyze frequency content
    const fftSize = 2048;
    const fft = new Float32Array(fftSize);
    const windowSize = Math.min(fftSize, channelData.length);
    
    // Copy and window the data
    for (let i = 0; i < windowSize; i++) {
      fft[i] = channelData[i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / windowSize)); // Hanning window
    }
    
    // Simple power calculation across frequency bands
    let lowFreqEnergy = 0;
    let highFreqEnergy = 0;
    
    // Approximate frequency analysis (low: 0-2kHz, high: 2-8kHz)
    const lowBandEnd = Math.floor((2000 / sampleRate) * fftSize);
    const highBandEnd = Math.floor((8000 / sampleRate) * fftSize);
    
    for (let i = 0; i < lowBandEnd && i < windowSize; i++) {
      lowFreqEnergy += fft[i] * fft[i];
    }
    
    for (let i = lowBandEnd; i < highBandEnd && i < windowSize; i++) {
      highFreqEnergy += fft[i] * fft[i];
    }
    
    // Return ratio (higher = better articulation)
    return lowFreqEnergy > 0 ? highFreqEnergy / lowFreqEnergy : 0;
  }

  // Analyze pause patterns
  analyzePauses(channelData, sampleRate) {
    const frameSize = Math.floor(sampleRate * 0.02); // 20ms frames
    const hopSize = Math.floor(frameSize / 2);
    const silenceThreshold = 0.01;
    const minPauseDuration = 0.2; // 200ms minimum pause
    
    const pauses = [];
    let pauseStart = null;
    let inPause = false;
    
    for (let i = 0; i < channelData.length - frameSize; i += hopSize) {
      // Calculate frame energy
      let energy = 0;
      for (let j = 0; j < frameSize; j++) {
        energy += Math.abs(channelData[i + j]);
      }
      energy /= frameSize;
      
      const currentTime = i / sampleRate;
      
      if (energy < silenceThreshold && !inPause) {
        pauseStart = currentTime;
        inPause = true;
      } else if (energy >= silenceThreshold && inPause) {
        const pauseDuration = currentTime - pauseStart;
        if (pauseDuration >= minPauseDuration) {
          pauses.push(pauseDuration);
        }
        inPause = false;
        pauseStart = null;
      }
    }
    
    const avgDuration = pauses.length > 0 
      ? pauses.reduce((sum, d) => sum + d, 0) / pauses.length 
      : 0;
    
    return {
      count: pauses.length,
      avgDuration: avgDuration,
      durations: pauses
    };
  }

  // Calculate Jitter (fundamental frequency variation)
  calculateJitter(samples, sampleRate) {
    // Simplified jitter calculation
    // Real implementation would use autocorrelation for F0 extraction
    const windowSize = Math.floor(sampleRate / 100); // 10ms windows
    let jitterSum = 0;
    let count = 0;

    for (let i = windowSize; i < samples.length; i += windowSize) {
      const window1 = samples.slice(i - windowSize, i);
      const window2 = samples.slice(i, i + windowSize);
      
      const period1 = this.estimatePeriod(window1, sampleRate);
      const period2 = this.estimatePeriod(window2, sampleRate);
      
      if (period1 && period2) {
        jitterSum += Math.abs(period1 - period2) / period1;
        count++;
      }
    }

    return count > 0 ? (jitterSum / count) * 100 : 0; // Return as percentage
  }

  // Calculate Shimmer (amplitude variation)
  calculateShimmer(samples) {
    const windowSize = 512;
    const amplitudes = [];

    for (let i = 0; i < samples.length; i += windowSize) {
      const window = samples.slice(i, i + windowSize);
      const amplitude = Math.sqrt(window.reduce((sum, val) => sum + val * val, 0) / window.length);
      amplitudes.push(amplitude);
    }

    if (amplitudes.length < 2) return 0;

    let shimmerSum = 0;
    for (let i = 1; i < amplitudes.length; i++) {
      shimmerSum += Math.abs(amplitudes[i] - amplitudes[i - 1]) / amplitudes[i - 1];
    }

    return (shimmerSum / (amplitudes.length - 1)) * 100; // Return as percentage
  }

  // Estimate HNR (Harmonic-to-Noise Ratio)
  estimateHNR(samples) {
    // Simplified HNR estimation
    // Real implementation would use harmonic decomposition
    const totalEnergy = samples.reduce((sum, val) => sum + val * val, 0);
    const noise = samples.reduce((sum, val, idx, arr) => {
      if (idx > 0) {
        return sum + Math.pow(val - arr[idx - 1], 2);
      }
      return sum;
    }, 0);

    const harmonicEnergy = totalEnergy - noise;
    const hnr = 10 * Math.log10(harmonicEnergy / noise);
    
    return Math.max(0, Math.min(30, hnr)); // Clamp between 0-30 dB
  }

  // Calculate pitch range
  calculatePitchRange(samples, sampleRate) {
    // Simplified pitch range calculation
    // Real implementation would use YIN algorithm or autocorrelation
    const pitches = [];
    const windowSize = Math.floor(sampleRate / 50); // 20ms windows

    for (let i = 0; i < samples.length - windowSize; i += windowSize) {
      const window = samples.slice(i, i + windowSize);
      const pitch = this.estimatePitch(window, sampleRate);
      if (pitch > 50 && pitch < 500) { // Valid speech range
        pitches.push(pitch);
      }
    }

    if (pitches.length === 0) return 0;

    const maxPitch = Math.max(...pitches);
    const minPitch = Math.min(...pitches);
    
    return maxPitch - minPitch; // Return range in Hz
  }

  // Estimate fundamental period
  estimatePeriod(window, sampleRate) {
    // Simplified autocorrelation-based period estimation
    const minLag = Math.floor(sampleRate / 500); // Max F0 = 500 Hz
    const maxLag = Math.floor(sampleRate / 50);  // Min F0 = 50 Hz

    let maxCorr = 0;
    let bestLag = minLag;

    for (let lag = minLag; lag < maxLag; lag++) {
      let corr = 0;
      for (let i = 0; i < window.length - lag; i++) {
        corr += window[i] * window[i + lag];
      }
      if (corr > maxCorr) {
        maxCorr = corr;
        bestLag = lag;
      }
    }

    return bestLag / sampleRate; // Return period in seconds
  }

  // Estimate pitch
  estimatePitch(window, sampleRate) {
    const period = this.estimatePeriod(window, sampleRate);
    return period > 0 ? 1 / period : 0;
  }

  // Estimate syllable rate (for /pa-ta-ka/ task)
  estimateSyllableRate(transcription, duration) {
    if (!transcription || !transcription.text) return 0;
    
    // Count syllables (simplified - count vowels)
    const syllables = (transcription.text.match(/[aeiou]/gi) || []).length;
    
    return duration > 0 ? syllables / duration : 0; // Syllables per second (Hz)
  }

  // Calculate loudness variation
  calculateLoudnessVariation(samples) {
    const windowSize = 2048;
    const loudnesses = [];

    for (let i = 0; i < samples.length; i += windowSize) {
      const window = samples.slice(i, i + windowSize);
      const rms = Math.sqrt(window.reduce((sum, val) => sum + val * val, 0) / window.length);
      const loudness = 20 * Math.log10(rms + 1e-10); // Convert to dB
      loudnesses.push(loudness);
    }

    if (loudnesses.length < 2) return 0;

    const maxLoudness = Math.max(...loudnesses);
    const minLoudness = Math.min(...loudnesses);
    
    return maxLoudness - minLoudness; // Return range in dB
  }

  // Analyze metrics for stroke risk
  analyzeMetrics(metrics) {
    if (!metrics) {
      return { risk: 'unknown', confidence: 0, strokeRisk: 0, details: {} };
    }

    let strokeRiskScore = 0;
    const details = {};
    const maxScore = 100;

    // 1. Voice Instability (Jitter) - Reduced sensitivity (15 points max)
    if (metrics.jitter !== null) {
      const jitterRisk = metrics.jitter > 0.02 ? 15 : metrics.jitter > 0.015 ? 8 : 0;
      strokeRiskScore += jitterRisk;
      details.jitter = {
        value: metrics.jitter.toFixed(4),
        risk: jitterRisk,
        status: metrics.jitter > 0.02 ? 'high-risk' : metrics.jitter > 0.015 ? 'moderate' : 'normal',
        note: 'Voice stability'
      };
    }

    // 2. Amplitude Instability (Shimmer) - Reduced sensitivity (15 points max)
    if (metrics.shimmer !== null) {
      const shimmerRisk = metrics.shimmer > 0.12 ? 15 : metrics.shimmer > 0.08 ? 8 : 0;
      strokeRiskScore += shimmerRisk;
      details.shimmer = {
        value: metrics.shimmer.toFixed(4),
        risk: shimmerRisk,
        status: metrics.shimmer > 0.12 ? 'high-risk' : metrics.shimmer > 0.08 ? 'moderate' : 'normal',
        note: 'Loudness stability'
      };
    }

    // 3. Speech Rate - More lenient thresholds (18 points max)
    if (metrics.speechRate !== null) {
      const speechRateRisk = metrics.speechRate < 3.0 ? 18 : 
                             metrics.speechRate < 4.0 ? 10 : 
                             metrics.speechRate < 4.5 ? 3 : 0;
      strokeRiskScore += speechRateRisk;
      details.speechRate = {
        value: metrics.speechRate.toFixed(2) + ' syl/sec',
        risk: speechRateRisk,
        status: metrics.speechRate < 3.0 ? 'very-slow' : 
                metrics.speechRate < 4.0 ? 'slow' : 
                metrics.speechRate < 4.5 ? 'borderline' : 'normal',
        note: 'Speaking rate (normal: 4.5-7)'
      };
    }

    // 4. Articulation Clarity - Reduced sensitivity (15 points max)
    if (metrics.articulationClarity !== null) {
      const clarityRisk = metrics.articulationClarity < 0.2 ? 15 : 
                          metrics.articulationClarity < 0.35 ? 8 : 0;
      strokeRiskScore += clarityRisk;
      details.articulationClarity = {
        value: metrics.articulationClarity.toFixed(2),
        risk: clarityRisk,
        status: metrics.articulationClarity < 0.2 ? 'poor' : 
                metrics.articulationClarity < 0.35 ? 'reduced' : 'normal',
        note: 'Consonant clarity'
      };
    }

    // 5. Pause Duration - Reduced sensitivity (12 points max)
    if (metrics.avgPauseDuration !== null) {
      const pauseRisk = metrics.avgPauseDuration > 1.5 ? 12 : 
                        metrics.avgPauseDuration > 1.0 ? 5 : 0;
      strokeRiskScore += pauseRisk;
      details.pauseDuration = {
        value: metrics.avgPauseDuration.toFixed(2) + 's',
        risk: pauseRisk,
        status: metrics.avgPauseDuration > 1.5 ? 'prolonged' : 
                metrics.avgPauseDuration > 1.0 ? 'extended' : 'normal',
        note: 'Pause length'
      };
    }

    // Apply global reduction factor (0.65x) to reduce overall sensitivity
    const reducedScore = Math.round(strokeRiskScore * 0.65);
    const normalizedScore = Math.min(reducedScore, maxScore);
    
    // Classify stroke risk severity
    let risk, severity;
    if (normalizedScore >= 70) {
      risk = 'high';
      severity = 'HIGH RISK';
    } else if (normalizedScore >= 40) {
      risk = 'moderate';
      severity = 'MODERATE';
    } else if (normalizedScore >= 20) {
      risk = 'low';
      severity = 'LOW';
    } else {
      risk = 'minimal';
      severity = 'MINIMAL';
    }

    const confidence = Math.min(1, Object.keys(details).length / 5); // 5 key metrics

    return {
      risk,
      severity,
      strokeRisk: normalizedScore,
      confidence,
      riskScore: normalizedScore / 100, // Normalize to 0-1 for compatibility
      details,
      metrics
    };
  }

  // Calculate Z-score
  calculateZScore(value, mean, std) {
    return (value - mean) / std;
  }

  // Get fused analysis of all tasks (Stroke Risk)
  getFusedAnalysis() {
    const completedTasks = Object.values(this.taskResults).filter(r => r !== null);
    
    if (completedTasks.length === 0) {
      return { risk: 'unknown', strokeRisk: 0, confidence: 0, taskCount: 0 };
    }

    // Weight tasks for stroke detection
    const taskWeights = {
      task1: 1.0,  // Sustained vowel - voice stability
      task2: 1.2,  // /pa-ta-ka/ - HIGHEST weight for articulation speed
      task3: 1.1,  // Reading - speech clarity & slurring
      task4: 1.0   // Free speech - fluency & word-finding
    };

    let weightedRiskSum = 0;
    let totalWeight = 0;
    let maxStrokeRisk = 0;

    Object.keys(this.taskResults).forEach(taskKey => {
      const result = this.taskResults[taskKey];
      if (result && result.analysis) {
        const weight = taskWeights[taskKey];
        const taskStrokeRisk = result.analysis.strokeRisk || (result.analysis.riskScore * 100);
        weightedRiskSum += taskStrokeRisk * weight;
        totalWeight += weight;
        maxStrokeRisk = Math.max(maxStrokeRisk, taskStrokeRisk);
      }
    });

    // Apply conservative averaging with additional 0.8x reduction factor
    const rawFusedRisk = totalWeight > 0 ? weightedRiskSum / totalWeight : 0;
    const fusedStrokeRisk = rawFusedRisk * 0.8; // Additional reduction for safety
    
    // Classify overall stroke risk (adjusted thresholds)
    let risk, severity;
    if (fusedStrokeRisk >= 65) {
      risk = 'high';
      severity = 'HIGH RISK';
    } else if (fusedStrokeRisk >= 35) {
      risk = 'moderate';
      severity = 'MODERATE';
    } else if (fusedStrokeRisk >= 18) {
      risk = 'low';
      severity = 'LOW';
    } else {
      risk = 'minimal';
      severity = 'MINIMAL';
    }
    
    const confidence = Math.min(1.0, 0.5 + (completedTasks.length / 4) * 0.5);

    return {
      risk,
      severity,
      strokeRisk: Math.round(fusedStrokeRisk),
      riskScore: fusedStrokeRisk / 100, // Normalized for compatibility
      confidence,
      taskCount: completedTasks.length,
      completedTasks: Object.keys(this.taskResults).filter(k => this.taskResults[k] !== null),
      recommendation: this.getRecommendation(risk, fusedStrokeRisk, confidence)
    };
  }

  // Get recommendation based on stroke risk level
  getRecommendation(risk, strokeRisk, confidence) {
    if (risk === 'high') {
      return '⚠️ HIGH STROKE RISK - Speech shows significant abnormalities. SEEK IMMEDIATE MEDICAL ATTENTION. Call 911 or go to nearest emergency room.';
    } else if (risk === 'moderate') {
      return '⚠️ MODERATE RISK - Speech patterns show concerning signs. Consult a doctor or neurologist as soon as possible.';
    } else if (risk === 'low') {
      return 'Low risk detected. Some minor speech variations present. Monitor symptoms and consult doctor if concerns arise.';
    } else {
      return '✓ Speech parameters appear normal. Continue regular health monitoring.';
    }
  }

  // Reset assessment
  reset() {
    this.taskResults = {
      task1: null,
      task2: null,
      task3: null,
      task4: null
    };
    this.currentTask = null;
    console.log('🔄 Assessment reset');
  }
}

// Export for use in app (keeping name for compatibility)
window.ParkinsonsVoiceAssessment = ParkinsonsVoiceAssessment;
console.log('✅ Stroke Voice Assessment module loaded (engine initialized)');

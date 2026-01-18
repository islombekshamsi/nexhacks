/**
 * Neuro Change Monitor - Main App
 * Flow: 30 second eye test -> Voice questions -> Risk Assessment
 */

class NeuroMonitorApp {
  constructor() {
    this.video = null;
    this.canvas = null;
    this.ctx = null;
    this.stream = null;

    // Components
    this.faceTracker = null;
    this.tts = null;
    this.strokeAnalyzer = null;
    this.voiceAnalyzer = null;
    this.voiceProtocol = null;

    // Voice biomarker results
    this.voiceBiomarkers = null;

    // Test state
    this.state = 'idle';
    this.eyeTestDuration = 30;
    this.eyeTestTimer = null;
    this.eyeTestStartTime = null;
    this.analysisInterval = null;

    // Voice test
    this.currentQuestion = 0;
    this.questionTimer = null;
    this.questionStartTime = null;
    this.waitingForAnswer = false;

    // Speech recognition
    this.recognition = null;
    this.currentTranscript = '';
    this.finalTranscript = '';

    // Charts
    this.charts = null;

    // UI
    this.ui = {};

    this.init();
  }

  async init() {
    console.log('Initializing Neuro Monitor...');

    this.ui = {
      video: document.getElementById('webcam'),
      canvas: document.getElementById('overlay'),
      status: document.getElementById('connectionStatus'),
      startBtn: document.getElementById('startBtn'),
      signalLost: document.getElementById('signalLost'),
      leftPupil: document.getElementById('leftPupilValue'),
      rightPupil: document.getElementById('rightPupilValue'),
      symmetry: document.getElementById('symmetryValue'),
      confidence: document.getElementById('confidenceValue'),
      modal: document.getElementById('interrogationModal'),
      questionText: document.getElementById('questionText'),
      questionProgress: document.getElementById('questionProgress'),
      transcript: document.getElementById('transcript'),
      timerValue: document.getElementById('timerValue'),
      listeningIndicator: document.getElementById('listeningIndicator'),
      summaryModal: document.getElementById('summaryModal'),
      summaryContent: document.getElementById('summaryContent'),
      summaryJson: document.getElementById('summaryJson'),
      skipBtn: document.getElementById('skipQuestionBtn'),
      cancelBtn: document.getElementById('cancelInterrogationBtn'),
      closeSummaryBtn: document.getElementById('closeSummaryBtn')
    };

    this.video = this.ui.video;
    this.canvas = this.ui.canvas;
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
    }

    // Initialize charts
    if (window.NeuroCharts) {
      this.charts = new window.NeuroCharts();
    }

    // Initialize face tracker
    if (window.FaceTracker) {
      this.faceTracker = new window.FaceTracker();
      this.updateStatus('Loading AI models...');
      await this.faceTracker.init();
    }

    // Initialize TTS
    if (window.BrowserTTS) {
      this.tts = new window.BrowserTTS();
    }

    // Initialize stroke analyzer
    if (window.StrokeAnalyzer) {
      this.strokeAnalyzer = new window.StrokeAnalyzer();
    }

    // Initialize voice analyzer for clinical protocol
    if (window.VoiceAnalyzer) {
      this.voiceAnalyzer = new window.VoiceAnalyzer();
    }

    // Initialize voice protocol
    if (window.VoiceProtocol && this.voiceAnalyzer) {
      this.voiceProtocol = new window.VoiceProtocol({
        voiceAnalyzer: this.voiceAnalyzer,
        tts: this.tts,
        onProgress: (progress) => this.onVoiceProtocolProgress(progress),
        onComplete: (results) => this.onVoiceProtocolComplete(results),
        onLevelUpdate: (level) => this.onAudioLevelUpdate(level)
      });
    }

    // Initialize speech recognition
    this.initSpeechRecognition();

    // Setup buttons
    this.setupEventListeners();

    // Start webcam
    await this.startWebcam();

    this.updateStatus('Ready');
    console.log('Initialization complete');
  }

  setupEventListeners() {
    if (this.ui.startBtn) {
      this.ui.startBtn.addEventListener('click', () => this.startTest());
    }
    if (this.ui.skipBtn) {
      this.ui.skipBtn.addEventListener('click', () => this.skipQuestion());
    }
    if (this.ui.cancelBtn) {
      this.ui.cancelBtn.addEventListener('click', () => this.cancelTest());
    }
    if (this.ui.closeSummaryBtn) {
      this.ui.closeSummaryBtn.addEventListener('click', () => {
        this.ui.summaryModal?.classList.add('hidden');
        this.resetToIdle();
      });
    }
  }

  async startWebcam() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false
      });

      this.video.srcObject = this.stream;
      await this.video.play();

      if (this.canvas) {
        this.canvas.width = this.video.videoWidth || 640;
        this.canvas.height = this.video.videoHeight || 480;
      }
      console.log('Webcam started');
    } catch (error) {
      console.error('Webcam error:', error);
      this.updateStatus('Camera Error');
    }
  }

  updateStatus(text) {
    if (this.ui.status) {
      this.ui.status.textContent = text;
      this.ui.status.className = 'status-badge ' +
        (text === 'Ready' || text === 'Complete' ? 'connected' :
         text.includes('Error') ? 'error' : 'pending');
    }
  }

  // ==================== MAIN TEST FLOW ====================

  startTest() {
    console.log('Starting test...');
    this.state = 'eye_test';

    // Reset analyzer
    if (this.strokeAnalyzer) {
      this.strokeAnalyzer.reset();
    }

    this.ui.startBtn.textContent = 'Test Running...';
    this.ui.startBtn.disabled = true;
    this.updateStatus('Eye Test');

    this.startEyeTest();
  }

  // ==================== EYE TEST ====================

  startEyeTest() {
    console.log('Eye test starting (30 seconds)...');
    this.eyeTestStartTime = Date.now();

    // Show modal
    if (this.ui.modal) {
      this.ui.modal.classList.remove('hidden');
    }
    if (this.ui.questionText) {
      this.ui.questionText.innerHTML = '<strong>Eye Test</strong><br>Please look directly at the camera.<br>Keep your head still and eyes open.';
    }
    if (this.ui.questionProgress) {
      this.ui.questionProgress.textContent = 'Calibrating...';
    }
    if (this.ui.listeningIndicator) {
      this.ui.listeningIndicator.classList.add('hidden');
    }

    // Hide transcript area during eye test
    const transcriptDisplay = document.getElementById('transcriptDisplay');
    if (transcriptDisplay) transcriptDisplay.classList.add('hidden');

    // Start analysis
    this.analysisInterval = setInterval(() => this.analyzeFrame(), 500);
    this.eyeTestTimer = setInterval(() => this.updateEyeTestTimer(), 100);
  }

  async analyzeFrame() {
    if (!this.faceTracker || !this.video) return;

    try {
      const analysis = await this.faceTracker.analyze(this.video);

      if (analysis && !analysis.signalLost) {
        this.showSignalLost(false);
        this.updateDisplayValues(analysis);

        // Store in analyzer
        if (this.strokeAnalyzer && this.state === 'eye_test') {
          this.strokeAnalyzer.addEyeData(analysis);
        }

        this.updateCharts(analysis);
      } else {
        this.showSignalLost(true);
      }
    } catch (error) {
      console.error('Analysis error:', error);
    }
  }

  updateEyeTestTimer() {
    const elapsed = (Date.now() - this.eyeTestStartTime) / 1000;
    const remaining = Math.max(0, this.eyeTestDuration - elapsed);

    if (this.ui.timerValue) {
      this.ui.timerValue.textContent = remaining.toFixed(1) + 's';
    }
    if (this.ui.questionProgress) {
      this.ui.questionProgress.textContent = `${Math.floor(elapsed)}/${this.eyeTestDuration} seconds`;
    }

    if (remaining <= 0) {
      this.completeEyeTest();
    }
  }

  completeEyeTest() {
    console.log('Eye test complete');
    clearInterval(this.eyeTestTimer);

    // Hide the interrogation modal
    this.ui.modal?.classList.add('hidden');

    // Start clinical voice protocol instead of simple questions
    this.state = 'voice_protocol';
    this.updateStatus('Voice Assessment');

    if (this.ui.questionText) {
      this.ui.questionText.innerHTML = '<strong>Voice Assessment</strong><br>Preparing clinical voice analysis...';
    }

    // Start voice protocol after brief delay
    setTimeout(() => this.startVoiceProtocol(), 1500);
  }

  // ==================== CLINICAL VOICE PROTOCOL ====================

  async startVoiceProtocol() {
    console.log('Starting clinical voice protocol...');

    if (!this.voiceProtocol) {
      console.error('Voice protocol not initialized');
      // Fall back to simple voice test
      this.state = 'voice_test';
      this.currentQuestion = 0;
      this.updateStatus('Voice Test');
      this.ui.modal?.classList.remove('hidden');
      setTimeout(() => this.startVoiceTest(), 500);
      return;
    }

    // Initialize voice analyzer if needed
    if (this.voiceAnalyzer && !this.voiceAnalyzer.audioContext) {
      try {
        await this.voiceAnalyzer.init();
      } catch (error) {
        console.error('Failed to init voice analyzer:', error);
      }
    }

    // Start the protocol
    await this.voiceProtocol.start();
  }

  onVoiceProtocolProgress(progress) {
    console.log('Voice protocol progress:', progress);
    // Could update a progress indicator here
  }

  onAudioLevelUpdate(level) {
    // Update audio visualizer if needed
    const canvas = document.getElementById('audioVisualizer');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      const width = canvas.width;
      const height = canvas.height;

      // Clear
      ctx.fillStyle = '#1a1a25';
      ctx.fillRect(0, 0, width, height);

      // Draw level bar
      const barWidth = level * width * 5; // Scale for visibility
      const gradient = ctx.createLinearGradient(0, 0, barWidth, 0);
      gradient.addColorStop(0, '#4aff9e');
      gradient.addColorStop(1, '#4a9eff');

      ctx.fillStyle = gradient;
      ctx.fillRect(0, height / 4, Math.min(barWidth, width), height / 2);
    }
  }

  onVoiceProtocolComplete(results) {
    console.log('Voice protocol complete:', results);

    if (results.cancelled) {
      this.cancelTest();
      return;
    }

    // Store voice biomarker results
    this.voiceBiomarkers = results;

    // Add to stroke analyzer if available
    if (this.strokeAnalyzer && results.aggregated) {
      this.strokeAnalyzer.addVoiceBiomarkers({
        ...results.aggregated,
        updrsScore: results.updrsScore?.score || 0,
        updrsLabel: results.updrsScore?.label || 'Unknown',
        clinicalInterpretation: results.clinicalInterpretation
      });
    }

    // Complete the test
    this.completeTest();
  }

  // ==================== VOICE TEST ====================

  async startVoiceTest() {
    console.log('Voice test starting...');

    // Start speech recognition
    if (this.recognition) {
      try {
        this.recognition.start();
        console.log('Speech recognition started');
      } catch (e) {
        console.log('Speech recognition error:', e.message);
      }
    }

    await this.askQuestion();
  }

  async askQuestion() {
    const questions = window.SCREENING_QUESTIONS || [];

    if (this.currentQuestion >= questions.length) {
      this.completeTest();
      return;
    }

    const q = questions[this.currentQuestion];
    console.log(`Asking question ${this.currentQuestion + 1}: ${q.text}`);

    // Reset state
    this.waitingForAnswer = false;
    this.currentTranscript = '';
    this.finalTranscript = '';

    // Update UI
    if (this.ui.questionText) {
      this.ui.questionText.innerHTML = `<strong>Question ${this.currentQuestion + 1}</strong><br>${q.text}`;
    }
    if (this.ui.questionProgress) {
      this.ui.questionProgress.textContent = `Question ${this.currentQuestion + 1} of ${questions.length}`;
    }
    if (this.ui.transcript) {
      this.ui.transcript.textContent = 'Waiting...';
    }
    if (this.ui.listeningIndicator) {
      this.ui.listeningIndicator.classList.add('hidden');
    }

    // Speak the question
    if (this.tts) {
      await this.tts.speak(q.text);
    }

    // Now wait for answer
    this.waitingForAnswer = true;
    this.questionStartTime = Date.now();

    if (this.ui.transcript) {
      this.ui.transcript.textContent = 'Listening...';
    }
    if (this.ui.listeningIndicator) {
      this.ui.listeningIndicator.classList.remove('hidden');
    }

    // Set timeout for this question
    this.questionTimer = setTimeout(() => {
      console.log('Question timed out');
      this.recordAndNext('(no response)');
    }, q.timeout || 15000);
  }

  recordAndNext(answer) {
    if (!this.waitingForAnswer) return;
    this.waitingForAnswer = false;

    // Clear timer
    clearTimeout(this.questionTimer);

    const responseTime = Date.now() - this.questionStartTime;
    const questions = window.SCREENING_QUESTIONS || [];
    const q = questions[this.currentQuestion];

    console.log(`Answer recorded: "${answer}" (${responseTime}ms)`);

    // Store in analyzer
    if (this.strokeAnalyzer) {
      this.strokeAnalyzer.addVoiceResponse({
        question: q?.text || '',
        questionId: q?.id || '',
        answer: answer,
        responseTime: responseTime
      });
    }

    // Update UI
    if (this.ui.transcript) {
      this.ui.transcript.textContent = answer;
    }
    if (this.ui.listeningIndicator) {
      this.ui.listeningIndicator.classList.add('hidden');
    }

    // Next question
    this.currentQuestion++;
    setTimeout(() => this.askQuestion(), 1500);
  }

  skipQuestion() {
    if (this.state !== 'voice_test') return;
    console.log('Question skipped');
    this.recordAndNext('(skipped)');
  }

  // ==================== COMPLETE ====================

  completeTest() {
    console.log('Test complete');

    // Stop everything
    clearInterval(this.analysisInterval);
    clearTimeout(this.questionTimer);

    if (this.recognition) {
      try { this.recognition.stop(); } catch(e) {}
    }
    if (this.tts) {
      this.tts.stop();
    }

    this.state = 'complete';
    this.updateStatus('Complete');

    // Get risk assessment
    const assessment = this.strokeAnalyzer?.getCombinedAssessment();

    // Show summary
    this.showSummary(assessment);
  }

  showSummary(assessment) {
    // Hide question modal
    this.ui.modal?.classList.add('hidden');

    // Show summary modal
    if (this.ui.summaryModal) {
      this.ui.summaryModal.classList.remove('hidden');
    }

    if (!assessment) {
      if (this.ui.summaryContent) {
        this.ui.summaryContent.innerHTML = '<p>No assessment data available.</p>';
      }
      return;
    }

    // Build summary HTML
    let html = '';

    // Overall Risk
    const riskColor = assessment.overallRisk === 'HIGH' ? '#ff4444' :
                      assessment.overallRisk === 'MODERATE' ? '#ffaa00' : '#44ff44';

    html += `
      <div class="risk-summary" style="background: ${riskColor}22; border-left: 4px solid ${riskColor}; padding: 15px; margin-bottom: 20px;">
        <h3 style="color: ${riskColor}; margin: 0;">Risk Level: ${assessment.overallRisk}</h3>
        <p style="margin: 10px 0 0 0;">${assessment.recommendation}</p>
      </div>
    `;

    // Eye Test Results
    html += '<div class="summary-section"><h4>Eye Test Analysis</h4>';
    if (assessment.eyeAnalysis.metrics) {
      html += `<p>Samples analyzed: ${assessment.eyeAnalysis.metrics.samples}</p>`;
      html += `<p>Left pupil avg: ${assessment.eyeAnalysis.metrics.avgPupilLeft}mm</p>`;
      html += `<p>Right pupil avg: ${assessment.eyeAnalysis.metrics.avgPupilRight}mm</p>`;
      html += `<p>Pupil difference: ${assessment.eyeAnalysis.metrics.pupilDiff}mm</p>`;
      html += `<p>Face symmetry: ${assessment.eyeAnalysis.metrics.avgSymmetry}%</p>`;
    }

    if (assessment.eyeAnalysis.indicators?.length > 0) {
      html += '<div class="indicators">';
      for (const ind of assessment.eyeAnalysis.indicators) {
        const indColor = ind.type === 'CRITICAL' ? '#ff4444' : '#ffaa00';
        html += `<p style="color: ${indColor};"><strong>${ind.type}:</strong> ${ind.name} - ${ind.detail}</p>`;
      }
      html += '</div>';
    } else {
      html += '<p style="color: #44ff44;">No concerning eye indicators detected.</p>';
    }
    html += '</div>';

    // Voice Test Results (simple cognitive questions)
    if (assessment.voiceAnalysis.metrics && !this.voiceBiomarkers) {
      html += '<div class="summary-section"><h4>Voice Test Analysis</h4>';
      html += `<p>Questions: ${assessment.voiceAnalysis.metrics.totalQuestions}</p>`;
      html += `<p>Answered: ${assessment.voiceAnalysis.metrics.answered}</p>`;
      html += `<p>Response rate: ${assessment.voiceAnalysis.metrics.responseRate}</p>`;

      if (assessment.voiceAnalysis.indicators?.length > 0) {
        html += '<div class="indicators">';
        for (const ind of assessment.voiceAnalysis.indicators) {
          const indColor = ind.type === 'CRITICAL' ? '#ff4444' : '#ffaa00';
          html += `<p style="color: ${indColor};"><strong>${ind.type}:</strong> ${ind.name} - ${ind.detail}</p>`;
        }
        html += '</div>';
      } else {
        html += '<p style="color: #44ff44;">No concerning voice indicators detected.</p>';
      }
      html += '</div>';
    }

    // Disclaimer
    html += `<div class="disclaimer" style="margin-top: 20px; padding: 10px; background: #333; font-size: 12px;">
      <strong>Disclaimer:</strong> ${assessment.disclaimer}
    </div>`;

    if (this.ui.summaryContent) {
      this.ui.summaryContent.innerHTML = html;
    }

    // Voice Biomarkers Section (clinical protocol results)
    this.displayVoiceBiomarkers();

    // Build JSON for export
    const exportData = {
      ...assessment,
      voiceBiomarkers: this.voiceBiomarkers || null
    };

    if (this.ui.summaryJson) {
      this.ui.summaryJson.textContent = JSON.stringify(exportData, null, 2);
    }
  }

  displayVoiceBiomarkers() {
    const section = document.getElementById('voiceBiomarkersSection');
    if (!section) return;

    if (!this.voiceBiomarkers || !this.voiceBiomarkers.aggregated) {
      section.classList.add('hidden');
      return;
    }

    section.classList.remove('hidden');

    const metrics = this.voiceBiomarkers.aggregated;
    const updrs = this.voiceBiomarkers.updrsScore || {};

    // UPDRS Score
    const updrsScoreEl = document.getElementById('updrsScore');
    const updrsLabelEl = document.getElementById('updrsLabel');
    if (updrsScoreEl) {
      updrsScoreEl.textContent = updrs.score ?? '--';
      // Add severity class
      updrsScoreEl.className = 'updrs-value';
      if (updrs.score === 1) updrsScoreEl.classList.add('slight');
      else if (updrs.score === 2) updrsScoreEl.classList.add('mild');
      else if (updrs.score === 3) updrsScoreEl.classList.add('moderate');
      else if (updrs.score >= 4) updrsScoreEl.classList.add('severe');
    }
    if (updrsLabelEl) {
      updrsLabelEl.textContent = updrs.label || 'Unknown';
    }

    // Clinical interpretation
    const interpEl = document.getElementById('clinicalInterpretation');
    if (interpEl && this.voiceBiomarkers.clinicalInterpretation) {
      interpEl.textContent = this.voiceBiomarkers.clinicalInterpretation;
    }

    // Biomarker values with thresholds
    const thresholds = {
      jitter: { healthy: 1.04, unit: '%', inverse: false },
      shimmer: { healthy: 3.81, unit: '%', inverse: false },
      hnr: { healthy: 20, unit: 'dB', inverse: true },
      syllableRate: { healthy: 5.0, unit: 'Hz', inverse: true },
      pitchRange: { healthy: 50, unit: 'Hz', inverse: true },
      speechRate: { healthy: 120, unit: 'wpm', inverse: true }
    };

    for (const [key, config] of Object.entries(thresholds)) {
      const valueEl = document.getElementById(key + 'Value');
      const cardEl = valueEl?.closest('.biomarker-card');

      if (valueEl && metrics[key] !== null && metrics[key] !== undefined) {
        const value = metrics[key];
        valueEl.textContent = typeof value === 'number' ? value.toFixed(2) : '--';

        // Determine status
        let status = 'healthy';
        if (config.inverse) {
          // Lower is worse (HNR, syllable rate, pitch range, speech rate)
          if (value < config.healthy * 0.5) status = 'critical';
          else if (value < config.healthy) status = 'warning';
        } else {
          // Higher is worse (jitter, shimmer)
          if (value > config.healthy * 2) status = 'critical';
          else if (value > config.healthy) status = 'warning';
        }

        valueEl.className = 'biomarker-value ' + status;
        if (cardEl) cardEl.className = 'biomarker-card ' + status;
      }
    }

    // Voice indicators
    const indicatorsEl = document.getElementById('voiceIndicators');
    if (indicatorsEl && updrs.flags && updrs.flags.length > 0) {
      let indicatorsHtml = '';
      for (const flag of updrs.flags) {
        const severity = flag.severity === 'severe' || flag.severity === 'moderate' ? 'critical' : 'warning';
        const metricNames = {
          jitter: 'Vocal Jitter',
          shimmer: 'Amplitude Shimmer',
          hnr: 'Harmonics-to-Noise Ratio',
          syllableRate: 'Syllable Rate',
          pitchRange: 'Pitch Range',
          loudnessVariation: 'Loudness Variation'
        };
        const name = metricNames[flag.metric] || flag.metric;
        indicatorsHtml += `
          <div class="voice-indicator ${severity}">
            <span class="voice-indicator-text"><strong>${flag.severity.toUpperCase()}:</strong> ${name} (${flag.value?.toFixed(2)})</span>
          </div>
        `;
      }
      indicatorsEl.innerHTML = indicatorsHtml;
    } else if (indicatorsEl) {
      indicatorsEl.innerHTML = '<p style="color: #44ff44; text-align: center;">All voice biomarkers within healthy range.</p>';
    }
  }

  cancelTest() {
    console.log('Test cancelled');

    clearInterval(this.analysisInterval);
    clearInterval(this.eyeTestTimer);
    clearTimeout(this.questionTimer);

    if (this.recognition) try { this.recognition.stop(); } catch(e) {}
    if (this.tts) this.tts.stop();

    this.ui.modal?.classList.add('hidden');
    this.resetToIdle();
  }

  resetToIdle() {
    this.state = 'idle';
    this.voiceBiomarkers = null;
    this.ui.startBtn.textContent = 'Start Monitoring';
    this.ui.startBtn.disabled = false;
    this.updateStatus('Ready');
  }

  // ==================== UI HELPERS ====================

  updateDisplayValues(analysis) {
    if (this.ui.leftPupil) {
      this.ui.leftPupil.textContent = analysis.pupil_left_size.toFixed(1) + 'mm';
    }
    if (this.ui.rightPupil) {
      this.ui.rightPupil.textContent = analysis.pupil_right_size.toFixed(1) + 'mm';
    }
    if (this.ui.symmetry) {
      this.ui.symmetry.textContent = analysis.face_symmetry.toFixed(0) + '%';
    }
    if (this.ui.confidence) {
      this.ui.confidence.textContent = (analysis.confidence * 100).toFixed(0) + '%';
    }
  }

  updateCharts(analysis) {
    if (!this.charts) return;

    this.charts.updateCharts({
      timestamp: Date.now(),
      pupilLeft: analysis.pupil_left_size,
      pupilRight: analysis.pupil_right_size,
      symmetry: analysis.face_symmetry / 100,
      trendPupilLeft: analysis.pupil_left_size,
      trendPupilRight: analysis.pupil_right_size,
      trendSymmetry: analysis.face_symmetry / 100
    });
  }

  showSignalLost(show) {
    if (this.ui.signalLost) {
      this.ui.signalLost.classList.toggle('hidden', !show);
    }
  }

  // ==================== SPEECH RECOGNITION ====================

  initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 1;

    this.recognition.onresult = (event) => {
      if (!this.waitingForAnswer) return;

      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      // Update display
      const displayText = final || interim || 'Listening...';
      if (this.ui.transcript) {
        this.ui.transcript.textContent = displayText;
      }

      // If we got a final result with actual content
      if (final && final.trim().length > 0) {
        console.log('Final transcript:', final);
        this.recordAndNext(final.trim());
      }
    };

    this.recognition.onerror = (event) => {
      console.log('Speech recognition error:', event.error);
      if (event.error === 'no-speech' && this.state === 'voice_test') {
        // Restart if no speech detected
        try { this.recognition.start(); } catch(e) {}
      }
    };

    this.recognition.onend = () => {
      console.log('Speech recognition ended');
      if (this.state === 'voice_test') {
        try { this.recognition.start(); } catch(e) {}
      }
    };

    console.log('Speech recognition initialized');
  }
}

// Start
document.addEventListener('DOMContentLoaded', () => {
  window.app = new NeuroMonitorApp();
});

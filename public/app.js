/**
 * Neuro Change Monitor - Frontend App
 * WebSocket connection, webcam capture, and mode management
 */

class NeuroMonitorApp {
  constructor() {
    // WebSocket connection
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;

    // Webcam and canvas
    this.video = null;
    this.canvas = null;
    this.ctx = null;
    this.stream = null;
    this.captureInterval = null;
    this.captureRate = 1000; // 1 frame per second

    // Mode state
    this.mode = 'monitoring'; // 'monitoring' or 'interrogation'
    this.interrogationState = {
      currentQuestion: 0,
      answers: [],
      startTime: null
    };

    // Speech recognition
    this.recognition = null;
    this.currentTranscript = '';

    // Alert state
    this.activeAlerts = new Map();

    // Charts (initialized in charts.js)
    this.charts = null;

    // UI elements
    this.elements = {};

    this.init();
  }

  async init() {
    console.log('Initializing Neuro Monitor App...');

    // Get UI elements
    this.elements = {
      video: document.getElementById('webcam'),
      canvas: document.getElementById('canvas'),
      statusIndicator: document.getElementById('status-indicator'),
      statusText: document.getElementById('status-text'),
      modeToggle: document.getElementById('mode-toggle'),
      signalLost: document.getElementById('signal-lost'),
      alertsList: document.getElementById('alerts-list'),
      interrogationPanel: document.getElementById('interrogation-panel'),
      currentQuestion: document.getElementById('current-question'),
      transcript: document.getElementById('transcript'),
      interrogationProgress: document.getElementById('interrogation-progress'),
      summaryPanel: document.getElementById('summary-panel'),
      summaryContent: document.getElementById('summary-content'),
      closeSummary: document.getElementById('close-summary')
    };

    this.video = this.elements.video;
    this.canvas = this.elements.canvas;
    this.ctx = this.canvas.getContext('2d');

    // Initialize charts
    if (window.NeuroCharts) {
      this.charts = new window.NeuroCharts();
    }

    // Setup event listeners
    this.setupEventListeners();

    // Initialize speech recognition
    this.initSpeechRecognition();

    // Start webcam
    await this.startWebcam();

    // Connect to WebSocket
    this.connectWebSocket();
  }

  setupEventListeners() {
    // Mode toggle button
    this.elements.modeToggle.addEventListener('click', () => {
      if (this.mode === 'monitoring') {
        this.startInterrogation();
      } else {
        this.stopInterrogation();
      }
    });

    // Close summary button
    this.elements.closeSummary.addEventListener('click', () => {
      this.elements.summaryPanel.classList.add('hidden');
    });

    // Window beforeunload - cleanup
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });
  }

  async startWebcam() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 640,
          height: 480,
          facingMode: 'user'
        },
        audio: false
      });

      this.video.srcObject = this.stream;
      await this.video.play();

      // Set canvas size to match video
      this.canvas.width = this.video.videoWidth;
      this.canvas.height = this.video.videoHeight;

      console.log('Webcam started');
      this.updateStatus('connected', 'Connected');
    } catch (error) {
      console.error('Error starting webcam:', error);
      this.updateStatus('error', 'Webcam Error');
      this.showSignalLost(true);
    }
  }

  connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    console.log('Connecting to WebSocket:', wsUrl);
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.updateStatus('connected', 'Connected');
      this.startCapture();
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(JSON.parse(event.data));
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.updateStatus('error', 'Connection Error');
    };

    this.ws.onclose = () => {
      console.log('WebSocket closed');
      this.updateStatus('disconnected', 'Disconnected');
      this.stopCapture();
      this.attemptReconnect();
    };
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
      console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

      setTimeout(() => {
        this.connectWebSocket();
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
      this.updateStatus('error', 'Connection Failed');
    }
  }

  startCapture() {
    if (this.captureInterval) return;

    this.captureInterval = setInterval(() => {
      if (this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
        this.captureAndSendFrame();
      }
    }, this.captureRate);

    console.log('Frame capture started');
  }

  stopCapture() {
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
      console.log('Frame capture stopped');
    }
  }

  captureAndSendFrame() {
    // Draw video frame to canvas
    this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

    // Convert to base64 JPEG
    const imageData = this.canvas.toDataURL('image/jpeg', 0.8);
    const base64Data = imageData.split(',')[1];

    // Send to server
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'frame',
        data: base64Data,
        mode: this.mode
      }));
    }
  }

  handleMessage(message) {
    switch (message.type) {
      case 'analysis':
        this.handleAnalysis(message.data);
        break;
      case 'alert':
        this.handleAlert(message.data);
        break;
      case 'audio':
        this.playAudio(message.data);
        break;
      case 'question':
        this.displayQuestion(message.data);
        break;
      case 'summary':
        this.displaySummary(message.data);
        break;
      case 'interrogation_complete':
        this.completeInterrogation(message.data);
        break;
      case 'error':
        this.handleError(message.data);
        break;
    }
  }

  handleAnalysis(data) {
    // Hide signal lost overlay
    this.showSignalLost(false);

    // Update charts
    if (this.charts) {
      this.charts.updateCharts({
        timestamp: Date.now(),
        pupilLeft: data.pupilLeft,
        pupilRight: data.pupilRight,
        symmetry: data.symmetry,
        trendPupilLeft: data.trendPupilLeft,
        trendPupilRight: data.trendPupilRight,
        trendSymmetry: data.trendSymmetry
      });
    }
  }

  handleAlert(alert) {
    const alertId = `${alert.metric}-${alert.level}`;

    if (alert.active && !this.activeAlerts.has(alertId)) {
      // New alert - add to UI
      this.activeAlerts.set(alertId, alert);
      this.addAlertToUI(alert);
    } else if (!alert.active && this.activeAlerts.has(alertId)) {
      // Alert cleared
      this.activeAlerts.delete(alertId);
      this.removeAlertFromUI(alertId);
    }
  }

  addAlertToUI(alert) {
    const alertEl = document.createElement('div');
    alertEl.className = `alert alert-${alert.level}`;
    alertEl.id = `alert-${alert.metric}-${alert.level}`;

    alertEl.innerHTML = `
      <div class="alert-icon">${alert.level === 'critical' ? '🔴' : '⚠️'}</div>
      <div class="alert-content">
        <div class="alert-title">${alert.level.toUpperCase()}: ${alert.metric}</div>
        <div class="alert-message">${alert.message}</div>
        <div class="alert-time">${new Date(alert.timestamp).toLocaleTimeString()}</div>
      </div>
      <button class="alert-ack" onclick="app.acknowledgeAlert('${alert.metric}-${alert.level}')">
        Acknowledge
      </button>
    `;

    this.elements.alertsList.insertBefore(alertEl, this.elements.alertsList.firstChild);
  }

  removeAlertFromUI(alertId) {
    const alertEl = document.getElementById(`alert-${alertId}`);
    if (alertEl) {
      alertEl.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => alertEl.remove(), 300);
    }
  }

  acknowledgeAlert(alertId) {
    // Send acknowledgment to server
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'acknowledge_alert',
        alertId: alertId
      }));
    }

    // Remove from UI
    this.activeAlerts.delete(alertId);
    this.removeAlertFromUI(alertId);
  }

  showSignalLost(show) {
    if (show) {
      this.elements.signalLost.classList.remove('hidden');
    } else {
      this.elements.signalLost.classList.add('hidden');
    }
  }

  updateStatus(status, text) {
    this.elements.statusIndicator.className = `status-indicator status-${status}`;
    this.elements.statusText.textContent = text;
  }

  // Interrogation Mode

  startInterrogation() {
    console.log('Starting interrogation mode');
    this.mode = 'interrogation';
    this.interrogationState = {
      currentQuestion: 0,
      answers: [],
      startTime: Date.now()
    };

    // Update UI
    this.elements.modeToggle.textContent = 'Stop Interrogation';
    this.elements.interrogationPanel.classList.remove('hidden');
    this.elements.interrogationProgress.textContent = '0/5 Questions';

    // Start speech recognition
    if (this.recognition) {
      this.recognition.start();
    }

    // Notify server
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'start_interrogation'
      }));
    }
  }

  stopInterrogation() {
    console.log('Stopping interrogation mode');
    this.mode = 'monitoring';

    // Update UI
    this.elements.modeToggle.textContent = 'Start Interrogation';
    this.elements.interrogationPanel.classList.add('hidden');

    // Stop speech recognition
    if (this.recognition) {
      this.recognition.stop();
    }

    // Notify server
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'stop_interrogation'
      }));
    }
  }

  displayQuestion(questionData) {
    this.elements.currentQuestion.textContent = questionData.text;
    this.elements.interrogationProgress.textContent = `${questionData.index + 1}/5 Questions`;
    this.elements.transcript.textContent = 'Listening...';
    this.currentTranscript = '';
  }

  playAudio(audioData) {
    // audioData is base64 encoded audio
    const audio = new Audio(`data:audio/mpeg;base64,${audioData}`);
    audio.play().catch(error => {
      console.error('Error playing audio:', error);
    });
  }

  initSpeechRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();

      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }

        this.currentTranscript = transcript;
        this.elements.transcript.textContent = transcript || 'Listening...';

        // If final result, send to server
        if (event.results[event.results.length - 1].isFinal) {
          this.submitAnswer(transcript);
        }
      };

      this.recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
      };

      this.recognition.onend = () => {
        // Restart if still in interrogation mode
        if (this.mode === 'interrogation') {
          setTimeout(() => {
            if (this.mode === 'interrogation') {
              this.recognition.start();
            }
          }, 100);
        }
      };

      console.log('Speech recognition initialized');
    } else {
      console.warn('Speech recognition not supported in this browser');
    }
  }

  submitAnswer(answer) {
    if (!answer.trim()) return;

    // Send answer to server
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'answer',
        answer: answer.trim(),
        questionIndex: this.interrogationState.currentQuestion
      }));
    }

    // Clear transcript after submission
    setTimeout(() => {
      this.currentTranscript = '';
      this.elements.transcript.textContent = 'Listening...';
    }, 1000);
  }

  displaySummary(summary) {
    // Format summary as JSON
    const formatted = JSON.stringify(summary, null, 2);
    this.elements.summaryContent.textContent = formatted;
    this.elements.summaryPanel.classList.remove('hidden');
  }

  completeInterrogation(data) {
    console.log('Interrogation complete:', data);

    // Stop speech recognition
    if (this.recognition) {
      this.recognition.stop();
    }

    // Show summary
    if (data.summary) {
      this.displaySummary(data.summary);
    }

    // Return to monitoring mode after delay
    setTimeout(() => {
      this.stopInterrogation();
    }, 2000);
  }

  handleError(error) {
    console.error('Server error:', error);

    if (error.trackingLost) {
      this.showSignalLost(true);
    }
  }

  cleanup() {
    // Stop capture
    this.stopCapture();

    // Stop webcam
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }

    // Close WebSocket
    if (this.ws) {
      this.ws.close();
    }

    // Stop speech recognition
    if (this.recognition) {
      this.recognition.stop();
    }
  }
}

// Initialize app when DOM is ready
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new NeuroMonitorApp();
});

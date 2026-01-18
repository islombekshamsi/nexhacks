// Voice Assessment UI Controller - New Single-Page Flow
// Manages the Welcome → Recording → Results flow

console.log('🟢🟢🟢 voice-assessment-ui.js LOADING 🟢🟢🟢');

(() => {
  'use strict';

  // Task configurations - Stroke Speech Screening
  const TASKS = [
    {
      id: 1,
      title: 'Task 1: Sustained Vowel',
      instructions: 'Take a deep breath and say "ahhhhh" as steadily as possible. Keep your voice smooth and consistent.',
      duration: 10,
      readingText: null
    },
    {
      id: 2,
      title: 'Task 2: Rapid Articulation',
      instructions: 'Say "pa-ta-ka" repeatedly as fast and clearly as you can. Focus on precision and speed.',
      duration: 10,
      readingText: null
    },
    {
      id: 3,
      title: 'Task 3: Sentence Reading',
      instructions: 'Read the following sentence clearly at your normal speaking pace:',
      duration: 30,
      readingText: '"You know how that clever brown fox jumps over the lazy dog. When the sunlight strikes raindrops in the air, they act like a prism and form a beautiful rainbow across the sky."'
    },
    {
      id: 4,
      title: 'Task 4: Free Speech',
      instructions: 'Describe what you did today or talk about your favorite hobby. Speak naturally and comfortably.',
      duration: 30,
      readingText: null
    }
  ];

  class VoiceAssessmentUI {
    constructor() {
      console.log('🔧 VoiceAssessmentUI constructor called');
      
      // DOM elements
      console.log('📋 Getting DOM elements...');
      this.welcomeScreen = document.getElementById('voiceWelcomeScreen');
      this.recordingScreen = document.getElementById('voiceRecordingScreen');
      this.resultsScreen = document.getElementById('voiceResultsScreen');
      
      console.log('welcomeScreen:', this.welcomeScreen);
      console.log('recordingScreen:', this.recordingScreen);
      console.log('resultsScreen:', this.resultsScreen);
      
      // Welcome screen
      this.startBtn = document.getElementById('startVoiceAssessmentBtn');
      
      // Initialize Stroke Voice Assessment (using same engine)
      if (typeof window.ParkinsonsVoiceAssessment !== 'undefined') {
        this.assessment = new window.ParkinsonsVoiceAssessment();
        console.log('✅ Stroke Voice Assessment engine initialized');
      } else {
        console.error('❌ Voice assessment engine not found!');
        this.assessment = null;
      }
      
      // Recording screen
      this.progressSteps = document.querySelectorAll('.progress-step');
      this.taskTitle = document.getElementById('currentTaskTitle');
      this.taskInstructions = document.getElementById('currentTaskInstructions');
      this.readingTextBox = document.getElementById('currentTaskReadingText');
      this.waveformCanvas = document.getElementById('voiceWaveformCanvas');
      this.recordBtn = document.getElementById('voiceRecordButton');
      this.skipBtn = document.getElementById('voiceSkipButton');
      this.recordingStatus = document.getElementById('recordingStatus');
      this.resultsPanel = document.getElementById('currentTaskResults');
      this.metricsDisplay = document.getElementById('currentTaskMetrics');
      this.continueBtn = document.getElementById('continueToNextTaskBtn');
      
      // Results screen
      this.restartBtn = document.getElementById('restartAssessmentBtn');
      this.downloadBtn = document.getElementById('downloadResultsBtn');
      
      // State
      this.currentTaskIndex = 0;
      this.isRecording = false;
      this.recordingTimer = null;
      this.timeRemaining = 0;
      this.taskResults = [];
      
      // Components
      this.counter = null;
      this.waveform = null;
      
      this.init();
    }

    init() {
      console.log('🎤 Voice Assessment UI initialized');
      
      // Event listeners
      if (this.startBtn) {
        console.log('✅ Begin Assessment button found, attaching click listener');
        this.startBtn.addEventListener('click', () => {
          console.log('🔘 Begin Assessment button clicked!');
          this.startAssessment();
        });
      } else {
        console.error('❌ Begin Assessment button NOT FOUND!');
      }
      
      this.recordBtn?.addEventListener('click', () => this.toggleRecording());
      this.skipBtn?.addEventListener('click', () => this.skipTask());
      this.continueBtn?.addEventListener('click', () => this.nextTask());
      this.restartBtn?.addEventListener('click', () => this.restart());
      this.downloadBtn?.addEventListener('click', () => this.downloadResults());
      
      // Handle navigation to Voice Assessment section
      this.setupNavigation();
      
      // Show welcome screen
      this.showWelcomeScreen();
    }
    
    setupNavigation() {
      // Listen for hash changes (navigation clicks)
      window.addEventListener('hashchange', () => {
        if (window.location.hash === '#voiceAssessmentSection') {
          this.showSection();
        }
      });
      
      // Also check on initial load
      if (window.location.hash === '#voiceAssessmentSection') {
        this.showSection();
      }
      
      // Listen for clicks on Voice nav links
      document.querySelectorAll('a[href="#voiceAssessmentSection"]').forEach(link => {
        link.addEventListener('click', (e) => {
          console.log('🎯 Voice nav clicked');
          setTimeout(() => this.showSection(), 100);
        });
      });
    }
    
    showSection() {
      console.log('👁️ Showing Voice Assessment section');
      const section = document.getElementById('voiceAssessmentSection');
      if (section) {
        section.classList.remove('hidden');
        // Hide other app views
        document.querySelectorAll('.app-view').forEach(view => {
          if (view.id !== 'voiceAssessmentSection') {
            view.classList.add('hidden');
          }
        });
      }
    }

    showWelcomeScreen() {
      this.welcomeScreen?.classList.remove('hidden');
      this.recordingScreen?.classList.add('hidden');
      this.resultsScreen?.classList.add('hidden');
    }

    showRecordingScreen() {
      this.welcomeScreen?.classList.add('hidden');
      this.recordingScreen?.classList.remove('hidden');
      this.resultsScreen?.classList.add('hidden');
    }

    showResultsScreen() {
      this.welcomeScreen?.classList.add('hidden');
      this.recordingScreen?.classList.add('hidden');
      this.resultsScreen?.classList.remove('hidden');
    }

    async startAssessment() {
      console.log('🎬🎬🎬 START ASSESSMENT CALLED 🎬🎬🎬');
      try {
        console.log('🎬 Starting voice assessment');
        this.currentTaskIndex = 0;
        this.taskResults = [];
        
        // Initialize components
        console.log('📦 Initializing components...');
        this.initializeComponents();
        
        // Show first task
        console.log('📺 Showing recording screen...');
        this.showRecordingScreen();
        
        console.log('📝 Loading task 0...');
        this.loadTask(0);
        
        console.log('✅ Assessment ready!');
      } catch (error) {
        console.error('❌ Error starting assessment:', error);
        console.error('Stack trace:', error.stack);
        alert('Error starting assessment: ' + error.message);
      }
    }

    initializeComponents() {
      try {
        // Initialize animated counter
        if (window.VoiceCounter) {
          try {
            this.counter = new VoiceCounter('voiceTimer', {
              value: TASKS[0].duration,
              fontSize: 80,
              textColor: '#40ffaa',
              fontWeight: '700'
            });
            console.log('✅ VoiceCounter initialized');
          } catch (counterError) {
            console.error('❌ VoiceCounter initialization failed:', counterError);
            this.counter = null;
          }
        } else {
          console.warn('⚠️ VoiceCounter class not available');
        }
        
        // Initialize waveform visualizer (will be initialized later with audio stream)
        if (window.VoiceWaveform && this.waveformCanvas) {
          // Don't initialize here, will initialize when recording starts with audio stream
          console.log('✅ VoiceWaveform class available');
        } else {
          console.warn('⚠️ VoiceWaveform not available or canvas not found');
        }
      } catch (error) {
        console.error('❌ Error initializing components:', error);
        // Continue anyway - components are optional for basic functionality
      }
    }

    loadTask(index) {
      if (index < 0 || index >= TASKS.length) return;
      
      const task = TASKS[index];
      this.currentTaskIndex = index;
      
      // Update progress bar
      this.updateProgressBar(index);
      
      // Update task content
      this.taskTitle.textContent = task.title;
      this.taskInstructions.textContent = task.instructions;
      
      // Show/hide reading text
      if (task.readingText) {
        this.readingTextBox.textContent = task.readingText;
        this.readingTextBox.classList.remove('hidden');
      } else {
        this.readingTextBox.classList.add('hidden');
      }
      
      // Update timer
      this.timeRemaining = task.duration;
      if (this.counter) {
        try {
          this.counter.setValue(task.duration);
        } catch (counterError) {
          console.warn('⚠️ Counter setValue failed:', counterError);
        }
      } else {
        console.log('ℹ️ Counter not initialized, timer will show in console only');
      }
      
      // Reset UI state
      this.recordBtn.disabled = false;
      this.recordBtn.classList.remove('recording');
      this.recordBtn.querySelector('span:last-child').textContent = 'Start Recording';
      this.recordingStatus.textContent = 'Ready to record';
      this.resultsPanel.classList.add('hidden');
      
      // Animate in
      if (window.gsap && this.taskTitle) {
        try {
          gsap.from(this.taskTitle, {
            opacity: 0,
            y: -20,
            duration: 0.5,
            ease: 'power2.out'
          });
        } catch (animError) {
          console.warn('⚠️ Animation failed:', animError);
        }
      }
      
      console.log(`✅ Task ${index + 1} loaded:`, task.title);
    }

    updateProgressBar(currentIndex) {
      this.progressSteps.forEach((step, index) => {
        if (index < currentIndex) {
          step.classList.add('completed');
          step.classList.remove('active');
        } else if (index === currentIndex) {
          step.classList.add('active');
          step.classList.remove('completed');
        } else {
          step.classList.remove('active', 'completed');
        }
      });
    }

    async toggleRecording() {
      if (this.isRecording) {
        await this.stopRecording();
      } else {
        await this.startRecording();
      }
    }

    async startRecording() {
      try {
        console.log('🎙️ Starting recording for Task', this.currentTaskIndex + 1);
        
        // Request microphone access
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('✅ Microphone access granted');
        
        // Initialize waveform with audio stream
        if (window.VoiceWaveform) {
          try {
            if (!this.waveform) {
              this.waveform = new VoiceWaveform('voiceWaveformCanvas', {
                color: '#40ffaa',
                backgroundColor: 'transparent',
                lineWidth: 2.5,
                smoothing: 0.8
              });
            }
            await this.waveform.init(stream);
            console.log('✅ Waveform visualization started');
          } catch (waveError) {
            console.warn('⚠️ Waveform initialization failed:', waveError);
            // Continue without waveform
          }
        }
        
        // Update UI
        this.isRecording = true;
        this.recordBtn.classList.add('recording');
        this.recordBtn.querySelector('span:last-child').textContent = 'Recording...';
        this.recordingStatus.textContent = 'Recording in progress';
        
        // Start countdown
        const task = TASKS[this.currentTaskIndex];
        this.timeRemaining = task.duration;
        
        this.recordingTimer = setInterval(() => {
          this.timeRemaining--;
          
          // Update counter with formatted time (MM:SS)
          if (this.counter) {
            const minutes = Math.floor(this.timeRemaining / 60);
            const seconds = this.timeRemaining % 60;
            const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            this.counter.setValue(formattedTime, true);
          }
          
          if (this.timeRemaining <= 0) {
            this.stopRecording();
          }
        }, 1000);
        
        // ========== START REAL ASSESSMENT RECORDING ==========
        if (this.assessment) {
          await this.assessment.startRecording(this.currentTaskIndex + 1);
          console.log(`Real Parkinson assessment recording started for Task ${this.currentTaskIndex + 1}`);
        } else {
          console.warn('Assessment not initialized, recording locally only');
        }
        // ========== END REAL ASSESSMENT RECORDING ==========
        
      } catch (error) {
        console.error('❌ Failed to start recording:', error);
        alert('Failed to access microphone. Please allow microphone permissions and try again.');
      }
    }

    async stopRecording() {
      console.log('⏹️ Stopping recording');
      
      // Clear timer
      if (this.recordingTimer) {
        clearInterval(this.recordingTimer);
        this.recordingTimer = null;
      }
      
      // Stop waveform
      if (this.waveform) {
        this.waveform.stop();
      }
      
      // Check minimum duration for ElevenLabs (4.6 seconds required)
      const task = TASKS[this.currentTaskIndex];
      const expectedDuration = task.duration;
      const recordedDuration = expectedDuration - this.timeRemaining;
      
      if (recordedDuration < 4.6) {
        alert(`Recording too short! ElevenLabs requires minimum 4.6 seconds.\nYou recorded: ${recordedDuration.toFixed(1)}s\nPlease record for at least 5 seconds.`);
        if (this.assessment?.cancelRecording) {
          this.assessment.cancelRecording();
        }
        this.isRecording = false;
        this.recordBtn.classList.remove('recording');
        this.recordBtn.disabled = false;
        this.recordBtn.querySelector('span:last-child').textContent = 'Start Recording';
        this.recordingStatus.textContent = 'Recording too short - try again';
        this.timeRemaining = task.duration;
        if (this.counter) {
          try {
            this.counter.setValue(task.duration);
          } catch (counterError) {
            console.warn('⚠️ Counter reset failed:', counterError);
          }
        }
        return;
      }
      
      // Update UI
      this.isRecording = false;
      this.recordBtn.classList.remove('recording');
      this.recordBtn.disabled = true;
      this.recordBtn.querySelector('span:last-child').textContent = 'Recording Complete';
      this.recordingStatus.textContent = 'Processing with ElevenLabs...';
      
      // ========== STOP REAL ASSESSMENT & PROCESS WITH ELEVENLABS ==========
      if (this.assessment) {
        try {
          console.log('📊 Stopping assessment recording and processing...');
          await this.assessment.stopRecording();
          console.log('✅ Assessment processing complete!');
          
          // Get the real results
          const taskKey = `task${this.currentTaskIndex + 1}`;
          const realResults = this.assessment.taskResults[taskKey];
          
          if (realResults) {
            console.log('✅ Real results received:', realResults);
            this.taskResults[this.currentTaskIndex] = realResults;
          } else {
            console.warn('⚠️ No real results, using mock data');
          }
        } catch (error) {
          console.error('❌ Error processing recording:', error);
          this.recordingStatus.textContent = 'Processing error, using fallback';
        }
      } else {
        console.warn('⚠️ Assessment not initialized, using mock data');
      }
      // ========== END REAL ASSESSMENT PROCESSING ==========
      
      // Show results
      this.showTaskResults();
    }

    showTaskResults() {
      // TODO: Use actual voice analysis results from parkinsons-voice.js
      // For now, generate mock results
      const mockMetrics = this.generateMockMetrics(this.currentTaskIndex);
      
      this.taskResults.push({
        taskId: this.currentTaskIndex + 1,
        metrics: mockMetrics
      });
      
      // Display metrics
      this.metricsDisplay.innerHTML = '';
      Object.entries(mockMetrics).forEach(([key, value]) => {
        const metricItem = document.createElement('div');
        metricItem.className = 'metric-item';
        metricItem.innerHTML = `
          <span class="metric-label">${this.formatMetricLabel(key)}</span>
          <span class="metric-value">${value}</span>
        `;
        this.metricsDisplay.appendChild(metricItem);
      });
      
      // Show results panel
      this.resultsPanel.classList.remove('hidden');
      this.recordingStatus.textContent = 'Task complete!';
      
      // Animate in
      gsap.from(this.resultsPanel, {
        opacity: 0,
        y: 20,
        duration: 0.5,
        ease: 'power2.out'
      });
    }

    generateMockMetrics(taskIndex) {
      // Generate mock metrics based on task type
      const metrics = {};
      
      switch (taskIndex) {
        case 0: // Sustained /aː/
          metrics.jitter = (Math.random() * 0.5 + 0.5).toFixed(2) + '%';
          metrics.shimmer = (Math.random() * 2 + 2).toFixed(2) + ' dB';
          metrics.hnr = (Math.random() * 5 + 20).toFixed(1) + ' dB';
          break;
        case 1: // /pa-ta-ka/
          metrics.syllableRate = (Math.random() * 2 + 5).toFixed(1) + ' Hz';
          metrics.pitchRange = (Math.random() * 30 + 40).toFixed(0) + ' Hz';
          metrics.loudnessVar = (Math.random() * 3 + 4).toFixed(1) + ' dB';
          break;
        case 2: // Reading
          metrics.speechRate = (Math.random() * 20 + 120).toFixed(0) + ' wpm';
          metrics.pauseRatio = (Math.random() * 10 + 15).toFixed(1) + '%';
          metrics.vowelSpace = (Math.random() * 200 + 800).toFixed(0);
          break;
        case 3: // Monologue
          metrics.complexity = (Math.random() * 20 + 70).toFixed(1) + '%';
          metrics.articulation = (Math.random() * 15 + 80).toFixed(1) + '%';
          metrics.prosody = (Math.random() * 20 + 75).toFixed(1) + '%';
          break;
      }
      
      return metrics;
    }

    formatMetricLabel(key) {
      const labels = {
        jitter: 'Jitter',
        shimmer: 'Shimmer',
        hnr: 'HNR',
        syllableRate: 'Syllable Rate',
        pitchRange: 'Pitch Range',
        loudnessVar: 'Loudness Var.',
        speechRate: 'Speech Rate',
        pauseRatio: 'Pause Ratio',
        vowelSpace: 'Vowel Space',
        complexity: 'Complexity',
        articulation: 'Articulation',
        prosody: 'Prosody'
      };
      return labels[key] || key;
    }

    nextTask() {
      const nextIndex = this.currentTaskIndex + 1;
      
      if (nextIndex < TASKS.length) {
        // Load next task
        this.loadTask(nextIndex);
        
        // Reset waveform
        if (this.waveform) {
          this.waveform.stop();
        }
      } else {
        // All tasks complete - show final results
        this.showFinalResults();
      }
    }

    skipTask() {
      console.log('⏭️ Skipping task', this.currentTaskIndex + 1);
      
      // Stop any ongoing recording
      if (this.isRecording) {
        if (this.assessment?.cancelRecording) {
          this.assessment.cancelRecording();
        }
        
        if (this.recordingTimer) {
          clearInterval(this.recordingTimer);
          this.recordingTimer = null;
        }
        
        this.isRecording = false;
        this.recordBtn.classList.remove('recording');
        this.recordBtn.disabled = false;
        this.recordBtn.querySelector('span:last-child').textContent = 'Start Recording';
        
        // Stop waveform
        if (this.waveform) {
          this.waveform.stop();
        }
      }
      
      // Store skipped result
      this.taskResults[this.currentTaskIndex] = {
        skipped: true,
        taskNumber: this.currentTaskIndex + 1,
        timestamp: new Date().toISOString()
      };
      
      // Update progress indicator for skipped task
      const currentStep = this.progressSteps[this.currentTaskIndex];
      if (currentStep) {
        currentStep.classList.add('skipped');
        currentStep.setAttribute('data-status', 'skipped');
      }
      
      // Show skipped message
      this.recordingStatus.textContent = 'Task skipped';
      this.recordingStatus.style.color = '#ffaa44';
      
      // Auto-advance after brief delay
      setTimeout(() => {
        const nextIndex = this.currentTaskIndex + 1;
        
        if (nextIndex < TASKS.length) {
          // Load next task
          this.loadTask(nextIndex);
          
          // Reset waveform
          if (this.waveform) {
            this.waveform.stop();
          }
        } else {
          // All tasks done (completed or skipped) - show final results
          this.showFinalResults();
        }
      }, 1000);
    }

    showFinalResults() {
      console.log('🏁 All tasks complete - showing final results');
      
      // Count completed vs skipped tasks
      const completedTasks = this.taskResults.filter(r => r && !r.skipped).length;
      const skippedTasks = this.taskResults.filter(r => r && r.skipped).length;
      const totalTasks = TASKS.length;
      
      console.log(`📊 Task summary: ${completedTasks} completed, ${skippedTasks} skipped out of ${totalTasks}`);
      
      // Get real stroke analysis from assessment engine
      let strokeRisk = 0;
      let severity = 'MINIMAL';
      let recommendation = '';
      let confidence = 0;
      let completedCount = 0;
      
      if (this.assessment && typeof this.assessment.getFusedAnalysis === 'function') {
        const analysis = this.assessment.getFusedAnalysis();
        console.log('📊 Fused stroke analysis:', analysis);
        
        strokeRisk = analysis.strokeRisk || 0;
        severity = analysis.severity || 'MINIMAL';
        recommendation = analysis.recommendation || 'No analysis available';
        confidence = Math.round(analysis.confidence * 100);
        completedCount = analysis.taskCount || 0;
        
        // Reduce confidence if tasks were skipped
        if (skippedTasks > 0) {
          const confidencePenalty = skippedTasks * 15; // -15% per skipped task
          confidence = Math.max(20, confidence - confidencePenalty);
        }
      } else {
        console.warn('⚠️ Assessment engine not available, using fallback');
        strokeRisk = 15;
        severity = 'LOW';
        recommendation = 'Assessment engine not initialized';
        confidence = 50;
        completedCount = completedTasks;
      }
      
      // Add note about skipped tasks to recommendation
      if (skippedTasks > 0) {
        recommendation += `\n\n⚠️ Note: ${skippedTasks} task(s) were skipped. Results are based on ${completedTasks}/${totalTasks} completed tasks. For more accurate assessment, complete all tasks.`;
      }
      
      // Update final results with stroke risk
      document.getElementById('finalRiskValue').textContent = strokeRisk + '%';
      document.getElementById('finalConfidenceValue').textContent = confidence + '%';
      
      // Show completed/skipped breakdown
      const tasksCompletedEl = document.getElementById('finalTasksCompleted');
      if (skippedTasks > 0) {
        tasksCompletedEl.textContent = `${completedTasks} / ${totalTasks} (${skippedTasks} skipped)`;
        tasksCompletedEl.style.color = '#ffaa44'; // Orange for warning
      } else {
        tasksCompletedEl.textContent = `${completedTasks} / ${totalTasks}`;
        tasksCompletedEl.style.color = ''; // Default color
      }
      
      // Update recommendation text
      document.getElementById('finalRecommendationText').textContent = recommendation;
      
      // Update risk circle color based on severity
      const riskCircle = document.getElementById('finalRiskCircle');
      if (riskCircle) {
        riskCircle.style.borderColor = 
          severity === 'HIGH RISK' ? '#ff4444' :
          severity === 'MODERATE' ? '#ffaa44' :
          severity === 'LOW' ? '#44aaff' : '#44ff88';
      }
      
      // Show results screen
      this.showResultsScreen();
      
      // Animate risk circle
      if (window.gsap) {
        gsap.fromTo('#finalRiskCircle', 
          { scale: 0, rotation: -180 },
          { scale: 1, rotation: 0, duration: 1, ease: 'back.out(1.7)' }
        );
      }
    }

    restart() {
      console.log('🔄 Restarting assessment');
      
      // Destroy components
      if (this.counter) {
        this.counter.destroy();
        this.counter = null;
      }
      if (this.waveform) {
        this.waveform.destroy();
        this.waveform = null;
      }
      
      // Reset state
      this.currentTaskIndex = 0;
      this.taskResults = [];
      this.isRecording = false;
      
      // Show welcome screen
      this.showWelcomeScreen();
    }

    downloadResults() {
      console.log('💾 Downloading results');
      
      const results = {
        timestamp: new Date().toISOString(),
        tasks: this.taskResults,
        overallRisk: document.getElementById('finalRiskValue').textContent,
        confidence: '86%',
        recommendation: document.getElementById('finalRecommendationText').textContent
      };
      
      const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `voice-assessment-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      try {
        console.log('🎯 DOMContentLoaded - Initializing Voice Assessment UI...');
        window.voiceAssessmentUI = new VoiceAssessmentUI();
        console.log('✅ Voice Assessment UI instance created');
      } catch (error) {
        console.error('❌ Failed to initialize Voice Assessment UI:', error);
        console.error('Stack:', error.stack);
      }
    });
  } else {
    try {
      console.log('🎯 DOM already loaded - Initializing Voice Assessment UI...');
      window.voiceAssessmentUI = new VoiceAssessmentUI();
      console.log('✅ Voice Assessment UI instance created');
    } catch (error) {
      console.error('❌ Failed to initialize Voice Assessment UI:', error);
      console.error('Stack:', error.stack);
    }
  }
})();

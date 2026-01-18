/**
 * Voice Protocol - Clinical 4-Task Voice Assessment
 * Based on Nature 2024 research achieving 86% accuracy
 *
 * Tasks:
 * 1. Sustained /aː/ (10s) - Phonation
 * 2. /pa-ta-ka/ DDK (10s) - Articulation + Prosody
 * 3. Rainbow Passage (30s) - Real speech
 * 4. Monologue (30s) - Spontaneous speech
 */

class VoiceProtocol {
  constructor(options = {}) {
    this.voiceAnalyzer = options.voiceAnalyzer;
    this.tts = options.tts;
    this.onProgress = options.onProgress || (() => {});
    this.onComplete = options.onComplete || (() => {});
    this.onLevelUpdate = options.onLevelUpdate || (() => {});

    this.currentTask = 0;
    this.isRunning = false;
    this.isPaused = false;
    this.taskResults = [];

    this.levelInterval = null;
    this.taskTimer = null;
    this.countdownTimer = null;

    // UI elements (will be set during start)
    this.ui = {};
  }

  // The 4 clinical tasks
  static TASKS = [
    {
      id: 'sustained_vowel',
      name: 'Sustained Vowel /aː/',
      shortName: 'Phonation Test',
      instruction: 'Take a deep breath, then say "ahhh" in a comfortable pitch and hold it as long as you can.',
      duration: 10000,
      countdown: 3,
      metrics: ['jitter', 'shimmer', 'hnr', 'meanPitch'],
      weight: 0.25
    },
    {
      id: 'ddk',
      name: 'Diadochokinetic Test',
      shortName: 'DDK Test',
      instruction: 'Repeat "pa-ta-ka, pa-ta-ka" as quickly and clearly as you can, without stopping.',
      duration: 10000,
      countdown: 3,
      metrics: ['syllableRate', 'syllableRegularity', 'pitchRange', 'loudnessVariation'],
      weight: 0.25
    },
    {
      id: 'reading',
      name: 'Reading Passage',
      shortName: 'Reading Test',
      instruction: 'Please read the following passage aloud at a comfortable pace:',
      passage: true,
      duration: 30000,
      countdown: 3,
      metrics: ['speechRate', 'pauseRatio', 'pitchRange', 'loudnessVariation'],
      weight: 0.25
    },
    {
      id: 'monologue',
      name: 'Spontaneous Speech',
      shortName: 'Monologue Test',
      instruction: 'Please describe what you typically do in the morning, from waking up to leaving home. Speak naturally.',
      duration: 30000,
      countdown: 3,
      metrics: ['speechRate', 'pauseRatio', 'pitchRange', 'jitter', 'shimmer'],
      weight: 0.25
    }
  ];

  // Rainbow Passage - Standard clinical reading passage
  static RAINBOW_PASSAGE = `When the sunlight strikes raindrops in the air, they act as a prism and form a rainbow. The rainbow is a division of white light into many beautiful colors. These take the shape of a long round arch, with its path high above, and its two ends apparently beyond the horizon.`;

  // UPDRS Speech Scale thresholds
  static THRESHOLDS = {
    jitter: { healthy: 1.04, mild: 2.0, moderate: 3.0, severe: 5.0 },
    shimmer: { healthy: 3.81, mild: 6.0, moderate: 9.0, severe: 12.0 },
    hnr: { healthy: 20, mild: 15, moderate: 10, severe: 5 },
    syllableRate: { healthy: 5.0, mild: 4.0, moderate: 3.0, severe: 2.0 },
    pitchRange: { healthy: 50, mild: 40, moderate: 30, severe: 20 },
    loudnessVariation: { healthy: 5, mild: 4, moderate: 3, severe: 2 },
    speechRate: { healthy: 120, mild: 100, moderate: 80, severe: 60 }
  };

  /**
   * Initialize UI elements
   */
  initUI() {
    this.ui = {
      modal: document.getElementById('voiceProtocolModal'),
      taskName: document.getElementById('voiceTaskName'),
      instruction: document.getElementById('voiceInstruction'),
      passageContainer: document.getElementById('readingPassageContainer'),
      passage: document.getElementById('readingPassage'),
      visualizerCanvas: document.getElementById('audioVisualizer'),
      levelFill: document.getElementById('audioLevelFill'),
      recordingIndicator: document.getElementById('voiceRecordingIndicator'),
      countdown: document.getElementById('voiceCountdown'),
      countdownNumber: document.getElementById('countdownNumber'),
      timer: document.getElementById('voiceTimer'),
      timerValue: document.getElementById('voiceTimerValue'),
      timerMax: document.getElementById('voiceTimerMax'),
      taskProgress: document.getElementById('voiceTaskProgress'),
      skipBtn: document.getElementById('skipVoiceTaskBtn'),
      cancelBtn: document.getElementById('cancelVoiceProtocolBtn')
    };

    // Setup button handlers
    if (this.ui.skipBtn) {
      this.ui.skipBtn.onclick = () => this.skipTask();
    }
    if (this.ui.cancelBtn) {
      this.ui.cancelBtn.onclick = () => this.cancel();
    }
  }

  /**
   * Start the voice protocol
   */
  async start() {
    console.log('Starting clinical voice protocol...');

    this.initUI();
    this.currentTask = 0;
    this.isRunning = true;
    this.isPaused = false;
    this.taskResults = [];

    // Show modal
    if (this.ui.modal) {
      this.ui.modal.classList.remove('hidden');
    }

    // Initialize voice analyzer if not already
    if (this.voiceAnalyzer && !this.voiceAnalyzer.audioContext) {
      await this.voiceAnalyzer.init();
    }

    // Start first task
    await this.runTask(0);
  }

  /**
   * Run a specific task
   * @param {number} taskIndex - Index of task to run
   */
  async runTask(taskIndex) {
    if (!this.isRunning || taskIndex >= VoiceProtocol.TASKS.length) {
      this.complete();
      return;
    }

    const task = VoiceProtocol.TASKS[taskIndex];
    this.currentTask = taskIndex;

    console.log(`Running task ${taskIndex + 1}: ${task.name}`);

    // Update UI
    this.updateTaskUI(task);
    this.onProgress({
      taskIndex,
      totalTasks: VoiceProtocol.TASKS.length,
      taskName: task.name,
      phase: 'instruction'
    });

    // Speak instruction
    if (this.tts) {
      await this.tts.speak(task.instruction);
    }

    // Small delay after instruction
    await this.delay(500);

    // Show countdown
    await this.showCountdown(task.countdown);

    // Start recording
    this.showRecording(true);
    this.startLevelMeter();
    this.startTimer(task.duration);

    this.onProgress({
      taskIndex,
      totalTasks: VoiceProtocol.TASKS.length,
      taskName: task.name,
      phase: 'recording'
    });

    // Capture and analyze
    let results = null;
    try {
      results = await this.voiceAnalyzer.startCapture(task.duration);
    } catch (error) {
      console.error('Capture error:', error);
      results = { error: error.message };
    }

    // Stop indicators
    this.showRecording(false);
    this.stopLevelMeter();
    this.stopTimer();

    // Store results
    this.taskResults.push({
      taskId: task.id,
      taskName: task.name,
      metrics: results,
      timestamp: Date.now()
    });

    // Brief pause between tasks
    await this.delay(1000);

    // Next task
    if (this.isRunning) {
      await this.runTask(taskIndex + 1);
    }
  }

  /**
   * Update UI for current task
   * @param {Object} task - Task definition
   */
  updateTaskUI(task) {
    if (this.ui.taskName) {
      this.ui.taskName.textContent = task.name;
    }

    if (this.ui.instruction) {
      this.ui.instruction.textContent = task.instruction;
    }

    if (this.ui.taskProgress) {
      this.ui.taskProgress.textContent = `Task ${this.currentTask + 1} of ${VoiceProtocol.TASKS.length}`;
    }

    if (this.ui.timerMax) {
      this.ui.timerMax.textContent = ` / ${task.duration / 1000}s`;
    }

    // Show/hide reading passage
    if (this.ui.passageContainer && this.ui.passage) {
      if (task.passage) {
        this.ui.passage.textContent = VoiceProtocol.RAINBOW_PASSAGE;
        this.ui.passageContainer.classList.remove('hidden');
      } else {
        this.ui.passageContainer.classList.add('hidden');
      }
    }
  }

  /**
   * Show countdown before recording
   * @param {number} seconds - Countdown duration
   */
  async showCountdown(seconds) {
    if (!this.ui.countdown || !this.ui.countdownNumber) {
      await this.delay(seconds * 1000);
      return;
    }

    this.ui.countdown.classList.remove('hidden');

    for (let i = seconds; i > 0; i--) {
      this.ui.countdownNumber.textContent = i;
      this.ui.countdownNumber.style.animation = 'none';
      // Trigger reflow
      this.ui.countdownNumber.offsetHeight;
      this.ui.countdownNumber.style.animation = 'countdownPulse 1s ease-out';

      await this.delay(1000);
    }

    this.ui.countdown.classList.add('hidden');
  }

  /**
   * Show/hide recording indicator
   * @param {boolean} show - Whether to show indicator
   */
  showRecording(show) {
    if (this.ui.recordingIndicator) {
      if (show) {
        this.ui.recordingIndicator.classList.remove('hidden');
      } else {
        this.ui.recordingIndicator.classList.add('hidden');
      }
    }
  }

  /**
   * Start audio level meter
   */
  startLevelMeter() {
    if (!this.voiceAnalyzer) return;

    this.levelInterval = setInterval(() => {
      const level = this.voiceAnalyzer.getLevel();
      const percentage = Math.min(100, level * 500); // Scale for visibility

      if (this.ui.levelFill) {
        this.ui.levelFill.style.width = `${percentage}%`;
      }

      this.onLevelUpdate(level);
    }, 50);
  }

  /**
   * Stop audio level meter
   */
  stopLevelMeter() {
    if (this.levelInterval) {
      clearInterval(this.levelInterval);
      this.levelInterval = null;
    }
    if (this.ui.levelFill) {
      this.ui.levelFill.style.width = '0%';
    }
  }

  /**
   * Start task timer
   * @param {number} durationMs - Duration in milliseconds
   */
  startTimer(durationMs) {
    const startTime = Date.now();

    this.taskTimer = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;

      if (this.ui.timerValue) {
        this.ui.timerValue.textContent = elapsed.toFixed(1) + 's';
      }

      this.onProgress({
        taskIndex: this.currentTask,
        totalTasks: VoiceProtocol.TASKS.length,
        phase: 'recording',
        elapsed: elapsed,
        duration: durationMs / 1000
      });

    }, 100);
  }

  /**
   * Stop task timer
   */
  stopTimer() {
    if (this.taskTimer) {
      clearInterval(this.taskTimer);
      this.taskTimer = null;
    }
  }

  /**
   * Skip current task
   */
  skipTask() {
    console.log('Skipping task', this.currentTask);

    if (this.voiceAnalyzer) {
      this.voiceAnalyzer.stopCapture();
    }

    this.stopTimer();
    this.stopLevelMeter();
    this.showRecording(false);

    // Record as skipped
    const task = VoiceProtocol.TASKS[this.currentTask];
    this.taskResults.push({
      taskId: task.id,
      taskName: task.name,
      metrics: { skipped: true },
      timestamp: Date.now()
    });
  }

  /**
   * Cancel the entire protocol
   */
  cancel() {
    console.log('Cancelling voice protocol');

    this.isRunning = false;

    if (this.voiceAnalyzer) {
      this.voiceAnalyzer.stopCapture();
    }

    this.stopTimer();
    this.stopLevelMeter();
    this.showRecording(false);

    if (this.ui.modal) {
      this.ui.modal.classList.add('hidden');
    }

    this.onComplete({ cancelled: true, taskResults: this.taskResults });
  }

  /**
   * Complete the protocol and calculate final scores
   */
  complete() {
    console.log('Voice protocol complete');

    this.isRunning = false;

    // Hide modal
    if (this.ui.modal) {
      this.ui.modal.classList.add('hidden');
    }

    // Aggregate results
    const aggregated = this.aggregateResults();

    // Calculate UPDRS score
    const updrsScore = this.calculateUPDRS(aggregated);

    const finalResults = {
      completed: true,
      taskResults: this.taskResults,
      aggregated: aggregated,
      updrsScore: updrsScore,
      clinicalInterpretation: this.getClinicalInterpretation(updrsScore, aggregated),
      timestamp: Date.now()
    };

    console.log('Final voice results:', finalResults);

    this.onComplete(finalResults);
  }

  /**
   * Aggregate metrics from all tasks
   * @returns {Object} Aggregated metrics
   */
  aggregateResults() {
    const metrics = {
      jitter: [],
      shimmer: [],
      hnr: [],
      pitchRange: [],
      syllableRate: [],
      loudnessVariation: [],
      speechRate: [],
      pauseRatio: []
    };

    // Collect metrics from each task
    for (const result of this.taskResults) {
      if (result.metrics && !result.metrics.skipped && !result.metrics.error) {
        for (const key of Object.keys(metrics)) {
          if (result.metrics[key] !== undefined && result.metrics[key] > 0) {
            metrics[key].push(result.metrics[key]);
          }
        }
      }
    }

    // Calculate averages
    const aggregated = {};
    for (const [key, values] of Object.entries(metrics)) {
      if (values.length > 0) {
        aggregated[key] = values.reduce((a, b) => a + b, 0) / values.length;
      } else {
        aggregated[key] = null;
      }
    }

    // Get best DDK syllable rate (from DDK task specifically)
    const ddkResult = this.taskResults.find(r => r.taskId === 'ddk');
    if (ddkResult && ddkResult.metrics && ddkResult.metrics.syllableRate) {
      aggregated.syllableRate = ddkResult.metrics.syllableRate;
      aggregated.syllableRegularity = ddkResult.metrics.syllableRegularity;
    }

    return aggregated;
  }

  /**
   * Calculate UPDRS Speech Score (0-4)
   * @param {Object} metrics - Aggregated metrics
   * @returns {Object} UPDRS result with score and details
   */
  calculateUPDRS(metrics) {
    const T = VoiceProtocol.THRESHOLDS;
    let score = 0;
    const flags = [];

    // Check each metric against thresholds
    if (metrics.jitter !== null) {
      if (metrics.jitter > T.jitter.severe) {
        flags.push({ metric: 'jitter', severity: 'severe', value: metrics.jitter });
        score = Math.max(score, 4);
      } else if (metrics.jitter > T.jitter.moderate) {
        flags.push({ metric: 'jitter', severity: 'moderate', value: metrics.jitter });
        score = Math.max(score, 3);
      } else if (metrics.jitter > T.jitter.mild) {
        flags.push({ metric: 'jitter', severity: 'mild', value: metrics.jitter });
        score = Math.max(score, 2);
      } else if (metrics.jitter > T.jitter.healthy) {
        flags.push({ metric: 'jitter', severity: 'slight', value: metrics.jitter });
        score = Math.max(score, 1);
      }
    }

    if (metrics.shimmer !== null) {
      if (metrics.shimmer > T.shimmer.severe) {
        flags.push({ metric: 'shimmer', severity: 'severe', value: metrics.shimmer });
        score = Math.max(score, 4);
      } else if (metrics.shimmer > T.shimmer.moderate) {
        flags.push({ metric: 'shimmer', severity: 'moderate', value: metrics.shimmer });
        score = Math.max(score, 3);
      } else if (metrics.shimmer > T.shimmer.mild) {
        flags.push({ metric: 'shimmer', severity: 'mild', value: metrics.shimmer });
        score = Math.max(score, 2);
      } else if (metrics.shimmer > T.shimmer.healthy) {
        flags.push({ metric: 'shimmer', severity: 'slight', value: metrics.shimmer });
        score = Math.max(score, 1);
      }
    }

    if (metrics.hnr !== null) {
      if (metrics.hnr < T.hnr.severe) {
        flags.push({ metric: 'hnr', severity: 'severe', value: metrics.hnr });
        score = Math.max(score, 4);
      } else if (metrics.hnr < T.hnr.moderate) {
        flags.push({ metric: 'hnr', severity: 'moderate', value: metrics.hnr });
        score = Math.max(score, 3);
      } else if (metrics.hnr < T.hnr.mild) {
        flags.push({ metric: 'hnr', severity: 'mild', value: metrics.hnr });
        score = Math.max(score, 2);
      } else if (metrics.hnr < T.hnr.healthy) {
        flags.push({ metric: 'hnr', severity: 'slight', value: metrics.hnr });
        score = Math.max(score, 1);
      }
    }

    if (metrics.syllableRate !== null) {
      if (metrics.syllableRate < T.syllableRate.severe) {
        flags.push({ metric: 'syllableRate', severity: 'severe', value: metrics.syllableRate });
        score = Math.max(score, 4);
      } else if (metrics.syllableRate < T.syllableRate.moderate) {
        flags.push({ metric: 'syllableRate', severity: 'moderate', value: metrics.syllableRate });
        score = Math.max(score, 3);
      } else if (metrics.syllableRate < T.syllableRate.mild) {
        flags.push({ metric: 'syllableRate', severity: 'mild', value: metrics.syllableRate });
        score = Math.max(score, 2);
      } else if (metrics.syllableRate < T.syllableRate.healthy) {
        flags.push({ metric: 'syllableRate', severity: 'slight', value: metrics.syllableRate });
        score = Math.max(score, 1);
      }
    }

    if (metrics.pitchRange !== null) {
      if (metrics.pitchRange < T.pitchRange.severe) {
        flags.push({ metric: 'pitchRange', severity: 'severe', value: metrics.pitchRange });
        score = Math.max(score, 4);
      } else if (metrics.pitchRange < T.pitchRange.moderate) {
        flags.push({ metric: 'pitchRange', severity: 'moderate', value: metrics.pitchRange });
        score = Math.max(score, 3);
      } else if (metrics.pitchRange < T.pitchRange.mild) {
        flags.push({ metric: 'pitchRange', severity: 'mild', value: metrics.pitchRange });
        score = Math.max(score, 2);
      } else if (metrics.pitchRange < T.pitchRange.healthy) {
        flags.push({ metric: 'pitchRange', severity: 'slight', value: metrics.pitchRange });
        score = Math.max(score, 1);
      }
    }

    // UPDRS labels
    const labels = {
      0: 'Normal',
      1: 'Slight',
      2: 'Mild',
      3: 'Moderate',
      4: 'Severe'
    };

    return {
      score,
      label: labels[score],
      flags,
      tasksCompleted: this.taskResults.filter(r => !r.metrics?.skipped).length,
      totalTasks: VoiceProtocol.TASKS.length
    };
  }

  /**
   * Get clinical interpretation text
   * @param {Object} updrs - UPDRS result
   * @param {Object} metrics - Aggregated metrics
   * @returns {string} Clinical interpretation
   */
  getClinicalInterpretation(updrs, metrics) {
    const interpretations = {
      0: 'Voice characteristics are within normal limits. No significant indicators of motor speech impairment detected.',
      1: 'Slight deviation detected in one or more voice parameters. May indicate early or subtle changes in speech motor control. Consider monitoring over time.',
      2: 'Mild abnormalities detected. Voice may sound slightly monotone or show reduced variation. Clinical correlation recommended.',
      3: 'Moderate impairment detected. Speech may be noticeably affected with reduced articulation precision and prosody. Neurological evaluation recommended.',
      4: 'Severe abnormalities detected across multiple voice parameters. Significant motor speech impairment indicated. Urgent neurological consultation recommended.'
    };

    let text = interpretations[updrs.score];

    // Add specific findings
    if (updrs.flags.length > 0) {
      const flagDescriptions = updrs.flags.map(f => {
        const metricNames = {
          jitter: 'vocal instability',
          shimmer: 'amplitude variation',
          hnr: 'voice quality',
          syllableRate: 'articulation speed',
          pitchRange: 'pitch variation',
          loudnessVariation: 'loudness control'
        };
        return metricNames[f.metric] || f.metric;
      });

      const uniqueFindings = [...new Set(flagDescriptions)];
      text += ` Key findings: ${uniqueFindings.join(', ')}.`;
    }

    return text;
  }

  /**
   * Utility: delay for specified time
   * @param {number} ms - Milliseconds to delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export for use in other modules
window.VoiceProtocol = VoiceProtocol;

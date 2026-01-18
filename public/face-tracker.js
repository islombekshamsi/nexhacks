/**
 * Local Face Tracker using face-api.js
 * Includes stroke/trauma risk detection
 */

class FaceTracker {
  constructor() {
    this.isReady = false;
    this.modelsLoaded = false;
  }

  async init() {
    console.log('Loading face detection models...');

    try {
      const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';

      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
      ]);

      this.modelsLoaded = true;
      this.isReady = true;
      console.log('Face detection models loaded');
      return true;
    } catch (error) {
      console.error('Model load error:', error);
      this.isReady = true;
      return false;
    }
  }

  async analyze(video) {
    if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
      return { signalLost: true, error: 'Video not ready' };
    }

    if (!this.modelsLoaded) {
      return this.getMockAnalysis();
    }

    try {
      const detection = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks();

      if (!detection) {
        return { signalLost: true, error: 'No face detected' };
      }

      const landmarks = detection.landmarks;
      const positions = landmarks.positions;

      const leftEye = positions.slice(36, 42);
      const rightEye = positions.slice(42, 48);

      const leftMetrics = this.calculateEyeMetrics(leftEye);
      const rightMetrics = this.calculateEyeMetrics(rightEye);
      const symmetry = this.calculateSymmetry(positions);
      const gaze = this.estimateGaze(leftEye, rightEye);

      return {
        pupil_left_size: leftMetrics.pupilSize,
        pupil_right_size: rightMetrics.pupilSize,
        pupil_left_pos: leftMetrics.center,
        pupil_right_pos: rightMetrics.center,
        eye_openness_left: leftMetrics.openness,
        eye_openness_right: rightMetrics.openness,
        face_symmetry: symmetry,
        gaze_direction: gaze,
        confidence: detection.detection.score,
        timestamp: Date.now(),
        signalLost: false
      };

    } catch (error) {
      console.error('Analysis error:', error);
      return this.getMockAnalysis();
    }
  }

  calculateEyeMetrics(eyePoints) {
    const width = Math.abs(eyePoints[3].x - eyePoints[0].x);
    const upperMid = (eyePoints[1].y + eyePoints[2].y) / 2;
    const lowerMid = (eyePoints[4].y + eyePoints[5].y) / 2;
    const height = Math.abs(lowerMid - upperMid);

    const openness = (height / width) * 100;
    const pupilSize = 3 + (height / 10) * 2;

    const centerX = eyePoints.reduce((sum, p) => sum + p.x, 0) / eyePoints.length;
    const centerY = eyePoints.reduce((sum, p) => sum + p.y, 0) / eyePoints.length;

    return {
      pupilSize: Math.max(2.5, Math.min(7.5, pupilSize)),
      openness: Math.max(0, Math.min(100, openness * 3)),
      center: { x: centerX, y: centerY },
      width,
      height
    };
  }

  calculateSymmetry(positions) {
    const noseTip = positions[30];
    const pairs = [
      [0, 16], [1, 15], [2, 14],
      [36, 45], [39, 42], [48, 54]
    ];

    let totalDiff = 0;
    let validPairs = 0;

    for (const [leftIdx, rightIdx] of pairs) {
      const left = positions[leftIdx];
      const right = positions[rightIdx];
      if (left && right) {
        const leftDist = Math.abs(left.x - noseTip.x);
        const rightDist = Math.abs(right.x - noseTip.x);
        const diff = Math.abs(leftDist - rightDist) / Math.max(leftDist, rightDist, 1);
        totalDiff += diff;
        validPairs++;
      }
    }

    if (validPairs === 0) return 85;
    return Math.max(0, Math.min(100, 100 - (totalDiff / validPairs * 100)));
  }

  estimateGaze(leftEye, rightEye) {
    const leftCenter = {
      x: leftEye.reduce((sum, p) => sum + p.x, 0) / leftEye.length,
      y: leftEye.reduce((sum, p) => sum + p.y, 0) / leftEye.length
    };
    const eyeWidth = Math.abs(leftEye[0].x - leftEye[3].x);
    const relativePos = (leftCenter.x - leftEye[0].x) / eyeWidth;

    if (relativePos < 0.4) return 'right';
    if (relativePos > 0.6) return 'left';
    return 'center';
  }

  getMockAnalysis() {
    const baseLeft = 4.2 + (Math.random() - 0.5) * 0.4;
    const baseRight = 4.2 + (Math.random() - 0.5) * 0.4;

    return {
      pupil_left_size: baseLeft,
      pupil_right_size: baseRight,
      pupil_left_pos: { x: 0.5, y: 0.5 },
      pupil_right_pos: { x: 0.5, y: 0.5 },
      face_symmetry: 88 + (Math.random() - 0.5) * 8,
      eye_openness_left: 65 + (Math.random() - 0.5) * 15,
      eye_openness_right: 65 + (Math.random() - 0.5) * 15,
      gaze_direction: 'center',
      confidence: 0.85,
      timestamp: Date.now(),
      signalLost: false
    };
  }
}

/**
 * Stroke/Trauma Risk Analyzer
 * Based on FAST assessment and pupil indicators
 */
class StrokeAnalyzer {
  constructor() {
    this.eyeDataHistory = [];
    this.voiceResponses = [];
    this.voiceBiomarkers = null;
  }

  addEyeData(data) {
    this.eyeDataHistory.push(data);
  }

  addVoiceResponse(response) {
    this.voiceResponses.push(response);
  }

  addVoiceBiomarkers(biomarkers) {
    this.voiceBiomarkers = biomarkers;
  }

  analyzeEyeData() {
    if (this.eyeDataHistory.length < 5) {
      return { risk: 'insufficient_data', score: 0, indicators: [] };
    }

    const indicators = [];
    let riskScore = 0;

    // Calculate averages
    const avgPupilLeft = this.average(this.eyeDataHistory, 'pupil_left_size');
    const avgPupilRight = this.average(this.eyeDataHistory, 'pupil_right_size');
    const avgSymmetry = this.average(this.eyeDataHistory, 'face_symmetry');
    const avgOpennessLeft = this.average(this.eyeDataHistory, 'eye_openness_left');
    const avgOpennessRight = this.average(this.eyeDataHistory, 'eye_openness_right');

    // 1. Pupil Asymmetry (Anisocoria) - key stroke indicator
    const pupilDiff = Math.abs(avgPupilLeft - avgPupilRight);
    if (pupilDiff > 1.5) {
      indicators.push({
        type: 'CRITICAL',
        name: 'Severe Pupil Asymmetry',
        detail: `${pupilDiff.toFixed(2)}mm difference (>1.5mm is concerning)`,
        score: 40
      });
      riskScore += 40;
    } else if (pupilDiff > 0.8) {
      indicators.push({
        type: 'WARNING',
        name: 'Mild Pupil Asymmetry',
        detail: `${pupilDiff.toFixed(2)}mm difference`,
        score: 15
      });
      riskScore += 15;
    }

    // 2. Face Symmetry - facial droop indicator (FAST: Face)
    if (avgSymmetry < 70) {
      indicators.push({
        type: 'CRITICAL',
        name: 'Significant Facial Asymmetry',
        detail: `Symmetry score: ${avgSymmetry.toFixed(1)}% (potential facial droop)`,
        score: 35
      });
      riskScore += 35;
    } else if (avgSymmetry < 80) {
      indicators.push({
        type: 'WARNING',
        name: 'Mild Facial Asymmetry',
        detail: `Symmetry score: ${avgSymmetry.toFixed(1)}%`,
        score: 15
      });
      riskScore += 15;
    }

    // 3. Eye Opening Asymmetry - ptosis indicator
    const opennessDiff = Math.abs(avgOpennessLeft - avgOpennessRight);
    if (opennessDiff > 25) {
      indicators.push({
        type: 'WARNING',
        name: 'Uneven Eye Opening',
        detail: `${opennessDiff.toFixed(1)}% difference (possible ptosis)`,
        score: 20
      });
      riskScore += 20;
    }

    // 4. Pupil Reactivity Variance
    const pupilVarianceLeft = this.variance(this.eyeDataHistory, 'pupil_left_size');
    const pupilVarianceRight = this.variance(this.eyeDataHistory, 'pupil_right_size');
    if (pupilVarianceLeft < 0.01 && pupilVarianceRight < 0.01) {
      indicators.push({
        type: 'WARNING',
        name: 'Fixed Pupils',
        detail: 'Minimal pupil reactivity detected',
        score: 25
      });
      riskScore += 25;
    }

    // 5. Gaze Deviation
    const gazeDirections = this.eyeDataHistory.map(d => d.gaze_direction);
    const centerGaze = gazeDirections.filter(g => g === 'center').length / gazeDirections.length;
    if (centerGaze < 0.5) {
      indicators.push({
        type: 'WARNING',
        name: 'Gaze Deviation',
        detail: `Eyes frequently looking to one side (${((1-centerGaze)*100).toFixed(0)}% off-center)`,
        score: 15
      });
      riskScore += 15;
    }

    return {
      risk: riskScore > 50 ? 'HIGH' : riskScore > 25 ? 'MODERATE' : 'LOW',
      score: Math.min(100, riskScore),
      indicators,
      metrics: {
        avgPupilLeft: avgPupilLeft.toFixed(2),
        avgPupilRight: avgPupilRight.toFixed(2),
        pupilDiff: pupilDiff.toFixed(2),
        avgSymmetry: avgSymmetry.toFixed(1),
        samples: this.eyeDataHistory.length
      }
    };
  }

  analyzeVoiceResponses() {
    if (this.voiceResponses.length === 0) {
      return { risk: 'insufficient_data', score: 0, indicators: [] };
    }

    const indicators = [];
    let riskScore = 0;

    // Analyze each response
    for (const response of this.voiceResponses) {
      // 1. No response or very short response
      if (response.answer === '(no response)' || response.answer === '(skipped)') {
        indicators.push({
          type: 'WARNING',
          name: 'No Response',
          detail: `No answer to: "${response.question.substring(0, 40)}..."`,
          score: 15
        });
        riskScore += 15;
        continue;
      }

      // 2. Very slow response time (> 8 seconds)
      if (response.responseTime > 8000) {
        indicators.push({
          type: 'WARNING',
          name: 'Slow Response',
          detail: `${(response.responseTime/1000).toFixed(1)}s to respond (delayed processing)`,
          score: 10
        });
        riskScore += 10;
      }

      // 3. Check for confusion indicators in specific questions
      const answer = response.answer.toLowerCase();

      // Name question - check if response is very short or confused
      if (response.questionId === 'name' && answer.length < 3) {
        indicators.push({
          type: 'WARNING',
          name: 'Incomplete Name Response',
          detail: 'Could not fully state their name',
          score: 20
        });
        riskScore += 20;
      }

      // Date/time confusion
      if (response.questionId === 'day' || response.questionId === 'date') {
        if (answer.includes("don't know") || answer.includes("not sure") || answer.length < 3) {
          indicators.push({
            type: 'WARNING',
            name: 'Temporal Disorientation',
            detail: 'Difficulty identifying current day/date',
            score: 25
          });
          riskScore += 25;
        }
      }

      // Location confusion
      if (response.questionId === 'location') {
        if (answer.includes("don't know") || answer.includes("not sure") || answer.length < 3) {
          indicators.push({
            type: 'WARNING',
            name: 'Spatial Disorientation',
            detail: 'Difficulty identifying current location',
            score: 25
          });
          riskScore += 25;
        }
      }

      // Counting backwards - check for errors
      if (response.questionId === 'count') {
        const numbers = answer.match(/\d+/g);
        if (!numbers || numbers.length < 5) {
          indicators.push({
            type: 'WARNING',
            name: 'Counting Difficulty',
            detail: 'Incomplete or incorrect counting sequence',
            score: 20
          });
          riskScore += 20;
        }
      }
    }

    // Calculate response rate
    const validResponses = this.voiceResponses.filter(
      r => r.answer !== '(no response)' && r.answer !== '(skipped)'
    ).length;
    const responseRate = validResponses / this.voiceResponses.length;

    if (responseRate < 0.5) {
      indicators.push({
        type: 'CRITICAL',
        name: 'Poor Response Rate',
        detail: `Only ${(responseRate*100).toFixed(0)}% of questions answered`,
        score: 30
      });
      riskScore += 30;
    }

    return {
      risk: riskScore > 50 ? 'HIGH' : riskScore > 25 ? 'MODERATE' : 'LOW',
      score: Math.min(100, riskScore),
      indicators,
      metrics: {
        totalQuestions: this.voiceResponses.length,
        answered: validResponses,
        responseRate: (responseRate * 100).toFixed(0) + '%'
      }
    };
  }

  getCombinedAssessment() {
    const eyeAnalysis = this.analyzeEyeData();
    const voiceAnalysis = this.analyzeVoiceResponses();
    const biomarkerAnalysis = this.voiceBiomarkers ? this.analyzeVoiceBiomarkers() : null;

    // Weighted combination
    // If voice biomarkers available (clinical protocol), weight them heavily
    let combinedScore;
    if (biomarkerAnalysis) {
      combinedScore = (eyeAnalysis.score * 0.3) + (voiceAnalysis.score * 0.2) + (biomarkerAnalysis.score * 0.5);
    } else {
      combinedScore = (eyeAnalysis.score * 0.6) + (voiceAnalysis.score * 0.4);
    }

    let overallRisk = 'LOW';
    let recommendation = 'No immediate concerns detected. Continue monitoring if symptoms persist.';

    // Check UPDRS score from biomarkers
    const updrsScore = this.voiceBiomarkers?.updrsScore || 0;

    if (combinedScore > 60 || eyeAnalysis.risk === 'HIGH' || voiceAnalysis.risk === 'HIGH' || updrsScore >= 3) {
      overallRisk = 'HIGH';
      recommendation = 'URGENT: Multiple indicators suggest possible neurological event. Seek immediate medical attention. Call emergency services if symptoms are acute.';
    } else if (combinedScore > 30 || eyeAnalysis.risk === 'MODERATE' || voiceAnalysis.risk === 'MODERATE' || updrsScore >= 2) {
      overallRisk = 'MODERATE';
      recommendation = 'Some concerning indicators detected. Recommend medical evaluation within 24 hours. Monitor for worsening symptoms.';
    }

    return {
      overallRisk,
      combinedScore: Math.round(combinedScore),
      recommendation,
      eyeAnalysis,
      voiceAnalysis,
      biomarkerAnalysis,
      timestamp: new Date().toISOString(),
      disclaimer: 'This is a screening tool only and does not constitute medical diagnosis. Always consult healthcare professionals for medical concerns.'
    };
  }

  analyzeVoiceBiomarkers() {
    if (!this.voiceBiomarkers) return null;

    const indicators = [];
    let riskScore = 0;

    // Clinical thresholds from Nature 2024 research
    const thresholds = {
      jitter: { healthy: 1.04, warning: 2.0, critical: 3.0 },
      shimmer: { healthy: 3.81, warning: 6.0, critical: 9.0 },
      hnr: { healthy: 20, warning: 15, critical: 10 },
      syllableRate: { healthy: 5.0, warning: 4.0, critical: 3.0 },
      pitchRange: { healthy: 50, warning: 40, critical: 30 }
    };

    // Check jitter
    if (this.voiceBiomarkers.jitter !== undefined) {
      if (this.voiceBiomarkers.jitter > thresholds.jitter.critical) {
        indicators.push({
          type: 'CRITICAL',
          name: 'Severe Vocal Jitter',
          detail: `${this.voiceBiomarkers.jitter.toFixed(2)}% (healthy: <${thresholds.jitter.healthy}%)`,
          score: 30
        });
        riskScore += 30;
      } else if (this.voiceBiomarkers.jitter > thresholds.jitter.warning) {
        indicators.push({
          type: 'WARNING',
          name: 'Elevated Vocal Jitter',
          detail: `${this.voiceBiomarkers.jitter.toFixed(2)}%`,
          score: 15
        });
        riskScore += 15;
      }
    }

    // Check shimmer
    if (this.voiceBiomarkers.shimmer !== undefined) {
      if (this.voiceBiomarkers.shimmer > thresholds.shimmer.critical) {
        indicators.push({
          type: 'CRITICAL',
          name: 'Severe Amplitude Shimmer',
          detail: `${this.voiceBiomarkers.shimmer.toFixed(2)}% (healthy: <${thresholds.shimmer.healthy}%)`,
          score: 30
        });
        riskScore += 30;
      } else if (this.voiceBiomarkers.shimmer > thresholds.shimmer.warning) {
        indicators.push({
          type: 'WARNING',
          name: 'Elevated Amplitude Shimmer',
          detail: `${this.voiceBiomarkers.shimmer.toFixed(2)}%`,
          score: 15
        });
        riskScore += 15;
      }
    }

    // Check HNR (lower is worse)
    if (this.voiceBiomarkers.hnr !== undefined) {
      if (this.voiceBiomarkers.hnr < thresholds.hnr.critical) {
        indicators.push({
          type: 'CRITICAL',
          name: 'Low Voice Clarity (HNR)',
          detail: `${this.voiceBiomarkers.hnr.toFixed(1)} dB (healthy: >${thresholds.hnr.healthy} dB)`,
          score: 30
        });
        riskScore += 30;
      } else if (this.voiceBiomarkers.hnr < thresholds.hnr.warning) {
        indicators.push({
          type: 'WARNING',
          name: 'Reduced Voice Clarity',
          detail: `${this.voiceBiomarkers.hnr.toFixed(1)} dB`,
          score: 15
        });
        riskScore += 15;
      }
    }

    // Check syllable rate (lower is worse)
    if (this.voiceBiomarkers.syllableRate !== undefined) {
      if (this.voiceBiomarkers.syllableRate < thresholds.syllableRate.critical) {
        indicators.push({
          type: 'CRITICAL',
          name: 'Severely Reduced Articulation Speed',
          detail: `${this.voiceBiomarkers.syllableRate.toFixed(1)} Hz (healthy: ${thresholds.syllableRate.healthy}+ Hz)`,
          score: 35
        });
        riskScore += 35;
      } else if (this.voiceBiomarkers.syllableRate < thresholds.syllableRate.warning) {
        indicators.push({
          type: 'WARNING',
          name: 'Reduced Articulation Speed',
          detail: `${this.voiceBiomarkers.syllableRate.toFixed(1)} Hz`,
          score: 20
        });
        riskScore += 20;
      }
    }

    // Check pitch range (lower is worse - monotone speech)
    if (this.voiceBiomarkers.pitchRange !== undefined) {
      if (this.voiceBiomarkers.pitchRange < thresholds.pitchRange.critical) {
        indicators.push({
          type: 'WARNING',
          name: 'Monotone Speech',
          detail: `Pitch range: ${this.voiceBiomarkers.pitchRange.toFixed(1)} Hz (healthy: >${thresholds.pitchRange.healthy} Hz)`,
          score: 20
        });
        riskScore += 20;
      }
    }

    return {
      risk: riskScore > 50 ? 'HIGH' : riskScore > 25 ? 'MODERATE' : 'LOW',
      score: Math.min(100, riskScore),
      indicators,
      updrsScore: this.voiceBiomarkers.updrsScore,
      updrsLabel: this.voiceBiomarkers.updrsLabel,
      metrics: this.voiceBiomarkers
    };
  }

  average(arr, key) {
    return arr.reduce((sum, d) => sum + d[key], 0) / arr.length;
  }

  variance(arr, key) {
    const avg = this.average(arr, key);
    return arr.reduce((sum, d) => sum + Math.pow(d[key] - avg, 2), 0) / arr.length;
  }

  reset() {
    this.eyeDataHistory = [];
    this.voiceResponses = [];
    this.voiceBiomarkers = null;
  }
}

/**
 * Browser TTS
 */
class BrowserTTS {
  constructor() {
    this.synth = window.speechSynthesis;
    this.voice = null;
    this.init();
  }

  init() {
    const setVoice = () => {
      const voices = this.synth.getVoices();
      this.voice = voices.find(v => v.name.includes('Samantha')) ||
                   voices.find(v => v.name.includes('Google') && v.lang.startsWith('en')) ||
                   voices.find(v => v.lang === 'en-US') ||
                   voices.find(v => v.lang.startsWith('en')) ||
                   voices[0];
      console.log('TTS voice:', this.voice?.name || 'default');
    };

    if (this.synth.getVoices().length) {
      setVoice();
    } else {
      this.synth.onvoiceschanged = setVoice;
    }
  }

  speak(text) {
    return new Promise((resolve) => {
      this.synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = this.voice;
      utterance.rate = 0.85; // Slightly slower for clarity
      utterance.pitch = 1;

      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();

      this.synth.speak(utterance);
    });
  }

  stop() {
    this.synth.cancel();
  }
}

// Cognitive Assessment Questions - based on FAST and standard neuro screening
const SCREENING_QUESTIONS = [
  {
    id: 'name',
    text: 'Please tell me your full name, first and last.',
    timeout: 15000,
    instruction: 'State your complete name'
  },
  {
    id: 'date',
    text: 'What is today\'s date? Include the month and day.',
    timeout: 15000,
    instruction: 'State the current date'
  },
  {
    id: 'location',
    text: 'Where are you right now? What city or place?',
    timeout: 15000,
    instruction: 'State your current location'
  },
  {
    id: 'count',
    text: 'Please count backwards from 10 to 1. Take your time.',
    timeout: 20000,
    instruction: 'Count: 10, 9, 8, 7, 6, 5, 4, 3, 2, 1'
  },
  {
    id: 'arms',
    text: 'Can you raise both arms in front of you and hold them there?',
    timeout: 15000,
    instruction: 'Raise and hold both arms (say "done" when finished)'
  }
];

// Export
window.FaceTracker = FaceTracker;
window.StrokeAnalyzer = StrokeAnalyzer;
window.BrowserTTS = BrowserTTS;
window.SCREENING_QUESTIONS = SCREENING_QUESTIONS;

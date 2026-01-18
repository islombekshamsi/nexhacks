/**
 * Dynamic Mock Data Generator for Neurological Monitoring
 * Simulates realistic facial symmetry and pupil tracking data
 * with temporal patterns, smooth transitions, and occasional events
 */

class DynamicMockDataGenerator {
  constructor() {
    // State variables
    this.time = 0;
    this.baselineSymmetry = 0.08; // Healthy baseline (0-0.15)
    this.baselinePupilSize = 42; // Average pupil diameter in px
    
    // Temporal patterns
    this.symmetryTrend = 0;
    this.pupilTrend = 0;
    
    // Event simulation
    this.nextEventTime = this.time + this.randomEventDelay();
    this.inEvent = false;
    this.eventType = null;
    this.eventProgress = 0;
    
    // Smooth transitions
    this.targetSymmetry = this.baselineSymmetry;
    this.targetPupilSize = this.baselinePupilSize;
    this.currentSymmetry = this.baselineSymmetry;
    this.currentPupilSize = this.baselinePupilSize;
    
    // Facial position (for bbox)
    this.faceX = 160;
    this.faceY = 120;
    this.faceWidth = 280;
    this.faceHeight = 320;
    
    console.log('🎭 Dynamic Mock Data Generator initialized');
  }
  
  /**
   * Generate next frame of mock data
   * Call this at your monitoring frame rate (e.g., 12 FPS)
   */
  generateFrame() {
    this.time += 1;
    
    // Check for events
    if (this.time >= this.nextEventTime && !this.inEvent) {
      this.triggerEvent();
    }
    
    // Update event progress
    if (this.inEvent) {
      this.updateEvent();
    }
    
    // Update baseline trends (slow drift)
    if (Math.random() < 0.02) { // 2% chance per frame
      this.symmetryTrend = (Math.random() - 0.5) * 0.01;
      this.pupilTrend = (Math.random() - 0.5) * 2;
    }
    
    // Apply trends
    this.baselineSymmetry = Math.max(0.05, Math.min(0.25, 
      this.baselineSymmetry + this.symmetryTrend
    ));
    this.baselinePupilSize = Math.max(30, Math.min(55, 
      this.baselinePupilSize + this.pupilTrend * 0.1
    ));
    
    // Set targets (with small random walk)
    this.targetSymmetry = this.baselineSymmetry + (Math.random() - 0.5) * 0.03;
    this.targetPupilSize = this.baselinePupilSize + (Math.random() - 0.5) * 4;
    
    // Smooth interpolation to targets (low-pass filter)
    const alpha = 0.3; // Smoothing factor
    this.currentSymmetry = this.currentSymmetry * (1 - alpha) + this.targetSymmetry * alpha;
    this.currentPupilSize = this.currentPupilSize * (1 - alpha) + this.targetPupilSize * alpha;
    
    // Add physiological noise
    const symmetryNoise = (Math.random() - 0.5) * 0.01;
    const pupilNoise = (Math.random() - 0.5) * 1.5;
    
    const symmetry = Math.max(0.0, Math.min(1.0, 
      this.currentSymmetry + symmetryNoise
    ));
    
    const leftPupilSize = Math.max(25, Math.min(60, 
      this.currentPupilSize + pupilNoise
    ));
    const rightPupilSize = Math.max(25, Math.min(60, 
      this.currentPupilSize + pupilNoise + (Math.random() - 0.5) * 2
    ));
    
    // Calculate pupil positions (with micro-movements)
    const leftPupilX = 200 + Math.sin(this.time * 0.05) * 3 + (Math.random() - 0.5) * 2;
    const leftPupilY = 170 + Math.cos(this.time * 0.07) * 2 + (Math.random() - 0.5) * 2;
    const rightPupilX = 340 + Math.sin(this.time * 0.06) * 3 + (Math.random() - 0.5) * 2;
    const rightPupilY = 170 + Math.cos(this.time * 0.08) * 2 + (Math.random() - 0.5) * 2;
    
    // Face bounding box (with subtle head movement)
    const faceX = this.faceX + Math.sin(this.time * 0.03) * 5;
    const faceY = this.faceY + Math.cos(this.time * 0.04) * 3;
    
    // Confidence (high for mock data, occasional drops)
    const confidence = this.inEvent && this.eventType === 'tracking_loss' 
      ? 0.4 + Math.random() * 0.2 
      : 0.85 + Math.random() * 0.1;
    
    // Build detection result
    const mockData = {
      symmetry: symmetry,
      confidence: confidence,
      bbox: [faceX, faceY, this.faceWidth, this.faceHeight],
      leftEye: true,
      rightEye: true,
      leftPupil: {
        detected: true,
        x: leftPupilX,
        y: leftPupilY,
        diameter_px: leftPupilSize
      },
      rightPupil: {
        detected: true,
        x: rightPupilX,
        y: rightPupilY,
        diameter_px: rightPupilSize
      },
      avgPupilDiameter: (leftPupilSize + rightPupilSize) / 2,
      raw: { 
        source: 'dynamic_mock', 
        time: this.time,
        event: this.inEvent ? this.eventType : null
      }
    };
    
    return mockData;
  }
  
  /**
   * Trigger a random physiological event
   */
  triggerEvent() {
    const events = [
      'blink',
      'pupil_constriction', // Simulates bright light
      'pupil_dilation',     // Simulates dim light or arousal
      'head_movement',
      'asymmetry_spike',    // Brief facial asymmetry
      'tracking_loss'       // Brief loss of detection
    ];
    
    this.eventType = events[Math.floor(Math.random() * events.length)];
    this.inEvent = true;
    this.eventProgress = 0;
    
    console.log(`🎬 Mock event triggered: ${this.eventType}`);
  }
  
  /**
   * Update ongoing event
   */
  updateEvent() {
    this.eventProgress += 1;
    
    switch (this.eventType) {
      case 'blink':
        // 5-frame blink
        if (this.eventProgress < 5) {
          this.targetPupilSize = 10; // Pupils hidden
          this.targetSymmetry = this.baselineSymmetry + 0.05;
        } else {
          this.endEvent();
        }
        break;
        
      case 'pupil_constriction':
        // 30-frame constriction
        if (this.eventProgress < 30) {
          this.targetPupilSize = 30; // Smaller pupils
        } else {
          this.endEvent();
        }
        break;
        
      case 'pupil_dilation':
        // 30-frame dilation
        if (this.eventProgress < 30) {
          this.targetPupilSize = 55; // Larger pupils
        } else {
          this.endEvent();
        }
        break;
        
      case 'head_movement':
        // 20-frame head turn
        if (this.eventProgress < 20) {
          this.faceX = 160 + Math.sin(this.eventProgress * 0.3) * 30;
          this.targetSymmetry = this.baselineSymmetry + Math.abs(Math.sin(this.eventProgress * 0.3)) * 0.1;
        } else {
          this.faceX = 160;
          this.endEvent();
        }
        break;
        
      case 'asymmetry_spike':
        // 15-frame asymmetry increase
        if (this.eventProgress < 15) {
          this.targetSymmetry = this.baselineSymmetry + 0.15;
        } else {
          this.endEvent();
        }
        break;
        
      case 'tracking_loss':
        // 10-frame tracking issue
        if (this.eventProgress < 10) {
          // Confidence drops, handled in generateFrame()
        } else {
          this.endEvent();
        }
        break;
    }
  }
  
  /**
   * End current event
   */
  endEvent() {
    this.inEvent = false;
    this.eventType = null;
    this.eventProgress = 0;
    this.nextEventTime = this.time + this.randomEventDelay();
    
    // Reset targets to baseline
    this.targetSymmetry = this.baselineSymmetry;
    this.targetPupilSize = this.baselinePupilSize;
  }
  
  /**
   * Random delay until next event (in frames)
   * Average: 5-15 seconds at 12 FPS = 60-180 frames
   */
  randomEventDelay() {
    return 60 + Math.floor(Math.random() * 120);
  }
  
  /**
   * Simulate a specific condition (for testing)
   */
  simulateCondition(condition) {
    console.log(`🎭 Simulating condition: ${condition}`);
    
    switch (condition) {
      case 'stroke_asymmetry':
        this.baselineSymmetry = 0.35;
        this.symmetryTrend = 0.002; // Gradual worsening
        break;
        
      case 'parkinsons_tremor':
        // Increase noise/variation
        this.symmetryTrend = (Math.random() - 0.5) * 0.02;
        break;
        
      case 'pupil_abnormality':
        this.baselinePupilSize = 25; // Constricted
        this.pupilTrend = 0;
        break;
        
      case 'normal':
      default:
        this.baselineSymmetry = 0.08;
        this.baselinePupilSize = 42;
        this.symmetryTrend = 0;
        this.pupilTrend = 0;
        break;
    }
  }
  
  /**
   * Reset generator to initial state
   */
  reset() {
    this.time = 0;
    this.baselineSymmetry = 0.08;
    this.baselinePupilSize = 42;
    this.symmetryTrend = 0;
    this.pupilTrend = 0;
    this.inEvent = false;
    this.nextEventTime = this.randomEventDelay();
    console.log('🔄 Mock data generator reset');
  }
}

// Export for use in app
window.DynamicMockDataGenerator = DynamicMockDataGenerator;
console.log('✅ Dynamic Mock Data Generator loaded');

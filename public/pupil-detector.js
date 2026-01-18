/**
 * Pupil Detector - Real pupil detection using image processing
 * Detects actual pupil (dark circle) for Pupillary Light Reflex testing
 */

class PupilDetector {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.debugCanvas = null;
    this.debugCtx = null;
    this.calibrationData = null;
  }

  /**
   * Enable debug visualization
   * @param {HTMLCanvasElement} canvas - Canvas for debug output
   */
  enableDebug(canvas) {
    this.debugCanvas = canvas;
    this.debugCtx = canvas?.getContext('2d');
  }

  /**
   * Detect pupil from video frame using eye landmarks
   * @param {HTMLVideoElement} video - Video element
   * @param {Array} eyePoints - 6 landmark points for one eye
   * @returns {Object} Pupil detection result
   */
  detectPupil(video, eyePoints) {
    if (!video || !eyePoints || eyePoints.length < 6) {
      return { detected: false, error: 'Invalid input' };
    }

    try {
      // Get eye bounding box with padding
      const bounds = this.getEyeBounds(eyePoints, 1.5);

      // Extract eye region from video
      const eyeRegion = this.extractRegion(video, bounds);
      if (!eyeRegion) {
        return { detected: false, error: 'Could not extract eye region' };
      }

      // Find pupil in the eye region
      const pupil = this.findPupilInRegion(eyeRegion, bounds);

      return pupil;
    } catch (error) {
      console.error('Pupil detection error:', error);
      return { detected: false, error: error.message };
    }
  }

  /**
   * Get bounding box for eye region
   * @param {Array} eyePoints - Eye landmark points
   * @param {number} padding - Padding multiplier
   * @returns {Object} Bounding box {x, y, width, height}
   */
  getEyeBounds(eyePoints, padding = 1.2) {
    const xs = eyePoints.map(p => p.x);
    const ys = eyePoints.map(p => p.y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const width = maxX - minX;
    const height = maxY - minY;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Add padding
    const paddedWidth = width * padding;
    const paddedHeight = height * padding * 1.5; // More vertical padding

    return {
      x: centerX - paddedWidth / 2,
      y: centerY - paddedHeight / 2,
      width: paddedWidth,
      height: paddedHeight,
      centerX,
      centerY
    };
  }

  /**
   * Extract region from video frame
   * @param {HTMLVideoElement} video - Video element
   * @param {Object} bounds - Bounding box
   * @returns {ImageData} Extracted image data
   */
  extractRegion(video, bounds) {
    const { x, y, width, height } = bounds;

    // Ensure minimum size
    const minSize = 30;
    const extractWidth = Math.max(minSize, Math.round(width));
    const extractHeight = Math.max(minSize, Math.round(height));

    this.canvas.width = extractWidth;
    this.canvas.height = extractHeight;

    // Draw the eye region
    this.ctx.drawImage(
      video,
      Math.max(0, x), Math.max(0, y), width, height,
      0, 0, extractWidth, extractHeight
    );

    return this.ctx.getImageData(0, 0, extractWidth, extractHeight);
  }

  /**
   * Find pupil in extracted eye region using image processing
   * @param {ImageData} imageData - Eye region image data
   * @param {Object} bounds - Original bounds for coordinate conversion
   * @returns {Object} Pupil detection result
   */
  findPupilInRegion(imageData, bounds) {
    const { data, width, height } = imageData;

    // Convert to grayscale and find dark regions
    const grayscale = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      grayscale[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }

    // Find the darkest region (pupil is darkest part of eye)
    // Use adaptive thresholding based on image statistics
    const stats = this.getImageStats(grayscale);
    const threshold = stats.min + (stats.mean - stats.min) * 0.4;

    // Create binary mask of dark pixels
    const mask = new Uint8Array(width * height);
    for (let i = 0; i < grayscale.length; i++) {
      mask[i] = grayscale[i] < threshold ? 1 : 0;
    }

    // Find connected components (blob detection)
    const blobs = this.findBlobs(mask, width, height);

    if (blobs.length === 0) {
      return { detected: false, error: 'No dark regions found' };
    }

    // Find the most circular blob near the center (likely the pupil)
    const centerX = width / 2;
    const centerY = height / 2;

    let bestBlob = null;
    let bestScore = -Infinity;

    for (const blob of blobs) {
      // Skip very small or very large blobs
      const area = blob.pixels.length;
      const minArea = (width * height) * 0.02; // At least 2% of eye region
      const maxArea = (width * height) * 0.5;  // At most 50% of eye region

      if (area < minArea || area > maxArea) continue;

      // Calculate circularity
      const circularity = this.calculateCircularity(blob, width);

      // Distance from center (prefer central blobs)
      const distFromCenter = Math.sqrt(
        Math.pow(blob.centerX - centerX, 2) +
        Math.pow(blob.centerY - centerY, 2)
      );
      const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
      const centralness = 1 - (distFromCenter / maxDist);

      // Combined score
      const score = circularity * 0.6 + centralness * 0.4;

      if (score > bestScore) {
        bestScore = score;
        bestBlob = blob;
      }
    }

    if (!bestBlob) {
      return { detected: false, error: 'No valid pupil candidate found' };
    }

    // Calculate pupil diameter
    const diameter = Math.sqrt(bestBlob.pixels.length / Math.PI) * 2;

    // Convert to approximate mm (assuming average eye width ~24mm)
    // and eye region in image is about 1/3 of that visible
    const eyeWidthMm = 12; // Approximate visible iris width in mm
    const pixelsPerMm = width / eyeWidthMm;
    const diameterMm = diameter / pixelsPerMm;

    // Debug visualization
    if (this.debugCtx && this.debugCanvas) {
      this.drawDebug(imageData, bestBlob, threshold, grayscale);
    }

    return {
      detected: true,
      x: bounds.x + (bestBlob.centerX / width) * bounds.width,
      y: bounds.y + (bestBlob.centerY / height) * bounds.height,
      diameterPixels: diameter,
      diameterMm: Math.round(diameterMm * 10) / 10,
      area: bestBlob.pixels.length,
      circularity: this.calculateCircularity(bestBlob, width),
      confidence: bestScore,
      regionWidth: width,
      regionHeight: height
    };
  }

  /**
   * Get image statistics
   * @param {Uint8Array} grayscale - Grayscale image data
   * @returns {Object} Statistics {min, max, mean, std}
   */
  getImageStats(grayscale) {
    let min = 255, max = 0, sum = 0;

    for (let i = 0; i < grayscale.length; i++) {
      const v = grayscale[i];
      if (v < min) min = v;
      if (v > max) max = v;
      sum += v;
    }

    const mean = sum / grayscale.length;

    let varianceSum = 0;
    for (let i = 0; i < grayscale.length; i++) {
      varianceSum += Math.pow(grayscale[i] - mean, 2);
    }
    const std = Math.sqrt(varianceSum / grayscale.length);

    return { min, max, mean, std };
  }

  /**
   * Find connected components (blobs) in binary mask
   * @param {Uint8Array} mask - Binary mask
   * @param {number} width - Image width
   * @param {number} height - Image height
   * @returns {Array} Array of blob objects
   */
  findBlobs(mask, width, height) {
    const visited = new Uint8Array(width * height);
    const blobs = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;

        if (mask[idx] === 1 && !visited[idx]) {
          // Start new blob - flood fill
          const blob = this.floodFill(mask, visited, x, y, width, height);
          if (blob.pixels.length > 5) { // Minimum size
            blobs.push(blob);
          }
        }
      }
    }

    return blobs;
  }

  /**
   * Flood fill to find connected component
   * @param {Uint8Array} mask - Binary mask
   * @param {Uint8Array} visited - Visited array
   * @param {number} startX - Start X
   * @param {number} startY - Start Y
   * @param {number} width - Image width
   * @param {number} height - Image height
   * @returns {Object} Blob object
   */
  floodFill(mask, visited, startX, startY, width, height) {
    const pixels = [];
    const stack = [[startX, startY]];
    let sumX = 0, sumY = 0;
    let minX = startX, maxX = startX, minY = startY, maxY = startY;

    while (stack.length > 0) {
      const [x, y] = stack.pop();
      const idx = y * width + x;

      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      if (visited[idx] || mask[idx] !== 1) continue;

      visited[idx] = 1;
      pixels.push({ x, y });
      sumX += x;
      sumY += y;

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      // 4-connectivity
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    return {
      pixels,
      centerX: sumX / pixels.length,
      centerY: sumY / pixels.length,
      minX, maxX, minY, maxY,
      boundingWidth: maxX - minX + 1,
      boundingHeight: maxY - minY + 1
    };
  }

  /**
   * Calculate circularity of a blob (1.0 = perfect circle)
   * @param {Object} blob - Blob object
   * @param {number} imageWidth - Image width for normalization
   * @returns {number} Circularity score 0-1
   */
  calculateCircularity(blob, imageWidth) {
    const area = blob.pixels.length;

    // Calculate perimeter (approximate)
    let perimeter = 0;
    const pixelSet = new Set(blob.pixels.map(p => `${p.x},${p.y}`));

    for (const pixel of blob.pixels) {
      // Count neighbors that are NOT in the blob
      const neighbors = [
        `${pixel.x + 1},${pixel.y}`,
        `${pixel.x - 1},${pixel.y}`,
        `${pixel.x},${pixel.y + 1}`,
        `${pixel.x},${pixel.y - 1}`
      ];
      for (const n of neighbors) {
        if (!pixelSet.has(n)) perimeter++;
      }
    }

    // Circularity = 4 * pi * area / perimeter^2
    // For a perfect circle, this equals 1
    if (perimeter === 0) return 0;
    const circularity = (4 * Math.PI * area) / (perimeter * perimeter);

    return Math.min(1, circularity);
  }

  /**
   * Draw debug visualization
   * @param {ImageData} imageData - Original image data
   * @param {Object} blob - Detected pupil blob
   * @param {number} threshold - Threshold used
   * @param {Uint8Array} grayscale - Grayscale data
   */
  drawDebug(imageData, blob, threshold, grayscale) {
    const { width, height } = imageData;

    this.debugCanvas.width = width * 2;
    this.debugCanvas.height = height;

    // Draw original
    this.debugCtx.putImageData(imageData, 0, 0);

    // Draw processed with pupil highlight
    const processed = this.debugCtx.createImageData(width, height);
    for (let i = 0; i < grayscale.length; i++) {
      const v = grayscale[i];
      processed.data[i * 4] = v;
      processed.data[i * 4 + 1] = v;
      processed.data[i * 4 + 2] = v;
      processed.data[i * 4 + 3] = 255;
    }

    // Highlight pupil pixels in green
    for (const pixel of blob.pixels) {
      const idx = (pixel.y * width + pixel.x) * 4;
      processed.data[idx] = 0;
      processed.data[idx + 1] = 255;
      processed.data[idx + 2] = 0;
    }

    this.debugCtx.putImageData(processed, width, 0);

    // Draw pupil circle
    this.debugCtx.strokeStyle = '#00ff00';
    this.debugCtx.lineWidth = 2;
    this.debugCtx.beginPath();
    const radius = Math.sqrt(blob.pixels.length / Math.PI);
    this.debugCtx.arc(blob.centerX, blob.centerY, radius, 0, Math.PI * 2);
    this.debugCtx.stroke();

    // Draw on right side too
    this.debugCtx.beginPath();
    this.debugCtx.arc(width + blob.centerX, blob.centerY, radius, 0, Math.PI * 2);
    this.debugCtx.stroke();
  }
}

/**
 * Light Reflex Test - Guides user through Pupillary Light Reflex testing
 */
class LightReflexTest {
  constructor(options = {}) {
    this.pupilDetector = options.pupilDetector || new PupilDetector();
    this.faceTracker = options.faceTracker;
    this.video = options.video;
    this.onUpdate = options.onUpdate || (() => {});
    this.onComplete = options.onComplete || (() => {});

    this.state = 'idle'; // idle, baseline, light, measuring, complete
    this.baselineMeasurements = { left: [], right: [] };
    this.lightMeasurements = { left: [], right: [] };
    this.measurementInterval = null;
    this.currentPhase = null;
  }

  // Test phases
  static PHASES = {
    BASELINE: {
      name: 'Baseline Measurement',
      instruction: 'Look at the camera in a dimly lit room. Keep your eyes open and still.',
      duration: 5000, // 5 seconds
      icon: '🌙'
    },
    PREPARE_LIGHT: {
      name: 'Prepare Light',
      instruction: 'Get ready to shine your phone flashlight toward your LEFT eye from the side. Do NOT look directly at the light.',
      duration: 3000,
      icon: '📱'
    },
    LIGHT_LEFT: {
      name: 'Light Test - Left Eye',
      instruction: 'Shine the light toward your LEFT eye from the side. Keep looking at the camera.',
      duration: 5000,
      icon: '💡'
    },
    PREPARE_RIGHT: {
      name: 'Prepare Right Eye',
      instruction: 'Now prepare to test the RIGHT eye.',
      duration: 2000,
      icon: '📱'
    },
    LIGHT_RIGHT: {
      name: 'Light Test - Right Eye',
      instruction: 'Shine the light toward your RIGHT eye from the side. Keep looking at the camera.',
      duration: 5000,
      icon: '💡'
    },
    ANALYZING: {
      name: 'Analyzing Results',
      instruction: 'Processing your results...',
      duration: 1000,
      icon: '🔬'
    }
  };

  /**
   * Start the light reflex test
   */
  async start() {
    console.log('Starting Light Reflex Test...');

    this.state = 'running';
    this.baselineMeasurements = { left: [], right: [] };
    this.lightMeasurements = { left: [], right: [] };

    // Phase 1: Baseline
    await this.runPhase('BASELINE', (data) => {
      this.baselineMeasurements.left.push(data.left);
      this.baselineMeasurements.right.push(data.right);
    });

    // Phase 2: Prepare for light
    await this.runPhase('PREPARE_LIGHT');

    // Phase 3: Light on left eye
    await this.runPhase('LIGHT_LEFT', (data) => {
      this.lightMeasurements.left.push(data.left);
    });

    // Phase 4: Prepare for right
    await this.runPhase('PREPARE_RIGHT');

    // Phase 5: Light on right eye
    await this.runPhase('LIGHT_RIGHT', (data) => {
      this.lightMeasurements.right.push(data.right);
    });

    // Phase 6: Analyze
    await this.runPhase('ANALYZING');

    // Calculate results
    const results = this.analyzeResults();

    this.state = 'complete';
    this.onComplete(results);

    return results;
  }

  /**
   * Run a single phase of the test
   * @param {string} phaseName - Phase name
   * @param {Function} onMeasurement - Callback for each measurement
   */
  async runPhase(phaseName, onMeasurement = null) {
    const phase = LightReflexTest.PHASES[phaseName];
    this.currentPhase = phaseName;

    this.onUpdate({
      phase: phaseName,
      name: phase.name,
      instruction: phase.instruction,
      icon: phase.icon,
      duration: phase.duration,
      progress: 0
    });

    const startTime = Date.now();
    const measurementRate = 100; // Measure every 100ms

    return new Promise((resolve) => {
      const interval = setInterval(async () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(1, elapsed / phase.duration);

        // Take measurement if callback provided
        if (onMeasurement && this.video && this.faceTracker) {
          const measurement = await this.takeMeasurement();
          if (measurement) {
            onMeasurement(measurement);
          }
        }

        this.onUpdate({
          phase: phaseName,
          name: phase.name,
          instruction: phase.instruction,
          icon: phase.icon,
          duration: phase.duration,
          progress,
          elapsed
        });

        if (elapsed >= phase.duration) {
          clearInterval(interval);
          resolve();
        }
      }, measurementRate);
    });
  }

  /**
   * Take a single pupil measurement
   * @returns {Object} Measurement data for both eyes
   */
  async takeMeasurement() {
    try {
      // Get face landmarks
      const detection = await faceapi
        .detectSingleFace(this.video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks();

      if (!detection) return null;

      const positions = detection.landmarks.positions;
      const leftEyePoints = positions.slice(36, 42);
      const rightEyePoints = positions.slice(42, 48);

      // Detect pupils
      const leftPupil = this.pupilDetector.detectPupil(this.video, leftEyePoints);
      const rightPupil = this.pupilDetector.detectPupil(this.video, rightEyePoints);

      return {
        left: leftPupil.detected ? leftPupil.diameterMm : null,
        right: rightPupil.detected ? rightPupil.diameterMm : null,
        leftRaw: leftPupil,
        rightRaw: rightPupil,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Measurement error:', error);
      return null;
    }
  }

  /**
   * Analyze all measurements and calculate results
   * @returns {Object} Analysis results
   */
  analyzeResults() {
    // Calculate averages, filtering out nulls
    const avgBaseline = {
      left: this.calculateAverage(this.baselineMeasurements.left),
      right: this.calculateAverage(this.baselineMeasurements.right)
    };

    const avgLight = {
      left: this.calculateAverage(this.lightMeasurements.left),
      right: this.calculateAverage(this.lightMeasurements.right)
    };

    // Calculate constriction ratio
    // Normal: pupil should constrict (get smaller) by 20-40% when light is applied
    const constriction = {
      left: avgBaseline.left && avgLight.left
        ? ((avgBaseline.left - avgLight.left) / avgBaseline.left) * 100
        : null,
      right: avgBaseline.right && avgLight.right
        ? ((avgBaseline.right - avgLight.right) / avgBaseline.right) * 100
        : null
    };

    // Analyze each eye
    const leftAnalysis = this.analyzeEye('left', avgBaseline.left, avgLight.left, constriction.left);
    const rightAnalysis = this.analyzeEye('right', avgBaseline.right, avgLight.right, constriction.right);

    // Overall assessment
    let overallRisk = 'LOW';
    let interpretation = '';

    if (leftAnalysis.risk === 'HIGH' || rightAnalysis.risk === 'HIGH') {
      overallRisk = 'HIGH';
      interpretation = 'URGENT: One or both pupils show minimal or no response to light. This may indicate a serious neurological condition. Seek immediate medical attention.';
    } else if (leftAnalysis.risk === 'MODERATE' || rightAnalysis.risk === 'MODERATE') {
      overallRisk = 'MODERATE';
      interpretation = 'Reduced pupillary response detected. Consider medical evaluation. This could indicate neurological issues or other conditions affecting the eyes.';
    } else if (leftAnalysis.risk === 'LOW' && rightAnalysis.risk === 'LOW') {
      overallRisk = 'LOW';
      interpretation = 'Both pupils show normal constriction response to light. This is a positive sign indicating normal pupillary light reflex.';
    } else {
      interpretation = 'Unable to get reliable measurements. Please ensure good lighting and camera positioning, then try again.';
    }

    return {
      baseline: avgBaseline,
      withLight: avgLight,
      constriction,
      leftEye: leftAnalysis,
      rightEye: rightAnalysis,
      overallRisk,
      interpretation,
      measurementCounts: {
        baseline: {
          left: this.baselineMeasurements.left.filter(v => v !== null).length,
          right: this.baselineMeasurements.right.filter(v => v !== null).length
        },
        light: {
          left: this.lightMeasurements.left.filter(v => v !== null).length,
          right: this.lightMeasurements.right.filter(v => v !== null).length
        }
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Analyze single eye results
   * @param {string} eye - 'left' or 'right'
   * @param {number} baseline - Baseline diameter in mm
   * @param {number} withLight - Diameter with light in mm
   * @param {number} constriction - Constriction percentage
   * @returns {Object} Eye analysis
   */
  analyzeEye(eye, baseline, withLight, constriction) {
    if (baseline === null || withLight === null || constriction === null) {
      return {
        eye,
        status: 'UNKNOWN',
        risk: 'UNKNOWN',
        baseline: baseline?.toFixed(1) || '--',
        withLight: withLight?.toFixed(1) || '--',
        constriction: '--',
        message: 'Insufficient measurements'
      };
    }

    let status, risk, message;

    // Clinical thresholds for pupillary light reflex:
    // Normal: 20-40% constriction
    // Sluggish: 10-20% constriction
    // Fixed: <10% constriction (concerning for stroke/brain injury)

    if (constriction >= 20) {
      status = 'NORMAL';
      risk = 'LOW';
      message = `Normal response: ${constriction.toFixed(0)}% constriction`;
    } else if (constriction >= 10) {
      status = 'SLUGGISH';
      risk = 'MODERATE';
      message = `Sluggish response: ${constriction.toFixed(0)}% constriction (expected 20-40%)`;
    } else if (constriction >= 0) {
      status = 'FIXED/MINIMAL';
      risk = 'HIGH';
      message = `Minimal response: ${constriction.toFixed(0)}% constriction - CONCERNING`;
    } else {
      // Negative constriction means pupil dilated with light (very abnormal)
      status = 'PARADOXICAL';
      risk = 'HIGH';
      message = `Paradoxical response: Pupil dilated instead of constricting - VERY CONCERNING`;
    }

    return {
      eye,
      status,
      risk,
      baseline: baseline.toFixed(1),
      withLight: withLight.toFixed(1),
      constriction: constriction.toFixed(1),
      message
    };
  }

  /**
   * Calculate average of array, filtering nulls
   * @param {Array} arr - Array of numbers
   * @returns {number|null} Average or null if no valid values
   */
  calculateAverage(arr) {
    const valid = arr.filter(v => v !== null && !isNaN(v));
    if (valid.length === 0) return null;
    return valid.reduce((a, b) => a + b, 0) / valid.length;
  }

  /**
   * Cancel the test
   */
  cancel() {
    this.state = 'cancelled';
    if (this.measurementInterval) {
      clearInterval(this.measurementInterval);
    }
  }
}

// Export
window.PupilDetector = PupilDetector;
window.LightReflexTest = LightReflexTest;

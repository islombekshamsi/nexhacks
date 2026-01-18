/**
 * Overshoot VLM Client
 * Sends webcam frames for pupil and face symmetry analysis
 */

class OvershootClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.overshoot.ai/v1';
    this.lastAnalysis = null;
    this.errorCount = 0;
    this.maxErrors = 5;
  }

  /**
   * Analyze a webcam frame for neuro indicators
   * @param {string} base64Image - Base64 encoded image (with or without data URI prefix)
   * @returns {Promise<Object>} Analysis results
   */
  async analyzeFrame(base64Image) {
    const startTime = Date.now();

    try {
      // Remove data URI prefix if present
      const imageData = base64Image.replace(/^data:image\/\w+;base64,/, '');

      const response = await fetch(`${this.baseUrl}/vision/analyze`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image: imageData,
          analysis_type: 'neuro_assessment',
          features: ['pupils', 'face_symmetry', 'eye_tracking'],
          prompt: `Analyze this face image and extract:
1. Left pupil size (diameter in pixels, estimate 0-100 scale)
2. Right pupil size (diameter in pixels, estimate 0-100 scale)
3. Left pupil position (x, y coordinates normalized 0-1)
4. Right pupil position (x, y coordinates normalized 0-1)
5. Face symmetry score (0-100, where 100 is perfectly symmetric)
6. Eye openness left (0-100)
7. Eye openness right (0-100)
8. Gaze direction (left, right, center, up, down)
9. Confidence score for the detection (0-1)

Return as JSON with keys: pupil_left_size, pupil_right_size, pupil_left_pos, pupil_right_pos, face_symmetry, eye_openness_left, eye_openness_right, gaze_direction, confidence`
        })
      });

      const latency = Date.now() - startTime;

      if (!response.ok) {
        throw new Error(`Overshoot API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Parse the VLM response - handle different response formats
      const analysis = this.parseAnalysis(data);
      analysis.latency = latency;
      analysis.timestamp = Date.now();
      analysis.signalLost = false;

      this.lastAnalysis = analysis;
      this.errorCount = 0;

      return analysis;

    } catch (error) {
      this.errorCount++;
      const latency = Date.now() - startTime;

      console.error(`Overshoot analysis error (${this.errorCount}/${this.maxErrors}):`, error.message);

      // Return signal lost state
      return {
        signalLost: true,
        error: error.message,
        latency,
        timestamp: Date.now(),
        errorCount: this.errorCount,
        // Return last known values if available
        ...(this.lastAnalysis && {
          lastKnown: {
            pupil_left_size: this.lastAnalysis.pupil_left_size,
            pupil_right_size: this.lastAnalysis.pupil_right_size,
            face_symmetry: this.lastAnalysis.face_symmetry
          }
        })
      };
    }
  }

  /**
   * Parse VLM response into structured analysis data
   */
  parseAnalysis(data) {
    // Handle direct JSON response
    if (data.pupil_left_size !== undefined) {
      return this.normalizeAnalysis(data);
    }

    // Handle wrapped response (e.g., { result: {...} } or { analysis: {...} })
    if (data.result) {
      return this.normalizeAnalysis(data.result);
    }
    if (data.analysis) {
      return this.normalizeAnalysis(data.analysis);
    }

    // Handle text response that needs parsing
    if (data.text || data.content || data.response) {
      const text = data.text || data.content || data.response;
      return this.parseTextResponse(text);
    }

    // Handle choices array (OpenAI-like format)
    if (data.choices && data.choices[0]) {
      const content = data.choices[0].message?.content || data.choices[0].text;
      return this.parseTextResponse(content);
    }

    // Fallback: try to extract any numeric values
    return this.normalizeAnalysis(data);
  }

  /**
   * Parse text response containing JSON or key-value pairs
   */
  parseTextResponse(text) {
    try {
      // Try to find JSON in the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return this.normalizeAnalysis(parsed);
      }
    } catch (e) {
      // Continue to fallback parsing
    }

    // Fallback: extract numbers from text using regex
    const numbers = text.match(/\d+\.?\d*/g)?.map(Number) || [];

    return {
      pupil_left_size: numbers[0] || 50,
      pupil_right_size: numbers[1] || 50,
      pupil_left_pos: { x: 0.3, y: 0.5 },
      pupil_right_pos: { x: 0.7, y: 0.5 },
      face_symmetry: numbers[4] || 85,
      eye_openness_left: numbers[5] || 80,
      eye_openness_right: numbers[6] || 80,
      gaze_direction: 'center',
      confidence: 0.5,
      parseMethod: 'fallback'
    };
  }

  /**
   * Normalize analysis data to consistent format
   */
  normalizeAnalysis(data) {
    return {
      pupil_left_size: this.clamp(Number(data.pupil_left_size) || 50, 0, 100),
      pupil_right_size: this.clamp(Number(data.pupil_right_size) || 50, 0, 100),
      pupil_left_pos: data.pupil_left_pos || { x: 0.3, y: 0.5 },
      pupil_right_pos: data.pupil_right_pos || { x: 0.7, y: 0.5 },
      face_symmetry: this.clamp(Number(data.face_symmetry) || 85, 0, 100),
      eye_openness_left: this.clamp(Number(data.eye_openness_left) || 80, 0, 100),
      eye_openness_right: this.clamp(Number(data.eye_openness_right) || 80, 0, 100),
      gaze_direction: data.gaze_direction || 'center',
      confidence: this.clamp(Number(data.confidence) || 0.8, 0, 1)
    };
  }

  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Check if we should consider signal as lost
   */
  isSignalLost() {
    return this.errorCount >= this.maxErrors;
  }

  /**
   * Reset error count (call when connection is restored)
   */
  resetErrors() {
    this.errorCount = 0;
  }
}

module.exports = OvershootClient;

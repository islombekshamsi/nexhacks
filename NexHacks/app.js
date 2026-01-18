const apiUrlInput = document.getElementById("apiUrl");
const apiKeyInput = document.getElementById("apiKey");
const promptInput = document.getElementById("prompt");
const modelInput = document.getElementById("model");
const cameraFacingInput = document.getElementById("cameraFacing");
const streamConfigInput = document.getElementById("streamConfig");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const interrogateBtn = document.getElementById("interrogateBtn");
const statusEl = document.getElementById("status");
const outputEl = document.getElementById("output");
const videoPreview = document.getElementById("videoPreview");
const landmarkCanvas = document.getElementById("landmarkCanvas");
const modeValue = document.getElementById("modeValue");
const medianValue = document.getElementById("medianValue");
const alertValue = document.getElementById("alertValue");
const signalValue = document.getElementById("signalValue");
const pupilValue = document.getElementById("pupilValue");
const trendCanvas = document.getElementById("trendCanvas");
const ackBtn = document.getElementById("ackBtn");
const logEl = document.getElementById("log");
const p95LatencyEl = document.getElementById("p95Latency");
const alertDensityEl = document.getElementById("alertDensity");
const timeToAckEl = document.getElementById("timeToAck");
const framesDroppedEl = document.getElementById("framesDropped");
const statusBadge = document.getElementById("statusBadge");
const fastNegativeToggle = document.getElementById("fastNegativeToggle");

const TARGET_FPS = 12;
const BUFFER_SIZE = 1800; // 2.5 minutes at 12 FPS for continuous baseline tracking
const CONFIDENCE_THRESHOLD = 0.6;
const ADVISORY_THRESHOLD = 0.25;
const CRITICAL_THRESHOLD = 0.4;
const ADVISORY_PERSIST_MS = 30000;
const CRITICAL_PERSIST_MS = 10000;
const HYSTERESIS_CLEAR_MS = 60000;
const DEBOUNCE_MS = 120000;
const SIGNAL_LOST_MS = 30000;

let visionSession = null;
let monitoringTimer = null;
let symmetryBuffer = [];
let pupilBuffer = [];
let confidenceBuffer = [];
let droppedLowConfidence = 0;
let lastOutput = null;
let lastOutputTs = 0;
let signalLostSince = null;
let localPreviewStream = null;
let alertState = {
  level: "none",
  raisedAt: 0,
  acknowledgedAt: 0,
  lastRaisedAtByLevel: {},
};
let advisoryStart = 0;
let criticalStart = 0;
let belowStart = 0;
let interrogationState = "idle";
let interrogationData = null;
let latencyHistory = [];
let alertHistory = [];
let ackHistory = [];
let fastNegativeStart = 0;
let fastNegativeEnabled = false;

const restorePreferences = () => {
  const savedKey = localStorage.getItem("overshoot_api_key");
  const savedUrl = localStorage.getItem("overshoot_api_url");
  const savedModel = localStorage.getItem("overshoot_model");
  const savedPrompt = localStorage.getItem("overshoot_prompt");

  if (savedKey) apiKeyInput.value = savedKey;
  if (savedUrl) apiUrlInput.value = savedUrl;
  if (savedModel) modelInput.value = savedModel;
  if (savedPrompt) promptInput.value = savedPrompt;
};

const persistPreferences = () => {
  localStorage.setItem("overshoot_api_key", apiKeyInput.value.trim());
  localStorage.setItem("overshoot_api_url", apiUrlInput.value.trim());
  localStorage.setItem("overshoot_model", modelInput.value.trim());
  localStorage.setItem("overshoot_prompt", promptInput.value.trim());
};

const setStatus = (message) => {
  statusEl.textContent = message;
};

const appendOutput = (text) => {
  if (outputEl.textContent === "No output yet.") {
    outputEl.textContent = "";
  }
  outputEl.textContent += `${text}\n`;
};

const displayDetectionData = (parsed) => {
  if (!parsed) return;
  
  const detectionCard = document.createElement("div");
  detectionCard.style.padding = "12px";
  detectionCard.style.background = "rgba(122, 162, 247, 0.1)";
  detectionCard.style.borderRadius = "8px";
  detectionCard.style.marginBottom = "8px";
  detectionCard.style.fontFamily = "monospace";
  detectionCard.style.fontSize = "13px";
  detectionCard.style.lineHeight = "1.6";
  detectionCard.style.border = "1px solid rgba(122, 162, 247, 0.3)";
  
  const timestamp = new Date().toLocaleTimeString();
  
  let html = `<div style="color: #7aa2f7; font-weight: bold; margin-bottom: 8px;">🎯 Detection @ ${timestamp}</div>`;
  
  // Facial Symmetry
  html += `<div style="color: #9ece6a;">📊 Facial Symmetry: ${(parsed.symmetry * 100).toFixed(1)}% deviation</div>`;
  html += `<div style="color: #bb9af7;">🎯 Confidence: ${(parsed.confidence * 100).toFixed(1)}%</div>`;
  
  // Face Bounding Box
  if (parsed.bbox) {
    html += `<div style="color: #7dcfff; margin-top: 4px;">📦 Face Box: x=${Math.round(parsed.bbox[0])}, y=${Math.round(parsed.bbox[1])}, w=${Math.round(parsed.bbox[2])}, h=${Math.round(parsed.bbox[3])}</div>`;
  }
  
  // Left Pupil
  if (parsed.leftPupil?.detected) {
    html += `<div style="color: #73daca; margin-top: 8px; font-weight: bold;">👁️ LEFT PUPIL:</div>`;
    html += `<div style="color: #73daca; padding-left: 16px;">• Position: (${Math.round(parsed.leftPupil.x)}, ${Math.round(parsed.leftPupil.y)})</div>`;
    html += `<div style="color: #73daca; padding-left: 16px;">• Diameter: ${parsed.leftPupil.diameter_px.toFixed(1)} pixels</div>`;
  } else {
    html += `<div style="color: #f7768e; margin-top: 8px;">👁️ LEFT PUPIL: Not detected</div>`;
  }
  
  // Right Pupil
  if (parsed.rightPupil?.detected) {
    html += `<div style="color: #73daca; margin-top: 4px; font-weight: bold;">👁️ RIGHT PUPIL:</div>`;
    html += `<div style="color: #73daca; padding-left: 16px;">• Position: (${Math.round(parsed.rightPupil.x)}, ${Math.round(parsed.rightPupil.y)})</div>`;
    html += `<div style="color: #73daca; padding-left: 16px;">• Diameter: ${parsed.rightPupil.diameter_px.toFixed(1)} pixels</div>`;
  } else {
    html += `<div style="color: #f7768e; margin-top: 4px;">👁️ RIGHT PUPIL: Not detected</div>`;
  }
  
  // Average Pupil Diameter
  if (parsed.avgPupilDiameter) {
    html += `<div style="color: #e0af68; margin-top: 8px;">📏 Average Pupil Diameter: ${parsed.avgPupilDiameter.toFixed(1)} pixels</div>`;
  }
  
  detectionCard.innerHTML = html;
  
  // Clear "No output yet" text if present
  if (outputEl.textContent === "No output yet.") {
    outputEl.textContent = "";
  }
  
  outputEl.prepend(detectionCard);
  
  // Keep only last 10 detection cards
  while (outputEl.children.length > 10) {
    outputEl.removeChild(outputEl.lastChild);
  }
};

const logEvent = (message, data = {}) => {
  const timestamp = new Date().toISOString();
  const line = `${timestamp} | ${message} ${JSON.stringify(data)}`;
  logEl.textContent = `${line}\n${logEl.textContent}`.slice(0, 4000);
  
  // Track structured predictions for metrics
  if (message === "vision_result" && data.latency_ms) {
    latencyHistory.push(data.latency_ms);
    if (latencyHistory.length > 100) latencyHistory.shift();
  }
  
  if (message === "alert_raised") {
    alertHistory.push({ timestamp: Date.now(), level: data.level });
    if (alertHistory.length > 20) alertHistory.shift();
  }
  
  if (message === "alert_acknowledged" && data.time_to_ack_ms) {
    ackHistory.push(data.time_to_ack_ms);
    if (ackHistory.length > 10) ackHistory.shift();
  }
};

const setMode = (value) => {
  modeValue.textContent = value;
};

const updateSignal = (value) => {
  signalValue.textContent = value;
};

const updateStatusBadge = (status, confidence) => {
  statusBadge.classList.remove("tracking", "low-confidence", "signal-lost");
  
  if (status === "Signal Lost") {
    statusBadge.textContent = "SIGNAL LOST";
    statusBadge.classList.add("signal-lost");
  } else if (confidence < 0.5) {
    statusBadge.textContent = "LOW CONFIDENCE";
    statusBadge.classList.add("low-confidence");
  } else if (status === "Tracking") {
    statusBadge.textContent = "TRACKING";
    statusBadge.classList.add("tracking");
  } else {
    statusBadge.textContent = "IDLE";
  }
};

const updateAlertPanel = (level, detail, acknowledged) => {
  const panel = document.getElementById("alertPanel");
  panel.classList.remove("advisory", "critical");

  if (level === "advisory") {
    panel.classList.add("advisory");
  }
  if (level === "critical") {
    panel.classList.add("critical");
  }

  panel.querySelector(".alert-title").textContent =
    level === "none" ? "No active alerts" : `${level.toUpperCase()} alert`;
  panel.querySelector(".alert-detail").textContent = detail;

  ackBtn.disabled = level === "none" || acknowledged;
  alertValue.textContent =
    level === "none"
      ? "None"
      : acknowledged
      ? `${level} (acknowledged)`
      : level;
};

const getSourceConfig = () => ({
  type: "camera",
  cameraFacing: cameraFacingInput.value || "environment",
});

const connectVision = async (onResult, onError) => {
  if (!window.RealtimeVision) {
    throw new Error(
      "RealtimeVision SDK not found. Add the Overshoot SDK script to use this demo."
    );
  }

  const source = getSourceConfig();
  const prompt =
    promptInput.value.trim() ||
    "Detect face, eyes, and pupils with high precision. Measure bilateral facial asymmetry (0.0=perfect symmetry, 1.0=maximum deviation). Detect BOTH pupils and measure their diameter in pixels. Focus on accurate pupil center detection and size estimation. Return JSON: {symmetry_deviation: number, confidence: number, left_pupil: {x: number, y: number, diameter_px: number, detected: bool}, right_pupil: {x: number, y: number, diameter_px: number, detected: bool}, face_bbox: [x,y,w,h]}";
  const model = modelInput.value.trim();
  const streamConfigRaw = streamConfigInput.value.trim();
  let streamConfig = null;

  if (streamConfigRaw) {
    try {
      streamConfig = JSON.parse(streamConfigRaw);
    } catch (error) {
      throw new Error("Stream config must be valid JSON.");
    }
  }

  const visionConfig = {
    apiUrl: apiUrlInput.value.trim(),
    apiKey: apiKeyInput.value.trim(),
    prompt,
    source,
  };

  if (model) {
    visionConfig.model = model;
  }

  // Set default processing parameters optimized for continuous monitoring
  visionConfig.processing = streamConfig || {
    clip_length_seconds: 1.0,
    delay_seconds: 0.3,      // Very fast updates (3x per second) for continuous tracking
    fps: 20,                 // High frame rate for maximum data capture
    sampling_ratio: 0.4      // 40% sampling for best detection accuracy
  };

  visionConfig.outputSchema = {
    type: "object",
    properties: {
      symmetry_deviation: { type: "number" },
      confidence: { type: "number" },
      left_pupil: {
        type: "object",
        properties: {
          x: { type: "number" },
          y: { type: "number" },
          diameter_px: { type: "number" },
          detected: { type: "boolean" }
        }
      },
      right_pupil: {
        type: "object",
        properties: {
          x: { type: "number" },
          y: { type: "number" },
          diameter_px: { type: "number" },
          detected: { type: "boolean" }
        }
      },
      face_bbox: { 
        type: "array",
        items: { type: "number" },
        minItems: 4,
        maxItems: 4
      }
    },
    required: ["symmetry_deviation", "confidence"],
  };

  visionConfig.onResult = onResult;
  visionConfig.onError = onError;

  const vision = new window.RealtimeVision(visionConfig);
  await vision.start();
  return vision;
};

const attachPreview = (stream) => {
  if (!stream) return;
  videoPreview.srcObject = stream;
  videoPreview.style.display = "block";
  videoPreview.play().catch(err => {
    logEvent("video_play_error", { message: err.message });
  });
  
  // Sync canvas size with video
  videoPreview.addEventListener('loadedmetadata', () => {
    landmarkCanvas.width = videoPreview.videoWidth || 640;
    landmarkCanvas.height = videoPreview.videoHeight || 480;
  });
};

const drawLandmarks = (bbox, leftEye, rightEye, leftPupil, rightPupil, confidence) => {
  const ctx = landmarkCanvas.getContext("2d");
  ctx.clearRect(0, 0, landmarkCanvas.width, landmarkCanvas.height);
  
  if (!bbox || !Array.isArray(bbox) || bbox.length < 4) return;
  
  const [x, y, w, h] = bbox;
  
  // Scale coordinates from normalized (0-1) to canvas size if needed
  const scaleX = bbox[0] <= 1 ? landmarkCanvas.width : 1;
  const scaleY = bbox[1] <= 1 ? landmarkCanvas.height : 1;
  
  const sx = x * scaleX;
  const sy = y * scaleY;
  const sw = w * scaleX;
  const sh = h * scaleY;
  
  // Draw bounding box with color based on confidence
  let color = "#4ade80"; // green
  if (confidence < 0.5) color = "#ff6b6b"; // red
  else if (confidence < 0.7) color = "#d6a93a"; // yellow
  
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.strokeRect(sx, sy, sw, sh);
  
  // Draw pupil indicators if available, otherwise eye indicators
  if (leftPupil?.detected) {
    const px = leftPupil.x * (leftPupil.x <= 1 ? landmarkCanvas.width : 1);
    const py = leftPupil.y * (leftPupil.y <= 1 ? landmarkCanvas.height : 1);
    const radius = leftPupil.diameter_px / 2;
    
    ctx.strokeStyle = confidence > 0.7 ? "#4ade80" : "#d6a93a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw crosshair
    ctx.beginPath();
    ctx.moveTo(px - 6, py);
    ctx.lineTo(px + 6, py);
    ctx.moveTo(px, py - 6);
    ctx.lineTo(px, py + 6);
    ctx.stroke();
  } else if (leftEye) {
    const eyeY = sy + sh * 0.4;
    const leftEyeX = sx + sw * 0.35;
    ctx.fillStyle = confidence > 0.7 ? "#4ade80" : "#d6a93a";
    ctx.beginPath();
    ctx.arc(leftEyeX, eyeY, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  
  if (rightPupil?.detected) {
    const px = rightPupil.x * (rightPupil.x <= 1 ? landmarkCanvas.width : 1);
    const py = rightPupil.y * (rightPupil.y <= 1 ? landmarkCanvas.height : 1);
    const radius = rightPupil.diameter_px / 2;
    
    ctx.strokeStyle = confidence > 0.7 ? "#4ade80" : "#d6a93a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw crosshair
    ctx.beginPath();
    ctx.moveTo(px - 6, py);
    ctx.lineTo(px + 6, py);
    ctx.moveTo(px, py - 6);
    ctx.lineTo(px, py + 6);
    ctx.stroke();
  } else if (rightEye) {
    const eyeY = sy + sh * 0.4;
    const rightEyeX = sx + sw * 0.65;
    ctx.fillStyle = confidence > 0.7 ? "#4ade80" : "#d6a93a";
    ctx.beginPath();
    ctx.arc(rightEyeX, eyeY, 8, 0, Math.PI * 2);
    ctx.fill();
  }
};

const ensurePreviewStream = async () => {
  logEvent("preview_stream_start", { hasVisionSession: !!visionSession });
  
  const sdkStream = visionSession?.getMediaStream?.();
  if (sdkStream) {
    logEvent("using_sdk_stream", { tracks: sdkStream.getTracks().length });
    attachPreview(sdkStream);
    return;
  }

  try {
    logEvent("requesting_user_media", { facingMode: cameraFacingInput.value });
    localPreviewStream = await navigator.mediaDevices.getUserMedia({
      video: { 
        facingMode: cameraFacingInput.value || "environment",
        width: { ideal: 640 },
        height: { ideal: 480 }
      },
      audio: false,
    });
    logEvent("user_media_success", { tracks: localPreviewStream.getTracks().length });
    attachPreview(localPreviewStream);
  } catch (error) {
    logEvent("camera_error", { message: error.message, name: error.name });
    setStatus("Camera permission denied or unavailable: " + error.message);
  }
};

const parseOutput = (result) => {
  if (!result) return null;
  let payload = result.result ?? result;
  if (result?.ok === false) {
    return null;
  }

  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch (error) {
      payload = { text: payload };
    }
  }

  const symmetry =
    payload?.symmetry_deviation ??
    payload?.symmetryDeviation ??
    payload?.result?.symmetry_deviation ??
    null;
  const confidence =
    payload?.confidence ??
    payload?.result?.confidence ??
    payload?.symmetry_confidence ??
    0.8;

  if (typeof symmetry !== "number") {
    return null;
  }

  const leftPupil = payload?.left_pupil ?? payload?.leftPupil ?? null;
  const rightPupil = payload?.right_pupil ?? payload?.rightPupil ?? null;
  const leftEye = leftPupil?.detected ?? payload?.left_eye_detected ?? payload?.leftEyeDetected ?? false;
  const rightEye = rightPupil?.detected ?? payload?.right_eye_detected ?? payload?.rightEyeDetected ?? false;
  const bbox = payload?.face_bbox ?? payload?.faceBbox ?? null;

  // Calculate average pupil diameter if both detected
  let avgPupilDiameter = null;
  if (leftPupil?.detected && rightPupil?.detected) {
    avgPupilDiameter = (leftPupil.diameter_px + rightPupil.diameter_px) / 2;
  } else if (leftPupil?.detected) {
    avgPupilDiameter = leftPupil.diameter_px;
  } else if (rightPupil?.detected) {
    avgPupilDiameter = rightPupil.diameter_px;
  }

  return {
    symmetry,
    confidence,
    leftEye,
    rightEye,
    leftPupil,
    rightPupil,
    avgPupilDiameter,
    bbox,
    raw: payload,
  };
};

const pushToSymmetryBuffer = (value, confidence) => {
  if (confidence < CONFIDENCE_THRESHOLD) {
    droppedLowConfidence += 1;
    return;
  }

  symmetryBuffer.push(value);
  if (symmetryBuffer.length > BUFFER_SIZE) {
    symmetryBuffer.shift();
  }
  
  confidenceBuffer.push(confidence);
  if (confidenceBuffer.length > BUFFER_SIZE) {
    confidenceBuffer.shift();
  }
};

const pushToPupilBuffer = (pupilDiameter, confidence) => {
  if (confidence < CONFIDENCE_THRESHOLD || pupilDiameter === null) {
    return;
  }

  pupilBuffer.push(pupilDiameter);
  if (pupilBuffer.length > BUFFER_SIZE) {
    pupilBuffer.shift();
  }
};

const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
};

const trendDirection = (values) => {
  if (values.length < 10) return "stable";
  const recent = values.slice(-10);
  const slope = recent[recent.length - 1] - recent[0];
  if (slope > 0.05) return "increasing";
  if (slope < -0.05) return "decreasing";
  return "stable";
};

const aggregateSignals = () => {
  const symmetryMedian = median(symmetryBuffer);
  const pupilMedian = median(pupilBuffer);
  const avgConfidence = confidenceBuffer.length > 0 
    ? confidenceBuffer.reduce((a, b) => a + b, 0) / confidenceBuffer.length 
    : 0;

  // Compute baseline variance index (weighted mean of available signals)
  let baselineVarianceIndex = null;
  if (symmetryMedian !== null && pupilMedian !== null) {
    // Both signals available: weight symmetry more heavily (0.7 vs 0.3)
    // Normalize pupil diameter variance (assume baseline ~40px, variance = abs(pupil - 40) / 40)
    const pupilVariance = Math.abs(pupilMedian - 40) / 40;
    baselineVarianceIndex = (symmetryMedian * 0.7) + (pupilVariance * 0.3);
  } else if (symmetryMedian !== null) {
    baselineVarianceIndex = symmetryMedian;
  }

  const modalityTrends = {
    facial_symmetry: {
      current: symmetryMedian,
      trend: trendDirection(symmetryBuffer),
      alert: symmetryMedian !== null && symmetryMedian > CRITICAL_THRESHOLD ? "critical" 
            : symmetryMedian !== null && symmetryMedian > ADVISORY_THRESHOLD ? "advisory" 
            : "none"
    },
    pupil_size: {
      current: pupilMedian,
      trend: trendDirection(pupilBuffer),
      alert: "none" // Pupil alerts not yet implemented
    }
  };

  return {
    baseline_variance_index: baselineVarianceIndex,
    modality_trends: modalityTrends,
    overall_confidence: avgConfidence,
    frames_analyzed: symmetryBuffer.length,
    frames_dropped_low_confidence: droppedLowConfidence
  };
};

const updateTrend = () => {
  const ctx = trendCanvas.getContext("2d");
  const width = trendCanvas.width;
  const height = trendCanvas.height;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#0f1322";
  ctx.fillRect(0, 0, width, height);

  const drawThreshold = (value, color) => {
    const y = height - value * height;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  };

  drawThreshold(ADVISORY_THRESHOLD, "#d6a93a");
  drawThreshold(CRITICAL_THRESHOLD, "#ff6b6b");

  // Draw symmetry line (blue)
  if (symmetryBuffer.length) {
    ctx.strokeStyle = "#7aa2f7";
    ctx.lineWidth = 2;
    ctx.beginPath();
    symmetryBuffer.forEach((value, index) => {
      const x = (index / (BUFFER_SIZE - 1)) * width;
      const y = height - value * height;
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
  }

  // Draw pupil variance line (purple) - normalized
  if (pupilBuffer.length) {
    ctx.strokeStyle = "#c678dd";
    ctx.lineWidth = 2;
    ctx.beginPath();
    pupilBuffer.forEach((value, index) => {
      const x = (index / (BUFFER_SIZE - 1)) * width;
      // Normalize pupil diameter to 0-1 range (assume 20-60px range)
      const normalized = Math.max(0, Math.min(1, (value - 20) / 40));
      const y = height - normalized * height;
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
  }

  // Draw legend
  ctx.font = "12px Inter, sans-serif";
  ctx.fillStyle = "#7aa2f7";
  ctx.fillText("● Symmetry", width - 150, 20);
  ctx.fillStyle = "#c678dd";
  ctx.fillText("● Pupil", width - 150, 35);
};

const evaluateAlert = (medianValue, aggregated) => {
  const now = Date.now();

  if (medianValue === null) {
    return;
  }

  // Check for combined deviation index exceeding critical threshold
  const combinedCritical = aggregated.baseline_variance_index !== null && 
                          aggregated.baseline_variance_index > 0.50;

  if (medianValue >= CRITICAL_THRESHOLD || combinedCritical) {
    criticalStart = criticalStart || now;
    advisoryStart = 0;
    belowStart = 0;

    if (now - criticalStart >= CRITICAL_PERSIST_MS) {
      const detail = combinedCritical && medianValue < CRITICAL_THRESHOLD
        ? "Combined deviation index exceeded critical threshold."
        : "Rolling median exceeded critical threshold.";
      raiseAlert("critical", detail);
    }
    return;
  }

  criticalStart = 0;

  if (medianValue >= ADVISORY_THRESHOLD) {
    advisoryStart = advisoryStart || now;
    belowStart = 0;

    if (now - advisoryStart >= ADVISORY_PERSIST_MS) {
      raiseAlert("advisory", "Rolling median exceeded advisory threshold.");
    }
    return;
  }

  advisoryStart = 0;
  belowStart = belowStart || now;

  if (
    alertState.level !== "none" &&
    alertState.acknowledgedAt &&
    now - belowStart >= HYSTERESIS_CLEAR_MS
  ) {
    clearAlert();
  }
};

const raiseAlert = (level, detail) => {
  const now = Date.now();
  const lastRaised = alertState.lastRaisedAtByLevel[level] || 0;
  if (now - lastRaised < DEBOUNCE_MS && alertState.level === level) {
    return;
  }

  alertState = {
    level,
    raisedAt: now,
    acknowledgedAt: 0,
    lastRaisedAtByLevel: {
      ...alertState.lastRaisedAtByLevel,
      [level]: now,
    },
  };

  updateAlertPanel(level, detail, false);
  logEvent("alert_raised", { level, detail });
};

const clearAlert = () => {
  alertState = {
    level: "none",
    raisedAt: 0,
    acknowledgedAt: 0,
    lastRaisedAtByLevel: alertState.lastRaisedAtByLevel,
  };
  updateAlertPanel("none", "Alerts are advisory only.", true);
  logEvent("alert_cleared");
};

const monitoringTick = () => {
  const now = Date.now();

  const isOutputFresh = now - lastOutputTs < 1500;
  let reading = isOutputFresh
    ? lastOutput
    : {
        symmetry: 0.2 + Math.random() * 0.2,
        confidence: 0.8,
        raw: { stub: true },
      };
  
  // FAST-Negative simulation mode
  if (fastNegativeEnabled && fastNegativeStart > 0) {
    const elapsedMinutes = (now - fastNegativeStart) / 60000;
    // Gradually drift symmetry from 0.2 to 0.3 over 2 minutes
    const drift = Math.min(0.1, (elapsedMinutes / 2) * 0.1);
    if (reading && reading.symmetry !== undefined) {
      reading = {
        ...reading,
        symmetry: reading.symmetry + drift
      };
    }
  }

  if (reading) {
    pushToSymmetryBuffer(reading.symmetry, reading.confidence);
    pushToPupilBuffer(reading.avgPupilDiameter, reading.confidence);
    lastOutputTs = isOutputFresh ? lastOutputTs : now;
  }

  if (!lastOutput || now - lastOutputTs > SIGNAL_LOST_MS) {
    signalLostSince = signalLostSince || now;
  } else {
    signalLostSince = null;
  }

  const currentSignal = (signalLostSince && now - signalLostSince > SIGNAL_LOST_MS) 
    ? "Signal Lost" 
    : "Tracking";
  updateSignal(currentSignal);
  updateStatusBadge(currentSignal, reading?.confidence || 0);

  const aggregated = aggregateSignals();
  const rollingMedian = aggregated.modality_trends.facial_symmetry.current;
  const trend = aggregated.modality_trends.facial_symmetry.trend;
  const pupilMedian = aggregated.modality_trends.pupil_size.current;

  medianValue.textContent =
    rollingMedian === null ? "--" : rollingMedian.toFixed(2);
  
  pupilValue.textContent =
    pupilMedian === null ? "--" : pupilMedian.toFixed(1) + "px";

  evaluateAlert(rollingMedian, aggregated);
  updateAlertPanel(
    alertState.level,
    alertState.level === "none"
      ? "Alerts are advisory only and must be acknowledged."
      : `Trend ${trend}. Frames dropped: ${droppedLowConfidence}.`,
    Boolean(alertState.acknowledgedAt)
  );
  updateTrend();

  // Update metrics dashboard
  updateMetricsDashboard();

  logEvent("monitor_tick", {
    rolling_median: rollingMedian,
    trend,
    baseline_variance_index: aggregated.baseline_variance_index,
    frames_buffered: symmetryBuffer.length,
    dropped_low_confidence: droppedLowConfidence,
    overall_confidence: aggregated.overall_confidence
  });
};

const updateMetricsDashboard = () => {
  // Compute p95 latency
  if (latencyHistory.length > 0) {
    const sorted = [...latencyHistory].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p95 = sorted[p95Index] || 0;
    p95LatencyEl.textContent = p95.toFixed(0) + "ms";
  }

  // Compute alert density (alerts per hour)
  if (alertHistory.length > 0) {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    const recentAlerts = alertHistory.filter(a => a.timestamp > oneHourAgo);
    const density = recentAlerts.length;
    alertDensityEl.textContent = density.toFixed(1) + "/hr";
  }

  // Compute median time to ack
  if (ackHistory.length > 0) {
    const sorted = [...ackHistory].sort((a, b) => a - b);
    const medianIndex = Math.floor(sorted.length / 2);
    const medianMs = sorted[medianIndex] || 0;
    timeToAckEl.textContent = (medianMs / 1000).toFixed(1) + "s";
  }

  // Compute frames dropped percentage
  const totalFrames = symmetryBuffer.length + droppedLowConfidence;
  if (totalFrames > 0) {
    const droppedPct = (droppedLowConfidence / totalFrames) * 100;
    framesDroppedEl.textContent = droppedPct.toFixed(1) + "%";
  }
};

const startMonitoring = async () => {
  outputEl.textContent = "No output yet.";
  logEl.textContent = "";
  setStatus("Starting monitoring...");
  setMode("Monitoring");
  startBtn.disabled = true;
  stopBtn.disabled = true;

  try {
    visionSession = await connectVision(
      (result) => {
        appendOutput(result?.result ?? JSON.stringify(result));
        const parsed = parseOutput(result);
        if (parsed) {
          lastOutput = parsed;
          lastOutputTs = Date.now();
          drawLandmarks(parsed.bbox, parsed.leftEye, parsed.rightEye, parsed.leftPupil, parsed.rightPupil, parsed.confidence);
          
          // Display detection data in Output section
          displayDetectionData(parsed);
          
          // Log structured prediction
          logEvent("vision_result", {
            agent: "face",
            symmetry: parsed.symmetry,
            confidence: parsed.confidence,
            latency_ms: result.total_latency_ms || 0,
            timestamp: Date.now(),
            mode: "monitoring"
          });
        }
      },
      (error) => {
        logEvent("vision_error", { message: error.message });
      }
    );

    await ensurePreviewStream();

    setStatus("Monitoring active.");
    stopBtn.disabled = false;
    interrogateBtn.disabled = false;
    interrogateBtn.textContent = "Start Interrogation";
  } catch (error) {
    setStatus(error.message);
    logEvent("vision_error", { message: error.message });
    stopBtn.disabled = false;
  }

  monitoringTimer = setInterval(monitoringTick, 1000 / TARGET_FPS);
  
  // Enable FAST-Negative mode if toggled
  fastNegativeEnabled = fastNegativeToggle.checked;
  if (fastNegativeEnabled) {
    fastNegativeStart = Date.now();
    logEvent("fast_negative_enabled");
  }
};

const stopMonitoring = async () => {
  setStatus("Stopping monitoring...");
  stopBtn.disabled = true;

  if (monitoringTimer) {
    clearInterval(monitoringTimer);
    monitoringTimer = null;
  }

  if (visionSession && typeof visionSession.stop === "function") {
    try {
      await visionSession.stop();
    } catch (error) {
      appendOutput(`Stop error: ${error.message}`);
    }
  }

  visionSession = null;
  videoPreview.style.display = "none";
  videoPreview.srcObject = null;
  if (localPreviewStream) {
    localPreviewStream.getTracks().forEach((track) => track.stop());
    localPreviewStream = null;
  }
  symmetryBuffer = [];
  pupilBuffer = [];
  confidenceBuffer = [];
  droppedLowConfidence = 0;
  lastOutput = null;
  lastOutputTs = 0;
  signalLostSince = null;
  advisoryStart = 0;
  criticalStart = 0;
  belowStart = 0;
  clearAlert();

  setMode("Idle");
  updateSignal("Waiting");
  updateStatusBadge("Idle", 0);
  setStatus("Monitoring stopped.");
  startBtn.disabled = false;
  fastNegativeStart = 0;
  fastNegativeEnabled = false;
};

const acknowledgeAlert = () => {
  if (alertState.level === "none") return;
  const timeToAck = Date.now() - alertState.raisedAt;
  alertState.acknowledgedAt = Date.now();
  updateAlertPanel(
    alertState.level,
    "Alert acknowledged. Monitoring continues.",
    true
  );
  logEvent("alert_acknowledged", { 
    level: alertState.level, 
    time_to_ack_ms: timeToAck 
  });
};

startBtn.addEventListener("click", startMonitoring);
stopBtn.addEventListener("click", stopMonitoring);
ackBtn.addEventListener("click", acknowledgeAlert);
const startInterrogation = async () => {
  if (interrogationState !== "idle") {
    logEvent("interrogation_already_active");
    return;
  }

  interrogationState = "trigger_check";
  interrogateBtn.disabled = true;
  logEvent("interrogation_start");
  
  try {
    // 1. Trigger Check - verify face detected and duty cycle OK
    if (!lastOutput || !lastOutput.bbox) {
      throw new Error("No face detected. Cannot start interrogation.");
    }

    const dutyStatus = window.hardwareStub.getDutyStatus();
    if (dutyStatus === "DUTY_LIMIT") {
      throw new Error("Hardware duty cycle limit exceeded. Wait before next interrogation.");
    }

    interrogationData = {
      startTime: Date.now(),
      symmetry: null,
      pupil: null,
      speech: null,
      hardware: null
    };

    // 2. Capture - verify face is stable
    interrogationState = "capture";
    logEvent("interrogation_capture");
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (!lastOutput || !lastOutput.bbox) {
      throw new Error("Face lost during capture phase.");
    }

    interrogationData.symmetry = lastOutput.symmetry;

    // 3. Eye Lock - wait for pupil stability
    interrogationState = "eye_lock";
    logEvent("interrogation_eye_lock");
    
    const pupilStable = await waitForPupilStability(500, 0.02);
    if (!pupilStable) {
      logEvent("interrogation_pupil_unstable", { skipping_plr: true });
      // Continue without PLR
    } else {
      // Simulate PLR sweep with hardware stub
      logEvent("interrogation_plr_start");
      await window.hardwareStub.setLED(180);
      await window.hardwareStub.moveLightSource(25);
      await new Promise(resolve => setTimeout(resolve, 2000));
      await window.hardwareStub.moveLightSource(0);
      await window.hardwareStub.setLED(0);
      
      interrogationData.hardware = window.hardwareStub.getStatus();
      interrogationData.pupil = lastOutput.avgPupilDiameter;
      logEvent("interrogation_plr_complete");
    }

    // 4. Speech Analysis
    interrogationState = "speech";
    logEvent("interrogation_speech");
    setStatus("Please say: 'You can't teach an old dog new tricks'");
    
    const audioBlob = await window.speechAnalyzer.captureAudio(5000);
    const speechResult = await window.speechAnalyzer.analyzeArticulation(audioBlob);
    interrogationData.speech = speechResult;
    logEvent("interrogation_speech_complete", speechResult);

    // 5. Aggregate
    interrogationState = "aggregate";
    logEvent("interrogation_aggregate");
    
    const summary = {
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - interrogationData.startTime,
      facial_symmetry: interrogationData.symmetry,
      pupil_diameter: interrogationData.pupil,
      speech_deviation: interrogationData.speech.speech_deviation,
      speech_confidence: interrogationData.speech.confidence,
      transcription: interrogationData.speech.transcription,
      hardware_status: interrogationData.hardware,
      mode: "interrogation"
    };

    appendOutput(`\n=== INTERROGATION SUMMARY ===\n${JSON.stringify(summary, null, 2)}\n`);
    logEvent("interrogation_complete", summary);
    
    // Display result
    alert(`Interrogation Complete\n\nSymmetry: ${summary.facial_symmetry?.toFixed(2) || 'N/A'}\nSpeech Deviation: ${summary.speech_deviation?.toFixed(2) || 'N/A'}\nConfidence: ${summary.speech_confidence?.toFixed(2) || 'N/A'}`);

  } catch (error) {
    logEvent("interrogation_error", { message: error.message, state: interrogationState });
    setStatus(`Interrogation failed: ${error.message}`);
  } finally {
    interrogationState = "idle";
    interrogateBtn.disabled = false;
    setStatus("Monitoring active.");
  }
};

const waitForPupilStability = async (durationMs, varianceThreshold) => {
  const startTime = Date.now();
  const samples = [];
  
  while (Date.now() - startTime < durationMs) {
    if (lastOutput && lastOutput.avgPupilDiameter) {
      samples.push(lastOutput.avgPupilDiameter);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  if (samples.length < 3) return false;

  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const variance = samples.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / samples.length;
  const coefficientOfVariation = Math.sqrt(variance) / mean;

  return coefficientOfVariation < varianceThreshold;
};

interrogateBtn.addEventListener("click", startInterrogation);

apiKeyInput.addEventListener("change", persistPreferences);
apiUrlInput.addEventListener("change", persistPreferences);
modelInput.addEventListener("change", persistPreferences);
promptInput.addEventListener("change", persistPreferences);

restorePreferences();

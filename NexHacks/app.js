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
const pupilRefineToggle = document.getElementById("pupilRefineToggle");
const setupStatusEl = document.getElementById("setupStatus");
const setApiKeyBtn = document.getElementById("setApiKeyBtn");

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

let refineCanvas = null;
let refineCtx = null;

let tfDetector = null;
let tfInterval = null;
let tfRunning = false;
let latestTfPupils = null;

// Fetch API configuration from backend (with fallback)
const loadApiConfig = async () => {
  try {
    console.log('🔄 Fetching API configuration from backend...');
    const response = await fetch('/api/config');
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const config = await response.json();
    console.log('📦 Received config:', { hasApiKey: !!config.apiKey, hasApiUrl: !!config.apiUrl });
    
    if (config.apiKey && config.apiUrl) {
      apiKeyInput.value = config.apiKey;
      apiUrlInput.value = config.apiUrl;
      console.log('✅ API configuration loaded from backend');
      console.log('🔑 API Key set:', apiKeyInput.value.substring(0, 10) + '...');
      return true;
    }
  } catch (error) {
    console.warn('⚠️ Backend API endpoint not available, using fallback:', error.message);
    
    // Fallback: Set API key directly in frontend
    const FALLBACK_API_KEY = "ovs_6bb8b4a55cdc183397938f68c9502c1a";
    const FALLBACK_API_URL = "https://cluster1.overshoot.ai/api/v0.2";
    
    apiKeyInput.value = FALLBACK_API_KEY;
    apiUrlInput.value = FALLBACK_API_URL;
    
    console.log('✅ Using fallback API configuration');
    console.log('🔑 API Key set:', apiKeyInput.value.substring(0, 10) + '...');
    return true;
  }
  return false;
};

const restorePreferences = async () => {
  // Load API config from backend (with fallback)
  const loaded = await loadApiConfig();
  
  // Update status to show API is ready
  if (statusEl) {
    if (loaded) {
      statusEl.textContent = "Ready to start monitoring";
      statusEl.style.color = "#40ffaa";
    } else {
      statusEl.textContent = "⚠️ Configuration error - check console";
      statusEl.style.color = "#ff4040";
    }
  }
  
  // Restore other preferences from localStorage
  const savedRefine = localStorage.getItem("overshoot_pupil_refine");
  if (savedRefine !== null && pupilRefineToggle) {
    pupilRefineToggle.checked = savedRefine === "true";
  } else if (pupilRefineToggle) {
    // Default to enabled for better pupil detection
    pupilRefineToggle.checked = true;
    localStorage.setItem("overshoot_pupil_refine", "true");
  }
};

const persistPreferences = () => {
  // Only persist user preferences, not API key (that's in backend now)
  if (pupilRefineToggle) {
    localStorage.setItem("overshoot_pupil_refine", String(pupilRefineToggle.checked));
  }
};

const updateSetupStatus = () => {
  // No longer needed - API key is in backend
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
  if (!parsed) {
    console.warn("⚠️ displayDetectionData called with null/undefined");
    return;
  }
  
  try {
  
  const detectionCard = document.createElement("div");
  detectionCard.style.padding = "12px";
  detectionCard.style.background = "rgba(122, 162, 247, 0.1)";
  detectionCard.style.borderRadius = "8px";
  detectionCard.style.marginBottom = "8px";
  detectionCard.style.fontFamily = "monospace";
  detectionCard.style.fontSize = "13px";
  detectionCard.style.lineHeight = "1.6";
  detectionCard.style.border = "1px solid rgba(122, 162, 247, 0.3)";
  detectionCard.style.animation = "slideIn 0.2s ease-out";
  detectionCard.style.boxShadow = "0 2px 8px rgba(122, 162, 247, 0.2)";
  
  const timestamp = new Date().toLocaleTimeString();
  const frameCount = symmetryBuffer.length;
  
  let html = `<div style="color: #7aa2f7; font-weight: bold; margin-bottom: 8px;">🎯 Detection @ ${timestamp} <span style="color: #9ece6a; font-size: 11px;">[Frame ${frameCount}]</span></div>`;
  
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
    if (parsed.leftPupil?.refined && parsed.leftPupilRaw) {
      html += `<div style="color: #7aa2f7; padding-left: 16px;">• Refined from (${Math.round(parsed.leftPupilRaw.x)}, ${Math.round(parsed.leftPupilRaw.y)})</div>`;
      if (Number.isFinite(parsed.leftPupil.refinement_quality)) {
        html += `<div style="color: #7aa2f7; padding-left: 16px;">• Refinement quality: ${(parsed.leftPupil.refinement_quality * 100).toFixed(0)}%</div>`;
      }
    }
  } else {
    html += `<div style="color: #f7768e; margin-top: 8px;">👁️ LEFT PUPIL: Not detected</div>`;
  }
  
  // Right Pupil
  if (parsed.rightPupil?.detected) {
    html += `<div style="color: #73daca; margin-top: 4px; font-weight: bold;">👁️ RIGHT PUPIL:</div>`;
    html += `<div style="color: #73daca; padding-left: 16px;">• Position: (${Math.round(parsed.rightPupil.x)}, ${Math.round(parsed.rightPupil.y)})</div>`;
    html += `<div style="color: #73daca; padding-left: 16px;">• Diameter: ${parsed.rightPupil.diameter_px.toFixed(1)} pixels</div>`;
    if (parsed.rightPupil?.refined && parsed.rightPupilRaw) {
      html += `<div style="color: #7aa2f7; padding-left: 16px;">• Refined from (${Math.round(parsed.rightPupilRaw.x)}, ${Math.round(parsed.rightPupilRaw.y)})</div>`;
      if (Number.isFinite(parsed.rightPupil.refinement_quality)) {
        html += `<div style="color: #7aa2f7; padding-left: 16px;">• Refinement quality: ${(parsed.rightPupil.refinement_quality * 100).toFixed(0)}%</div>`;
      }
    }
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
  
  // Keep only last 15 detection cards for continuous scrolling view
  while (outputEl.children.length > 15) {
    outputEl.removeChild(outputEl.lastChild);
  }
  
  console.log("✅ Detection card displayed successfully");
  
  } catch (error) {
    console.error("❌ Error displaying detection data:", error);
    // Fallback: show error message
    const errorCard = document.createElement("div");
    errorCard.style.padding = "12px";
    errorCard.style.background = "rgba(247, 118, 142, 0.1)";
    errorCard.style.borderRadius = "8px";
    errorCard.style.border = "1px solid rgba(247, 118, 142, 0.3)";
    errorCard.innerHTML = `<div style="color: #f7768e;">❌ Error displaying detection: ${error.message}</div>`;
    outputEl.prepend(errorCard);
  }
};

const logEvent = (message, data = {}) => {
  const timestamp = new Date().toISOString();
  const line = `${timestamp} | ${message} ${JSON.stringify(data)}`;
  if (logEl) {
    logEl.textContent = `${line}\n${logEl.textContent}`.slice(0, 4000);
  }
  
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
  updateMagicBentoCards();
};

// Update MagicBento cards with current detection output data
const updateMagicBentoCards = () => {
  if (!magicBento) return;

  const mode = modeValue.textContent || 'Idle';
  const median = medianValue.textContent || '--';
  const alert = alertValue.textContent || 'None';
  const signal = signalValue.textContent || 'Waiting';
  const pupil = pupilValue.textContent || '--';

  // Determine alert state for styling
  let alertState = 'none';
  if (alert.toLowerCase().includes('critical')) alertState = 'critical';
  else if (alert.toLowerCase().includes('advisory')) alertState = 'advisory';

  // Get latest detection data
  const hasData = lastOutput !== null;
  const symmetryScore = hasData ? (lastOutput.symmetry * 100).toFixed(1) + '%' : '--';
  const confidenceScore = hasData ? (lastOutput.confidence * 100).toFixed(0) + '%' : '--';
  const leftEyeStatus = hasData && lastOutput.leftEye ? '✓ Detected' : '✗ Not detected';
  const rightEyeStatus = hasData && lastOutput.rightEye ? '✓ Detected' : '✗ Not detected';
  const pupilLeft = hasData && lastOutput.leftPupil?.detected ? lastOutput.leftPupil.diameter_px.toFixed(1) + 'px' : '--';
  const pupilRight = hasData && lastOutput.rightPupil?.detected ? lastOutput.rightPupil.diameter_px.toFixed(1) + 'px' : '--';
  
  // Calculate frames per second
  const bufferSize = symmetryBuffer.length;
  const fps = bufferSize > 0 ? (bufferSize / ((Date.now() - (lastOutputTs || Date.now())) / 1000)).toFixed(1) : '0';

  const cardData = [
    {
      color: '#0a0e14',
      title: symmetryScore,
      description: hasData ? 'Bilateral facial symmetry measurement' : 'No detection data yet',
      label: 'Symmetry Deviation',
      icon: '⚖️'
    },
    {
      color: '#0a0e14',
      title: confidenceScore,
      description: hasData ? 'Detection confidence level' : 'Awaiting camera input',
      label: 'Confidence',
      icon: '🎯'
    },
    {
      color: '#0a0e14',
      title: leftEyeStatus,
      description: pupilLeft !== '--' ? `Pupil diameter: ${pupilLeft}` : 'Left pupil not detected',
      label: 'Left Eye',
      icon: '👁️'
    },
    {
      color: '#0a0e14',
      title: rightEyeStatus,
      description: pupilRight !== '--' ? `Pupil diameter: ${pupilRight}` : 'Right pupil not detected',
      label: 'Right Eye',
      icon: '👁️'
    },
    {
      color: '#0a0e14',
      title: alert,
      description: alertState === 'critical' ? 'Significant deviation detected' : alertState === 'advisory' ? 'Elevated deviation - monitoring' : 'Within normal baseline',
      label: 'Alert Status',
      icon: alertState === 'critical' ? '🔴' : alertState === 'advisory' ? '🟡' : '🟢'
    },
    {
      color: '#0a0e14',
      title: bufferSize > 0 ? `${bufferSize} frames` : 'Idle',
      description: bufferSize > 0 ? `Processing at ~${fps} FPS` : 'Start monitoring to collect data',
      label: 'Data Buffer',
      icon: '📊'
    }
  ];

  magicBento.updateCards(cardData);

  // Update card attributes for styling
  const cards = document.querySelectorAll('.magic-bento-card');
  cards.forEach((card, index) => {
    if (index === 4) { // Alert card
      card.setAttribute('data-alert', alertState);
    }
    if (hasData && mode === 'Monitoring') {
      card.setAttribute('data-active', 'true');
    } else {
      card.removeAttribute('data-active');
    }
  });
};

const updateSignal = (value) => {
  signalValue.textContent = value;
  updateMagicBentoCards();
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
  updateMagicBentoCards();
};

const getSourceConfig = () => {
  const config = {
    type: "camera",
    cameraFacing: cameraFacingInput.value || "user", // Changed to "user" for front camera
  };
  console.log("📹 Source config:", config);
  return config;
};

const SAFE_PROCESSING = {
  clip_length_seconds: 1,
  delay_seconds: 1,
  fps: 12,
  sampling_ratio: 0.2,
};

const sanitizeProcessing = (input) => {
  if (!input || typeof input !== "object") {
    return { ...SAFE_PROCESSING };
  }

  const clip = Number(input.clip_length_seconds);
  const delay = Number(input.delay_seconds);
  const fps = Number(input.fps);
  const ratio = Number(input.sampling_ratio);

  return {
    clip_length_seconds: Number.isFinite(clip) ? Math.max(1, clip) : SAFE_PROCESSING.clip_length_seconds,
    delay_seconds: Number.isFinite(delay) ? Math.max(1, delay) : SAFE_PROCESSING.delay_seconds,
    fps: Number.isFinite(fps) ? Math.min(30, Math.max(1, fps)) : SAFE_PROCESSING.fps,
    sampling_ratio: Number.isFinite(ratio) ? Math.min(0.2, Math.max(0.05, ratio)) : SAFE_PROCESSING.sampling_ratio,
  };
};

const connectVision = async (onResult, onError) => {
  if (!window.RealtimeVision) {
    throw new Error(
      "RealtimeVision SDK not found. Add the Overshoot SDK script to use this demo."
    );
  }

  const source = getSourceConfig();
  const prompt =
    promptInput.value.trim() ||
    "Detect face and eyes. For each eye, locate the pupil center (x, y coordinates) and measure pupil diameter in pixels. Calculate facial symmetry as a score from 0.0 (symmetric) to 1.0 (asymmetric). Return: symmetry_deviation, confidence, left_pupil (x, y, diameter_px, detected), right_pupil (x, y, diameter_px, detected), face_bbox.";
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

  // Only send processing config if user explicitly provided it
  if (streamConfigRaw && streamConfig) {
    const sanitizedProcessing = sanitizeProcessing(streamConfig);
    visionConfig.processing = sanitizedProcessing;

    const requested = JSON.stringify(streamConfig);
    const applied = JSON.stringify(sanitizedProcessing);
    if (requested !== applied) {
      appendOutput("Processing settings adjusted to safe values to pass API validation.");
      logEvent("processing_sanitized", { requested: streamConfig, applied: sanitizedProcessing });
    }
  }

  visionConfig.onResult = onResult;
  visionConfig.onError = onError;

  // Log the config being sent (without sensitive API key)
  console.log("🔧 Vision Config:", {
    ...visionConfig,
    apiKey: visionConfig.apiKey ? "***" + visionConfig.apiKey.slice(-8) : "missing",
  });

  const vision = new window.RealtimeVision(visionConfig);
  console.log("📡 Starting vision session...");
  await vision.start();
  console.log("✅ Vision session started successfully");
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
  // Overlay disabled - clear canvas and return
  const ctx = landmarkCanvas.getContext("2d");
  ctx.clearRect(0, 0, landmarkCanvas.width, landmarkCanvas.height);
  return;
  
  /* OVERLAY CODE DISABLED - uncomment to re-enable
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
  */
};

const loadTfDetector = async () => {
  if (tfDetector) {
    return tfDetector;
  }
  if (!window.faceLandmarksDetection) {
    throw new Error("TensorFlow face landmarks library not loaded.");
  }

  const model = window.faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
  tfDetector = await window.faceLandmarksDetection.createDetector(model, {
    runtime: "tfjs",
    refineLandmarks: true,
    maxFaces: 1,
  });

  return tfDetector;
};

const averageKeypoints = (keypoints, indices) => {
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  indices.forEach((idx) => {
    const point = keypoints[idx];
    if (!point) return;
    sumX += point.x;
    sumY += point.y;
    count += 1;
  });

  if (!count) return null;
  return { x: sumX / count, y: sumY / count, quality: 1 };
};

const updateTfPupils = async () => {
  if (!pupilRefineToggle?.checked || !videoPreview.videoWidth || !videoPreview.videoHeight) {
    console.log("⏭️ Skipping TensorFlow update - conditions not met");
    return;
  }

  if (tfRunning) {
    return;
  }
  
  console.log("🔄 Running TensorFlow pupil detection...");
  tfRunning = true;

  try {
    console.log("📦 Loading TensorFlow detector...");
    const detector = await loadTfDetector();
    console.log("✅ Detector loaded, estimating faces...");
    
    const predictions = await detector.estimateFaces(videoPreview, { flipHorizontal: false });
    console.log(`🔍 TensorFlow predictions: ${predictions?.length || 0} faces found`);
    
    if (predictions && predictions.length > 0) {
      const keypoints = predictions[0].keypoints || [];
      console.log(`📍 Keypoints found: ${keypoints.length}`);
      
      const left = averageKeypoints(keypoints, [468, 469, 470, 471, 472]);
      const right = averageKeypoints(keypoints, [473, 474, 475, 476, 477]);
      
      latestTfPupils = {
        left,
        right,
        ts: Date.now(),
      };
      
      console.log("👁️ TensorFlow detected pupils:", {
        left: left ? `(${Math.round(left.x)}, ${Math.round(left.y)}) quality:${(left.quality * 100).toFixed(0)}%` : 'none',
        right: right ? `(${Math.round(right.x)}, ${Math.round(right.y)}) quality:${(right.quality * 100).toFixed(0)}%` : 'none'
      });
    } else {
      console.warn("⚠️ TensorFlow: No face detected in frame");
    }
  } catch (error) {
    console.error("❌ TensorFlow error:", error.message);
    logEvent("tf_refine_error", { message: error.message });
  } finally {
    tfRunning = false;
  }
};

const startTfRefinement = () => {
  if (tfInterval || !pupilRefineToggle?.checked) {
    console.log("⚠️ TensorFlow refinement already running or disabled");
    return;
  }
  console.log("✅ TensorFlow refinement started - updating every 300ms");
  tfInterval = setInterval(updateTfPupils, 300);
  // Run immediately
  updateTfPupils();
};

const stopTfRefinement = () => {
  if (tfInterval) {
    clearInterval(tfInterval);
    tfInterval = null;
  }
  latestTfPupils = null;
};

const applyTfRefinement = (parsed) => {
  if (!parsed || !pupilRefineToggle?.checked || !latestTfPupils) {
    return parsed;
  }

  const stale = Date.now() - latestTfPupils.ts > 1500;
  if (stale) {
    return parsed;
  }

  const leftBase = parsed.leftPupil || { detected: false, x: 0, y: 0, diameter_px: 35 };
  const rightBase = parsed.rightPupil || { detected: false, x: 0, y: 0, diameter_px: 35 };

  const left = latestTfPupils.left
    ? {
        ...leftBase,
        detected: true,
        x: latestTfPupils.left.x,
        y: latestTfPupils.left.y,
        diameter_px: leftBase.diameter_px || 35, // Use base diameter or default
        refined: "tf",
        refinement_quality: latestTfPupils.left.quality ?? 1,
      }
    : leftBase;

  const right = latestTfPupils.right
    ? {
        ...rightBase,
        detected: true,
        x: latestTfPupils.right.x,
        y: latestTfPupils.right.y,
        diameter_px: rightBase.diameter_px || 35, // Use base diameter or default
        refined: "tf",
        refinement_quality: latestTfPupils.right.quality ?? 1,
      }
    : rightBase;

  // Update eye detection status based on TensorFlow results
  const leftEyeDetected = left.detected || parsed.leftEye;
  const rightEyeDetected = right.detected || parsed.rightEye;

  console.log("🤖 TensorFlow refinement applied:", {
    leftDetected: left.detected,
    rightDetected: right.detected,
    leftEyeDetected,
    rightEyeDetected
  });

  return {
    ...parsed,
    leftPupilRaw: parsed.leftPupil,
    rightPupilRaw: parsed.rightPupil,
    leftPupil: left,
    rightPupil: right,
    leftEye: leftEyeDetected,
    rightEye: rightEyeDetected,
  };
};

const ensureRefineContext = () => {
  if (!refineCanvas) {
    refineCanvas = document.createElement("canvas");
    refineCtx = refineCanvas.getContext("2d", { willReadFrequently: true });
  }

  if (!videoPreview.videoWidth || !videoPreview.videoHeight) {
    return null;
  }

  if (refineCanvas.width !== videoPreview.videoWidth || refineCanvas.height !== videoPreview.videoHeight) {
    refineCanvas.width = videoPreview.videoWidth;
    refineCanvas.height = videoPreview.videoHeight;
  }

  refineCtx.drawImage(videoPreview, 0, 0, refineCanvas.width, refineCanvas.height);
  return refineCtx;
};

const refinePupil = (pupil) => {
  if (!pupil?.detected) {
    return { ...pupil, refined: false };
  }

  const ctx = ensureRefineContext();
  if (!ctx) {
    return { ...pupil, refined: false };
  }

  const vw = refineCanvas.width;
  const vh = refineCanvas.height;
  const px = pupil.x <= 1 ? pupil.x * vw : pupil.x;
  const py = pupil.y <= 1 ? pupil.y * vh : pupil.y;
  const radius = Math.max(6, Math.min(30, (pupil.diameter_px || 16) / 2));

  const x0 = Math.max(0, Math.floor(px - radius));
  const y0 = Math.max(0, Math.floor(py - radius));
  const w = Math.min(vw - x0, Math.ceil(radius * 2));
  const h = Math.min(vh - y0, Math.ceil(radius * 2));

  if (w <= 2 || h <= 2) {
    return { ...pupil, refined: false };
  }

  const image = ctx.getImageData(x0, y0, w, h);
  const data = image.data;

  let minL = Infinity;
  let minX = px;
  let minY = py;
  let sumL = 0;
  let count = 0;

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const idx = (y * w + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      sumL += l;
      count += 1;
      if (l < minL) {
        minL = l;
        minX = x0 + x;
        minY = y0 + y;
      }
    }
  }

  const avgL = count ? sumL / count : minL;
  const quality = avgL > 0 ? Math.max(0, Math.min(1, (avgL - minL) / avgL)) : 0;

  return {
    ...pupil,
    x: minX,
    y: minY,
    refined: true,
    refinement_quality: Number.isFinite(quality) ? quality : 0,
  };
};

const refinePupilCenters = (parsed) => {
  if (!parsed || !pupilRefineToggle?.checked) {
    return parsed;
  }

  const leftRefined = refinePupil(parsed.leftPupil);
  const rightRefined = refinePupil(parsed.rightPupil);

  return {
    ...parsed,
    leftPupilRaw: parsed.leftPupil,
    rightPupilRaw: parsed.rightPupil,
    leftPupil: leftRefined,
    rightPupil: rightRefined,
  };
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
  console.log("🔍 parseOutput called with:", result);
  
  if (!result) {
    console.warn("⚠️ parseOutput: result is null/undefined");
    return null;
  }
  
  let payload = result.result ?? result;
  console.log("📦 Extracted payload:", payload);
  
  if (result?.ok === false) {
    console.warn("⚠️ parseOutput: result.ok is false");
    return null;
  }

  if (typeof payload === "string") {
    console.log("🔄 Parsing string payload...");
    try {
      payload = JSON.parse(payload);
      console.log("✅ Parsed JSON:", payload);
    } catch (error) {
      console.warn("⚠️ JSON parse failed:", error);
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
    console.warn("⚠️ parseOutput: symmetry is not a number:", symmetry, "type:", typeof symmetry);
    console.log("Full payload for debugging:", payload);
    return null;
  }
  
  console.log("✅ Valid symmetry found:", symmetry);

  let leftPupil = payload?.left_pupil ?? payload?.leftPupil ?? null;
  let rightPupil = payload?.right_pupil ?? payload?.rightPupil ?? null;
  
  // If Overshoot doesn't provide pupil data, create placeholder that TensorFlow can fill
  if (!leftPupil) {
    leftPupil = { detected: false, x: 0, y: 0, diameter_px: 0 };
  }
  if (!rightPupil) {
    rightPupil = { detected: false, x: 0, y: 0, diameter_px: 0 };
  }
  
  // Check if eyes are detected - be more lenient with detection
  const leftEye = leftPupil?.detected ?? payload?.left_eye_detected ?? payload?.leftEyeDetected ?? true; // Assume eyes present if face detected
  const rightEye = rightPupil?.detected ?? payload?.right_eye_detected ?? payload?.rightEyeDetected ?? true;
  
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
  const safePupilMedian = Number.isFinite(pupilMedian) ? pupilMedian : null;

  medianValue.textContent =
    rollingMedian === null ? "--" : rollingMedian.toFixed(2);
  
  pupilValue.textContent =
    safePupilMedian === null ? "--" : safePupilMedian.toFixed(1) + "px";
  
  updateMagicBentoCards();

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
  if (p95LatencyEl && latencyHistory.length > 0) {
    const sorted = [...latencyHistory].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p95 = sorted[p95Index] || 0;
    p95LatencyEl.textContent = p95.toFixed(0) + "ms";
  }

  // Compute alert density (alerts per hour)
  if (alertDensityEl && alertHistory.length > 0) {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    const recentAlerts = alertHistory.filter(a => a.timestamp > oneHourAgo);
    const density = recentAlerts.length;
    alertDensityEl.textContent = density.toFixed(1) + "/hr";
  }

  // Compute median time to ack
  if (timeToAckEl && ackHistory.length > 0) {
    const sorted = [...ackHistory].sort((a, b) => a - b);
    const medianIndex = Math.floor(sorted.length / 2);
    const medianMs = sorted[medianIndex] || 0;
    timeToAckEl.textContent = (medianMs / 1000).toFixed(1) + "s";
  }

  // Compute frames dropped percentage
  const totalFrames = symmetryBuffer.length + droppedLowConfidence;
  if (framesDroppedEl && totalFrames > 0) {
    const droppedPct = (droppedLowConfidence / totalFrames) * 100;
    framesDroppedEl.textContent = droppedPct.toFixed(1) + "%";
  }
};

// Initialize dynamic mock data generator
let mockDataGenerator = null;
let useMockData = false; // Toggle between Overshoot and mock data
let mockDataInterval = null;

const initMockDataGenerator = () => {
  if (window.DynamicMockDataGenerator) {
    mockDataGenerator = new window.DynamicMockDataGenerator();
    console.log('✅ Mock data generator initialized');
  } else {
    console.warn('⚠️ DynamicMockDataGenerator not loaded');
  }
};

// Legacy dummy data generator (kept for compatibility)
const generateDummyDetection = () => {
  if (mockDataGenerator) {
    return mockDataGenerator.generateFrame();
  }
  
  // Fallback to simple random data
  return {
    symmetry: 0.15 + Math.random() * 0.2,
    confidence: 0.7 + Math.random() * 0.2,
    bbox: [150 + Math.random() * 20, 100 + Math.random() * 20, 280 + Math.random() * 40, 320 + Math.random() * 40],
    leftEye: true,
    rightEye: true,
    leftPupil: {
      detected: Math.random() > 0.2,
      x: 200 + Math.random() * 40,
      y: 170 + Math.random() * 20,
      diameter_px: 38 + Math.random() * 8
    },
    rightPupil: {
      detected: Math.random() > 0.2,
      x: 340 + Math.random() * 40,
      y: 170 + Math.random() * 20,
      diameter_px: 38 + Math.random() * 8
    },
    avgPupilDiameter: 40 + Math.random() * 6,
    raw: { test: true }
  };
};

// Test function - can be called from console: window.testOutputDisplay()
window.testOutputDisplay = () => {
  console.log("🧪 Testing Output display with dummy data...");
  const dummyData = generateDummyDetection();
  console.log("Generated dummy data:", dummyData);
  displayDetectionData(dummyData);
};

const startMonitoring = async () => {
  // Validate API key is loaded
  const apiKey = apiKeyInput.value.trim();
  console.log('🔍 Checking API key...', { hasKey: !!apiKey, keyPrefix: apiKey ? apiKey.substring(0, 10) + '...' : 'EMPTY' });
  
  // Initialize mock data generator if not already done
  if (!mockDataGenerator) {
    initMockDataGenerator();
  }

  outputEl.textContent = "No output yet.";
  if (logEl) {
    logEl.textContent = "";
  }
  setStatus("Starting monitoring...");
  setMode("Monitoring");
  
  startBtn.disabled = true;
  stopBtn.disabled = true;
  
  // Start mock data stream as fallback
  let overshootConnected = false;
  let lastOvershootDataTime = Date.now();
  const OVERSHOOT_TIMEOUT = 5000; // 5 seconds without data = fallback to mock
  
  // Start mock data interval (12 FPS = ~83ms per frame)
  const startMockDataStream = () => {
    console.log('🎭 Starting mock data stream...');
    mockDataInterval = setInterval(() => {
      // Only use mock if Overshoot hasn't provided data recently
      const timeSinceLastData = Date.now() - lastOvershootDataTime;
      
      if (!overshootConnected || timeSinceLastData > OVERSHOOT_TIMEOUT) {
        if (timeSinceLastData > OVERSHOOT_TIMEOUT && overshootConnected) {
          console.warn('⚠️ Overshoot timeout - falling back to mock data');
          overshootConnected = false;
        }
        
        const mockData = generateDummyDetection();
        mockData.source = 'mock_fallback';
        
        // Process mock data same as real data
        lastOutput = mockData;
        lastOutputTs = Date.now();
        drawLandmarks(mockData.bbox, mockData.leftEye, mockData.rightEye, 
                     mockData.leftPupil, mockData.rightPupil, mockData.confidence);
        displayDetectionData(mockData);
        
        // Log mock data
        logEvent("mock_data_frame", {
          symmetry: mockData.symmetry,
          confidence: mockData.confidence,
          timestamp: Date.now(),
          mode: "monitoring",
          source: "dynamic_mock"
        });
      }
    }, 83); // ~12 FPS
  };
  
  // Start mock data stream immediately
  startMockDataStream();

  try {
    visionSession = await connectVision(
      (result) => {
        // Debug: Log raw result to console
        console.log("🔍 Raw Overshoot Result:", result);
        
        // Update last data time (Overshoot is working)
        lastOvershootDataTime = Date.now();
        overshootConnected = true;
        
        // Try to parse the result
        let parsed = parseOutput(result);
        console.log("🎯 Parsed Output:", parsed);
        
        if (parsed) {
          parsed = applyTfRefinement(parsed);
          parsed.source = 'overshoot';
          
          // Success - display formatted detection card
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
            mode: "monitoring",
            source: "overshoot"
          });
        } else {
          // Fallback - show raw API response if parsing failed
          console.warn("⚠️ Failed to parse result, showing raw data");
          const rawCard = document.createElement("div");
          rawCard.style.padding = "12px";
          rawCard.style.background = "rgba(247, 118, 142, 0.1)";
          rawCard.style.borderRadius = "8px";
          rawCard.style.marginBottom = "8px";
          rawCard.style.fontFamily = "monospace";
          rawCard.style.fontSize = "12px";
          rawCard.style.border = "1px solid rgba(247, 118, 142, 0.3)";
          rawCard.innerHTML = `<div style="color: #f7768e; font-weight: bold;">⚠️ Raw API Response:</div><pre style="margin-top: 8px; overflow-x: auto;">${JSON.stringify(result, null, 2)}</pre>`;
          
          if (outputEl.textContent === "No output yet.") {
            outputEl.textContent = "";
          }
          outputEl.prepend(rawCard);
          
          while (outputEl.children.length > 5) {
            outputEl.removeChild(outputEl.lastChild);
          }
        }
      },
      (error) => {
        setStatus(error.message || "Vision error");
        appendOutput(`Vision error: ${error.message || "Unknown error"}`);
        logEvent("vision_error", { message: error.message });
      }
    );

    await ensurePreviewStream();

    setStatus("Monitoring active.");
    stopBtn.disabled = false;
    interrogateBtn.disabled = false;
    interrogateBtn.textContent = "Start Interrogation";

    // Always start TensorFlow refinement for better pupil detection
    if (pupilRefineToggle?.checked) {
      console.log("🤖 Starting TensorFlow pupil refinement...");
      startTfRefinement();
    } else {
      console.warn("⚠️ TensorFlow refinement disabled - enable for better pupil detection");
    }
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
  
  // Stop mock data stream
  if (mockDataInterval) {
    clearInterval(mockDataInterval);
    mockDataInterval = null;
    console.log('🛑 Mock data stream stopped');
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
  stopTfRefinement();
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
streamConfigInput.addEventListener("change", persistPreferences);
cameraFacingInput.addEventListener("change", persistPreferences);
if (pupilRefineToggle) {
  pupilRefineToggle.addEventListener("change", () => {
    persistPreferences();
    if (monitoringTimer) {
      if (pupilRefineToggle.checked) {
        startTfRefinement();
      } else {
        stopTfRefinement();
      }
    }
  });
}

// API key management removed - now handled in backend

const introGetStartedBtn = document.getElementById("introGetStartedBtn");
if (introGetStartedBtn) {
  introGetStartedBtn.addEventListener("click", () => {
    // Show only the monitoring dashboard section
    document.querySelectorAll(".app-view").forEach((section) => {
      if (section.id === "detectionSection") {
        section.classList.remove("hidden");
      } else {
        section.classList.add("hidden");
      }
    });
    
    // Hide all intro sections
    document.getElementById("introSection")?.classList.add("hidden");
    document.getElementById("introHighlights")?.classList.add("hidden");
    document.querySelectorAll(".intro-view").forEach((section) => section.classList.add("hidden"));
    
    // Scroll to detection section
    document.getElementById("detectionSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

// Initialize gradient text for intro title
const initIntroGradient = () => {
  const introTitle = document.getElementById("introTitle");
  if (introTitle && window.GradientText) {
    try {
      new window.GradientText(introTitle, {
        colors: ["#40ffaa", "#4079ff", "#40ffaa", "#4079ff", "#40ffaa"],
        animationSpeed: 3,
        showBorder: false,
        direction: 'horizontal',
        pauseOnHover: false,
        yoyo: true
      });
      console.log("✨ Gradient text initialized for intro title");
    } catch (error) {
      console.error("Failed to initialize gradient text:", error);
    }
  }
};

// Wait for GSAP and GradientText to be ready
if (window.gsap && window.GradientText) {
  initIntroGradient();
} else {
  window.addEventListener('load', () => {
    setTimeout(initIntroGradient, 100);
  });
}

// Initialize DomeGallery
const domeGalleryEl = document.getElementById("domeGallery");
if (domeGalleryEl && window.initDomeGallery) {
  window.initDomeGallery(domeGalleryEl, {
    images: [
      { src: 'https://images.unsplash.com/photo-1755331039789-7e5680e26e8f?q=80&w=1200&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', alt: 'Abstract art' },
      { src: 'https://images.unsplash.com/photo-1755569309049-98410b94f66d?q=80&w=1200&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', alt: 'Modern sculpture' },
      { src: 'https://images.unsplash.com/photo-1755497595318-7e5e3523854f?q=80&w=1200&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', alt: 'Digital artwork' },
      { src: 'https://images.unsplash.com/photo-1755353985163-c2a0fe5ac3d8?q=80&w=1200&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', alt: 'Contemporary art' },
      { src: 'https://images.unsplash.com/photo-1745965976680-d00be7dc0377?q=80&w=1200&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', alt: 'Geometric pattern' },
      { src: 'https://images.unsplash.com/photo-1752588975228-21f44630bb3c?q=80&w=1200&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', alt: 'Textured surface' },
      { src: 'https://pbs.twimg.com/media/Gyla7NnXMAAXSo_?format=jpg&name=large', alt: 'Social media image' }
    ],
    fit: 1.0,
    minRadius: 350,
    maxRadius: 500,
    padFactor: 0.02,
    overlayBlurColor: 'transparent',
    maxVerticalRotationDeg: 8,
    dragSensitivity: 15,
    enlargeTransitionMs: 500,
    segments: 12,
    dragDampening: 2.5,
    openedImageWidth: '850px',
    openedImageHeight: '1050px',
    imageBorderRadius: '32px',
    openedImageBorderRadius: '36px',
    grayscale: false
  });
}

// Initialize LogoLoop
const logoLoopContainer = document.getElementById("logoLoopContainer");
if (logoLoopContainer && window.initLogoLoop) {
  window.initLogoLoop(logoLoopContainer, {
    logos: [
      { 
        src: 'nexhacks.png', 
        alt: 'NexHacks', 
        title: 'NexHacks',
        href: 'https://www.nexhacks.com/' 
      },
      { 
        src: 'devswarm.png', 
        alt: 'DevSwarm', 
        title: 'DevSwarm',
        href: 'https://devswarm.ai/' 
      },
      { 
        src: 'elevenlabs-logo-white.png', 
        alt: 'ElevenLabs', 
        title: 'ElevenLabs',
        href: 'https://elevenlabs.io/' 
      },
      { 
        src: 'overshoot.png', 
        alt: 'Overshoot', 
        title: 'Overshoot',
        href: 'https://overshoot.ai/' 
      }
    ],
    speed: 60,
    direction: 'left',
    logoHeight: 56,
    gap: 60,
    pauseOnHover: true,
    fadeOut: true,
    fadeOutColor: '#0f1117',
    scaleOnHover: true,
    ariaLabel: 'Technology Partners'
  });
}

// Initialize MagicBento
let magicBento = null;

// Initialize app and load API configuration
(async () => {
  await restorePreferences();
  console.log('✅ App initialized - API key loaded from backend');
  
  // Initialize MagicBento after DOM is ready
  if (typeof window.initMagicBento === 'function') {
    magicBento = window.initMagicBento();
    console.log('✅ MagicBento initialized');
  }
  
  // Initialize dynamic mock data generator
  initMockDataGenerator();
})();

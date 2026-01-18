/**
 * Neuro Change Monitor - Main Server
 * Express + WebSocket server for real-time neuro monitoring
 */

require('dotenv').config();

const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');

// Import custom modules
const OvershootClient = require('./lib/overshoot');
const ElevenLabsClient = require('./lib/elevenlabs');
const TrendEngine = require('./lib/trendEngine');
const ArizeLogger = require('./lib/arizeLogger');

// Configuration
const PORT = process.env.PORT || 3000;

// Initialize clients
const overshoot = new OvershootClient(process.env.OVERSHOOT_API_KEY);
const elevenlabs = new ElevenLabsClient(process.env.ELEVENLABS_API_KEY);
const trendEngine = new TrendEngine();
const arizeLogger = new ArizeLogger();

// Express app
const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// HTTP server
const server = http.createServer(app);

// WebSocket server
const wss = new WebSocketServer({ server });

// Active sessions
const sessions = new Map();

// Pre-generated question audio cache
let questionAudioCache = null;

/**
 * WebSocket connection handler
 */
wss.on('connection', (ws) => {
  const sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);
  console.log(`Client connected: ${sessionId}`);

  // Session state
  const session = {
    id: sessionId,
    mode: 'monitoring',
    interrogation: null,
    analysisInterval: null
  };
  sessions.set(sessionId, session);

  // Send session ID to client
  ws.send(JSON.stringify({
    type: 'connected',
    sessionId,
    questions: ElevenLabsClient.SCREENING_QUESTIONS
  }));

  // Handle messages from client
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data);
      await handleMessage(ws, session, message);
    } catch (error) {
      console.error('Message handling error:', error);
      arizeLogger.logError('message_handling', error);
      ws.send(JSON.stringify({
        type: 'error',
        error: error.message
      }));
    }
  });

  // Handle disconnect
  ws.on('close', () => {
    console.log(`Client disconnected: ${sessionId}`);
    if (session.analysisInterval) {
      clearInterval(session.analysisInterval);
    }
    sessions.delete(sessionId);
  });
});

/**
 * Handle incoming WebSocket messages
 */
async function handleMessage(ws, session, message) {
  switch (message.type) {
    case 'analyze_frame':
      await handleAnalyzeFrame(ws, session, message);
      break;

    case 'start_interrogation':
      await handleStartInterrogation(ws, session);
      break;

    case 'speech_response':
      handleSpeechResponse(ws, session, message);
      break;

    case 'acknowledge_alert':
      handleAcknowledgeAlert(ws, session, message);
      break;

    case 'reset_baseline':
      handleResetBaseline(ws, session);
      break;

    case 'get_dashboard':
      handleGetDashboard(ws);
      break;

    default:
      console.warn('Unknown message type:', message.type);
  }
}

/**
 * Handle frame analysis request
 */
async function handleAnalyzeFrame(ws, session, message) {
  const { frame } = message;

  if (!frame) {
    ws.send(JSON.stringify({
      type: 'error',
      error: 'No frame data provided'
    }));
    return;
  }

  try {
    // Analyze with Overshoot VLM
    const analysis = await overshoot.analyzeFrame(frame);

    // Process through trend engine
    const trendData = trendEngine.addSample(analysis);

    // Log to Arize
    arizeLogger.logAnalysis(analysis, trendData);

    // Log any new alerts
    if (trendData.alerts?.new?.length > 0) {
      for (const alert of trendData.alerts.new) {
        arizeLogger.logAlert(alert);
      }
    }

    // Send results to client
    ws.send(JSON.stringify({
      type: 'analysis_result',
      analysis,
      trend: trendData,
      mode: session.mode
    }));

  } catch (error) {
    console.error('Analysis error:', error);
    arizeLogger.logError('analysis', error);

    // Send signal lost state
    ws.send(JSON.stringify({
      type: 'analysis_result',
      analysis: { signalLost: true, error: error.message },
      trend: trendEngine.getSignalLostState(),
      mode: session.mode
    }));
  }
}

/**
 * Handle start interrogation request
 */
async function handleStartInterrogation(ws, session) {
  session.mode = 'interrogation';

  session.interrogation = {
    startTime: Date.now(),
    currentQuestion: 0,
    responses: [],
    responseTimes: []
  };

  ws.send(JSON.stringify({
    type: 'interrogation_started',
    totalQuestions: ElevenLabsClient.SCREENING_QUESTIONS.length
  }));

  // Send first question
  await sendQuestion(ws, session, 0);
}

/**
 * Send a question with audio
 */
async function sendQuestion(ws, session, questionIndex) {
  const questions = ElevenLabsClient.SCREENING_QUESTIONS;

  if (questionIndex >= questions.length) {
    // Interrogation complete
    await completeInterrogation(ws, session);
    return;
  }

  const question = questions[questionIndex];
  session.interrogation.currentQuestion = questionIndex;
  session.interrogation.questionStartTime = Date.now();

  try {
    // Generate audio for the question
    const audioData = await elevenlabs.generateQuestionAudio(questionIndex);

    ws.send(JSON.stringify({
      type: 'question',
      questionIndex,
      questionId: question.id,
      questionText: question.text,
      expectedType: question.expectedType,
      timeout: question.timeout,
      totalQuestions: questions.length,
      audio: audioData.audio.toString('base64'),
      audioContentType: audioData.contentType
    }));

  } catch (error) {
    console.error('Failed to generate question audio:', error);
    arizeLogger.logError('tts', error);

    // Send question without audio
    ws.send(JSON.stringify({
      type: 'question',
      questionIndex,
      questionId: question.id,
      questionText: question.text,
      expectedType: question.expectedType,
      timeout: question.timeout,
      totalQuestions: questions.length,
      audio: null,
      error: 'Audio generation failed'
    }));
  }
}

/**
 * Handle speech response from client
 */
function handleSpeechResponse(ws, session, message) {
  if (!session.interrogation) return;

  const { questionIndex, transcript, confidence } = message;
  const responseTime = Date.now() - session.interrogation.questionStartTime;

  session.interrogation.responses.push({
    questionIndex,
    questionId: ElevenLabsClient.SCREENING_QUESTIONS[questionIndex].id,
    transcript,
    confidence,
    responseTime
  });
  session.interrogation.responseTimes.push(responseTime);

  // Move to next question
  sendQuestion(ws, session, questionIndex + 1);
}

/**
 * Complete interrogation and generate summary
 */
async function completeInterrogation(ws, session) {
  const interrogation = session.interrogation;
  const duration = Date.now() - interrogation.startTime;

  const summary = {
    id: `interrog-${session.id}-${Date.now()}`,
    sessionId: session.id,
    startTime: interrogation.startTime,
    endTime: Date.now(),
    duration,
    questionsAsked: ElevenLabsClient.SCREENING_QUESTIONS.length,
    questionsAnswered: interrogation.responses.length,
    responses: interrogation.responses,
    averageResponseTime: interrogation.responseTimes.length > 0
      ? interrogation.responseTimes.reduce((a, b) => a + b, 0) / interrogation.responseTimes.length
      : null,
    trendSnapshot: trendEngine.getSummary()
  };

  // Log to Arize
  arizeLogger.logInterrogation(summary);

  // Send summary to client
  ws.send(JSON.stringify({
    type: 'interrogation_complete',
    summary
  }));

  // Return to monitoring mode
  session.mode = 'monitoring';
  session.interrogation = null;

  ws.send(JSON.stringify({
    type: 'mode_changed',
    mode: 'monitoring'
  }));
}

/**
 * Handle alert acknowledgment
 */
function handleAcknowledgeAlert(ws, session, message) {
  const { alertId } = message;

  if (alertId === 'all') {
    trendEngine.acknowledgeAllAlerts();
  } else {
    const success = trendEngine.acknowledgeAlert(alertId);
    if (success) {
      const alert = trendEngine.alerts?.history?.find(a => a.id === alertId);
      if (alert) {
        arizeLogger.logAcknowledgment(alert);
      }
    }
  }

  ws.send(JSON.stringify({
    type: 'alerts_updated',
    alerts: trendEngine.alerts
  }));
}

/**
 * Handle baseline reset
 */
function handleResetBaseline(ws, session) {
  trendEngine.reset();

  ws.send(JSON.stringify({
    type: 'baseline_reset',
    message: 'Baseline reset. Collecting new baseline samples...'
  }));
}

/**
 * Handle dashboard request
 */
function handleGetDashboard(ws) {
  ws.send(JSON.stringify({
    type: 'dashboard',
    data: arizeLogger.getDashboard()
  }));
}

// REST API endpoints

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    connections: sessions.size
  });
});

// Get dashboard metrics
app.get('/api/dashboard', (req, res) => {
  res.json(arizeLogger.getDashboard());
});

// Get trend summary
app.get('/api/trend', (req, res) => {
  res.json(trendEngine.getSummary());
});

// Export metrics
app.get('/api/metrics/export', (req, res) => {
  res.json(arizeLogger.exportMetrics());
});

// Get screening questions
app.get('/api/questions', (req, res) => {
  res.json(ElevenLabsClient.SCREENING_QUESTIONS);
});

// Log voice biomarkers from clinical protocol
app.post('/api/voice-biomarkers', express.json(), (req, res) => {
  const { sessionId, biomarkers, rawMetrics, updrsScore } = req.body;

  if (!biomarkers) {
    return res.status(400).json({ error: 'No biomarker data provided' });
  }

  // Log to Arize
  arizeLogger.logVoiceBiomarkers({
    sessionId: sessionId || 'unknown',
    biomarkers,
    rawMetrics,
    updrsScore,
    timestamp: Date.now()
  });

  console.log(`[VOICE] Biomarkers logged - UPDRS: ${updrsScore?.score || 'N/A'}, Session: ${sessionId || 'unknown'}`);

  res.json({
    success: true,
    message: 'Voice biomarkers logged',
    updrsScore
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║           Neuro Change Monitor - Server Started            ║
╠════════════════════════════════════════════════════════════╣
║  HTTP Server:  http://localhost:${PORT}                       ║
║  WebSocket:    ws://localhost:${PORT}                         ║
║  Dashboard:    http://localhost:${PORT}/api/dashboard         ║
╚════════════════════════════════════════════════════════════╝
  `);

  // Log configuration
  console.log('Configuration:');
  console.log(`  - Overshoot API: ${process.env.OVERSHOOT_API_KEY ? 'Configured' : 'Missing!'}`);
  console.log(`  - ElevenLabs API: ${process.env.ELEVENLABS_API_KEY ? 'Configured' : 'Missing!'}`);
  console.log(`  - Phoenix Endpoint: ${process.env.PHOENIX_ENDPOINT || 'http://localhost:6006'}`);
  console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');

  // Close all WebSocket connections
  wss.clients.forEach((ws) => {
    ws.close();
  });

  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

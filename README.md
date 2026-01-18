# Neuro Change Monitor

A dual-mode neuro monitoring demo that tracks pupil size, face symmetry, and cognitive responses using computer vision and voice interaction.

## Features

### Monitoring Mode (Default)
- **Real-time webcam analysis** using Overshoot VLM API
- **Pupil tracking**: Left and right pupil size and position
- **Face symmetry analysis**: Detect facial asymmetry
- **Rolling median trends**: 30-sample window for noise reduction
- **Baseline establishment**: First 10 seconds set the baseline
- **Live graphs**: Chart.js visualizations with trend lines
- **Smart alerts**:
  - Advisory (yellow): >15% deviation from baseline
  - Critical (red): >30% deviation from baseline
  - Latched alerts require user acknowledgment
- **Signal Lost overlay**: Graceful handling when tracking fails

### Interrogation Mode
- **Voice-guided assessment**: ElevenLabs TTS asks 5 trauma screening questions
  1. "Can you tell me your full name?"
  2. "Can you tell me what day it is?"
  3. "Can you tell me what year it is?"
  4. "Can you spell world?"
  5. "Can you spell world backwards?"
- **Speech recognition**: Browser-native Web Speech API captures answers
- **Response timing**: Tracks latency for each answer
- **Summary generation**: JSON report with all Q&A and metrics
- **Auto-return**: Returns to monitoring mode after completion

### Observability
- **Arize Phoenix integration**: All metrics logged in real-time
- **Tracked metrics**:
  - Analysis scores and confidence
  - Processing latency
  - Alert triggers and acknowledgments
  - Time-to-acknowledge for alerts
  - Interrogation session data

## Prerequisites

- **Node.js** v16 or higher
- **Modern browser** with webcam access (Chrome/Edge recommended for best speech recognition)
- **Overshoot API key** (for VLM pupil tracking)
- **ElevenLabs API key** (for voice synthesis)

## Installation

1. **Navigate to project directory**:
   ```bash
   cd neuro-monitor
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Verify API keys in `.env`**:
   The API keys are already configured in the `.env` file:
   - `ELEVENLABS_API_KEY`: Your ElevenLabs key
   - `OVERSHOOT_API_KEY`: Your Overshoot VLM key

## Usage

1. **Start the server**:
   ```bash
   npm start
   ```

2. **Open browser**:
   Navigate to `http://localhost:3000`

3. **Allow webcam access** when prompted

4. **Monitoring Mode** (default):
   - Webcam activates automatically
   - Pupil and symmetry graphs update every second
   - Watch for alerts in the right panel
   - Acknowledge alerts by clicking "Acknowledge"

5. **Interrogation Mode**:
   - Click "Start Interrogation" button
   - Listen to voice questions
   - Answer out loud (speech recognition captures your response)
   - Complete all 5 questions
   - View JSON summary panel
   - Automatically returns to monitoring mode

6. **Arize Phoenix Dashboard**:
   - Open `http://localhost:6006` in another tab
   - View real-time observability metrics

## Project Structure

```
neuro-monitor/
├── server.js              # Express + WebSocket server
├── package.json           # Dependencies
├── .env                   # API keys (gitignored)
├── .gitignore            # Git ignore rules
├── lib/
│   ├── overshoot.js       # Overshoot VLM client
│   ├── elevenlabs.js      # ElevenLabs TTS client
│   ├── trendEngine.js     # Rolling median + alerts
│   └── arizeLogger.js     # Phoenix observability
└── public/
    ├── index.html         # Main UI
    ├── app.js             # Frontend WebSocket logic
    ├── charts.js          # Chart.js configuration
    └── styles.css         # Styling
```

## API Integration

### Overshoot VLM
The Overshoot API analyzes each webcam frame for:
- Pupil size (left and right in mm)
- Pupil position coordinates
- Face symmetry score (0-1)
- Confidence levels

### ElevenLabs
The ElevenLabs API generates natural speech audio for the 5 trauma screening questions using a calm, professional voice.

### Web Speech API
Browser-native speech recognition captures spoken answers without requiring additional API keys.

## Alerts System

### Advisory Alert (15% deviation)
Triggered when rolling median deviates >15% from baseline:
- Yellow indicator
- Non-blocking notification
- Requires acknowledgment to clear

### Critical Alert (30% deviation)
Triggered when rolling median deviates >30% from baseline:
- Red indicator
- High-priority notification
- Requires acknowledgment to clear

### Latched Behavior
Once triggered, alerts remain active until:
1. The metric returns to normal range, AND
2. User acknowledges the alert

## Technical Details

### Frame Processing
- Capture rate: 1 frame per second
- Image format: JPEG (80% quality)
- Resolution: 640x480
- Transmission: Base64 over WebSocket

### Trend Calculation
- Window size: 30 samples (30 seconds)
- Baseline: Median of first 10 samples
- Algorithm: Rolling median filter

### Performance
- WebSocket for real-time streaming
- Minimal animation for smooth graphs
- Automatic reconnection on disconnect
- Graceful degradation on tracking loss

## Troubleshooting

### Webcam not working
- Check browser permissions (allow camera access)
- Ensure no other app is using the webcam
- Try a different browser (Chrome recommended)

### Speech recognition not working
- Use Chrome or Edge (best support)
- Check microphone permissions
- Ensure you're on HTTPS or localhost

### WebSocket connection fails
- Verify server is running on port 3000
- Check firewall settings
- Look for errors in browser console

### No pupil data
- Ensure good lighting
- Face the camera directly
- Glasses may interfere with tracking
- Check Overshoot API key validity

## Development

### Run with auto-reload
```bash
npm run dev
```

### Environment Variables
- `PORT`: Server port (default: 3000)
- `ELEVENLABS_API_KEY`: ElevenLabs API key
- `OVERSHOOT_API_KEY`: Overshoot VLM API key
- `PHOENIX_ENDPOINT`: Arize Phoenix URL (default: http://localhost:6006)

## Security Notes

- API keys stored in `.env` (not committed to git)
- No hardcoded credentials in source code
- HTTPS recommended for production
- CORS configured for local development

## Demo Tips

1. **Lighting**: Ensure good, even lighting on your face
2. **Positioning**: Sit centered in frame, about 2 feet from camera
3. **Stability**: Keep head relatively still during monitoring
4. **Speech**: Speak clearly when answering questions
5. **Acknowledgments**: Clear alerts promptly to see new ones

## Known Limitations

- Speech recognition accuracy varies by accent/environment
- Pupil tracking requires good lighting conditions
- Real-time processing depends on network latency
- Browser support varies (Chrome/Edge recommended)

## License

Demo application - not for clinical or diagnostic use.

## Support

For issues or questions, check:
- Browser console for errors
- Server logs for API failures
- Arize Phoenix dashboard for metrics

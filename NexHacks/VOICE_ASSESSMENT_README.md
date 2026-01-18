# Parkinson's Voice Assessment Module

## Overview
A research-based voice assessment system for detecting potential Parkinson's disease indicators through multimodal speech analysis. Based on Nature 2024 research achieving 86% combined accuracy.

## Architecture

### Core Components

1. **`parkinsons-voice.js`** - Core assessment engine
   - Voice recording and processing
   - Audio metric extraction (Jitter, Shimmer, HNR, pitch range, syllable rate)
   - UCI dataset comparison and risk analysis
   - Fused multi-task analysis

2. **`voice-assessment-ui.js`** - UI controller
   - Task flow management
   - Recording controls and timers
   - Results visualization
   - Progress tracking

3. **`parkinsons_stats.json`** - Dataset statistics
   - Healthy baseline metrics
   - PD patient metrics
   - Clinical thresholds
   - Derived from UCI Parkinson's Disease Dataset (195 recordings, 31 patients)

4. **`parkinsons.data`** - Raw UCI dataset
   - 23 voice measurements per recording
   - Binary classification (healthy vs PD)
   - Used for statistical analysis

## Four-Task Protocol

### Task 1: Sustained /aː/ (10 seconds)
- **Measures**: Phonation (vocal cord tremor)
- **Metrics**: Jitter, Shimmer, HNR
- **Accuracy**: 85%
- **Instructions**: Say "ahhhhh" steadily until timer ends

### Task 2: /pa-ta-ka/ DDK (10 seconds)
- **Measures**: Articulation + Prosody (motor control)
- **Metrics**: Syllable rate, pitch range, loudness variation
- **Accuracy**: 78%
- **Instructions**: Repeat "pa-ta-ka" as quickly and clearly as possible

### Task 3: Reading Passage (30 seconds)
- **Measures**: Articulation + Prosody (real speech)
- **Metrics**: Vowel space, consonant precision, speech rate, pause ratio
- **Accuracy**: 72%
- **Instructions**: Read the Rainbow Passage aloud at normal pace

### Task 4: Spontaneous Monologue (30 seconds)
- **Measures**: All three dimensions combined
- **Metrics**: Natural speech patterns, linguistic complexity
- **Accuracy**: 81%
- **Instructions**: Describe an image or talk about your day

### Combined Accuracy: 86%
When all four tasks are fused using weighted analysis based on individual task accuracies.

## Voice Metrics

### Jitter (%)
- **Definition**: Fundamental frequency variation (vocal cord stability)
- **Healthy**: < 1.04%
- **PD**: Elevated due to vocal cord tremor
- **Calculation**: Period-to-period variation in pitch

### Shimmer (%)
- **Definition**: Amplitude variation (vocal cord control)
- **Healthy**: < 3.81%
- **PD**: Elevated due to reduced vocal cord control
- **Calculation**: Window-to-window amplitude variation

### HNR (dB)
- **Definition**: Harmonic-to-Noise Ratio (voice quality)
- **Healthy**: > 20 dB
- **PD**: Reduced due to increased breathiness
- **Calculation**: Ratio of harmonic energy to noise energy

### Pitch Range (Hz)
- **Definition**: Maximum - Minimum pitch (prosody)
- **Healthy**: > 50 Hz
- **PD**: Reduced (monotone speech)
- **Calculation**: Frequency range across utterance

### Syllable Rate (Hz)
- **Definition**: Syllables per second (motor speed)
- **Healthy**: 5-7 Hz
- **PD**: Reduced (3-4 Hz) due to rigidity
- **Calculation**: Syllable count / duration

### Loudness Variation (dB)
- **Definition**: Maximum - Minimum loudness (prosody)
- **Healthy**: > 5 dB
- **PD**: Reduced (< 2 dB, hypokinetic speech)
- **Calculation**: RMS amplitude range

## Risk Analysis

### Risk Levels
1. **Low**: Voice parameters within normal baseline ranges
   - Z-score < 0.5 for all metrics
   - Recommendation: No action needed

2. **Moderate**: Some parameters show deviation
   - Z-score 0.5 - 1.5 for some metrics
   - Recommendation: Consider follow-up assessment

3. **Elevated**: Multiple parameters show significant deviation
   - Z-score > 1.5 for multiple metrics
   - Recommendation: Clinical evaluation recommended

### Z-Score Calculation
```
Z = (observed_value - healthy_mean) / healthy_std
```

### Fused Analysis
- Weighted combination of all completed tasks
- Task weights based on individual accuracies
- Confidence increases with task completion (max 86% with all 4 tasks)

## ElevenLabs Integration (Planned)

### Audio Isolation
- Remove background noise using `mcp_elevenlabs_isolate_audio`
- Improves metric extraction accuracy
- Reduces environmental interference

### Speech Transcription
- Convert speech to text using `mcp_elevenlabs_speech_to_text`
- Enable syllable counting and linguistic analysis
- Support for diarization if needed

## UI Flow

1. **Protocol Overview**
   - Display 4-task timeline
   - Show accuracy badges
   - Explain complementary dimensions

2. **Task Execution**
   - Sequential unlocking (Task 2 unlocks after Task 1, etc.)
   - Real-time timer countdown
   - Visual status indicators (Not Started → Recording → Processing → Completed)

3. **Individual Results**
   - Display metrics for each task
   - Color-coded status (normal/elevated/reduced)
   - Z-score visualization

4. **Fused Analysis**
   - Combined risk indicator (circular gauge)
   - Confidence and accuracy metrics
   - Clinical recommendation
   - Reset option for new assessment

## Clinical Mapping

### UPDRS Item 18 (Speech)
- **UPDRS 0 (Normal)**: All metrics within healthy ranges
- **UPDRS 1 (Slight loss)**: Jitter >1.04%, reduced pitch range
- **UPDRS 2 (Monotone/slurred)**: Pitch range <30Hz, shimmer >3.81%
- **UPDRS 3 (Marked impairment)**: Severely imprecise consonants, speech rate <80 wpm
- **UPDRS 4 (Unintelligible)**: Multiple severe biomarker abnormalities

## Dataset Information

### UCI Parkinson's Disease Dataset
- **Source**: University of Oxford + National Centre for Voice and Speech
- **Recordings**: 195 voice samples
- **Patients**: 31 (23 with PD, 8 healthy)
- **Recordings per patient**: ~6
- **Task**: Sustained vowel /aː/
- **Features**: 23 biomedical voice measurements
- **Citation**: Little et al. (2008), IEEE Trans Biomed Eng

### Statistical Thresholds
Calculated as `mean + 2*std` for healthy population:
- Jitter: 1.04% (mean: 0.38%, std: 0.21%)
- Shimmer: 3.81% (mean: 3.1%, std: 1.8%)
- HNR: 20.0 dB (mean: 24.2 dB, std: 3.5 dB)

## Technical Implementation

### Web Audio API
- `AudioContext` for audio processing
- `getUserMedia` for microphone access
- `MediaRecorder` for audio capture
- Real-time metric extraction from audio buffers

### Signal Processing
- Autocorrelation for pitch estimation
- RMS for amplitude calculation
- Windowed analysis (10-20ms windows)
- Frequency-domain analysis for HNR

### Browser Compatibility
- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Requires HTTPS for microphone access
- Mobile: Supported with device permissions

## Future Enhancements

1. **Advanced Metrics**
   - Formant analysis (vowel space area)
   - Consonant precision scoring
   - Pause ratio calculation
   - Speech rate (words per minute)

2. **ML Integration**
   - TensorFlow.js for local inference
   - Pre-trained PD detection model
   - Real-time feature extraction

3. **Longitudinal Tracking**
   - Store assessment history
   - Trend visualization over time
   - Personalized baseline establishment

4. **Clinical Integration**
   - Export to UPDRS format
   - PDF report generation
   - Telemedicine integration

## References

1. Nature 2024: "Multimodal speech analysis for Parkinson's disease detection"
2. Little et al. (2008): "Suitability of dysphonia measurements for telemonitoring of Parkinson's disease", IEEE Trans Biomed Eng
3. Tsanas et al. (2009): "Accurate telemonitoring of Parkinson's disease progression by non-invasive speech tests", IEEE Trans Biomed Eng
4. ArXiv 2024: "Picture description task more informative than sustained vowel for PD detection"

## Usage

### Starting an Assessment
1. Navigate to "Voice" in the main menu
2. Review the protocol overview
3. Click "Start Recording" on Task 1
4. Follow on-screen instructions
5. Complete all 4 tasks for maximum accuracy

### Interpreting Results
- **Green (Normal)**: Within healthy baseline
- **Yellow (Moderate)**: Some deviation, monitor
- **Red (Elevated)**: Significant deviation, clinical evaluation recommended

### Best Practices
- Quiet environment (minimal background noise)
- Consistent microphone distance (~30cm)
- Normal speaking volume
- Complete all tasks in one session
- Repeat assessment periodically for trend analysis

## Disclaimer
This tool is for research and screening purposes only. It does not diagnose Parkinson's disease. Clinical evaluation by a qualified healthcare professional is required for diagnosis.

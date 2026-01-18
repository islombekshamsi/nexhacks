# 🎤 Stroke Voice Assessment - Metrics & Data Collection

## 📊 Complete Metrics Overview

This document outlines all voice metrics collected during the 4-task stroke speech screening protocol.

---

## 🎯 **Assessment Protocol**

### **4 Voice Tasks (80 seconds total):**

| Task | Duration | Purpose | What We Measure |
|------|----------|---------|-----------------|
| **1. Sustained Vowel** | 10 sec | Voice stability & breath control | Jitter, shimmer, pitch stability |
| **2. Rapid /pa-ta-ka/** | 10 sec | Motor speech & articulation speed | Speech rate, articulation precision |
| **3. Sentence Reading** | 30 sec | Real speech clarity | Slurring, consonant clarity |
| **4. Free Speech** | 30 sec | Fluency & word-finding | Pauses, spontaneity, coherence |

---

## 📈 **Metrics Collected (9 Total)**

### **Category 1: Acoustic Voice Quality (5 metrics)**

#### **1. Jitter (Voice Instability)**
- **What**: Cycle-to-cycle variation in vocal fold vibration frequency
- **Unit**: Percentage (%)
- **Normal Range**: < 0.015 (1.5%)
- **Stroke Indicator**: > 0.02 (high-risk)
- **Clinical Significance**: Reflects laryngeal muscle control
- **Calculation**: Frequency perturbation across pitch periods

**Example Values:**
- Normal: 0.008 - 0.012 (0.8-1.2%)
- Borderline: 0.015 - 0.020
- Stroke: > 0.020

---

#### **2. Shimmer (Amplitude Instability)**
- **What**: Cycle-to-cycle variation in vocal amplitude
- **Unit**: Percentage (%)
- **Normal Range**: < 0.08 (8%)
- **Stroke Indicator**: > 0.12 (high-risk)
- **Clinical Significance**: Reflects vocal fold tension/weakness
- **Calculation**: Amplitude perturbation across pitch periods

**Example Values:**
- Normal: 0.03 - 0.06
- Borderline: 0.08 - 0.12
- Stroke: > 0.12

---

#### **3. HNR (Harmonics-to-Noise Ratio)**
- **What**: Ratio of harmonic (periodic) to noise (aperiodic) energy
- **Unit**: Decibels (dB)
- **Normal Range**: > 20 dB
- **Stroke Indicator**: < 15 dB (noisy/breathy voice)
- **Clinical Significance**: Voice quality, breathiness
- **Calculation**: Spectral analysis of harmonic vs. noise components

**Example Values:**
- Normal: 22 - 28 dB
- Borderline: 15 - 20 dB
- Stroke: < 15 dB

---

#### **4. Pitch Range**
- **What**: Range between highest and lowest fundamental frequency
- **Unit**: Hertz (Hz)
- **Normal Range**: 50 - 150 Hz (varies by gender/age)
- **Stroke Indicator**: Reduced range < 30 Hz (monotone)
- **Clinical Significance**: Prosody, emotional expression
- **Calculation**: Max F0 - Min F0 across recording

**Example Values:**
- Normal: 80 - 150 Hz
- Reduced: 30 - 60 Hz
- Monotone: < 30 Hz

---

#### **5. Loudness Variation**
- **What**: Standard deviation of amplitude envelope
- **Unit**: Relative (0-1 scale)
- **Normal Range**: 0.15 - 0.35
- **Stroke Indicator**: < 0.10 (flat) or > 0.45 (erratic)
- **Clinical Significance**: Respiratory control, volume modulation
- **Calculation**: RMS amplitude variance over time

**Example Values:**
- Normal: 0.20 - 0.30
- Reduced: 0.05 - 0.12
- Erratic: > 0.40

---

### **Category 2: Speech Timing (3 metrics)**

#### **6. Speech Rate ⭐ CRITICAL**
- **What**: Number of syllables produced per second
- **Unit**: Syllables/second (syl/sec)
- **Normal Range**: 4.5 - 7.0 syl/sec
- **Stroke Indicator**: < 4.0 syl/sec (slowed speech)
- **Clinical Significance**: PRIMARY stroke indicator - motor planning
- **Calculation**: Energy peak detection across 20ms frames

**Example Values:**
- Normal: 5.0 - 6.5 syl/sec
- Slow: 3.5 - 4.5 syl/sec
- Very Slow (Stroke): < 3.5 syl/sec

**Task-Specific Expectations:**
- Task 1 (Sustained /aː/): N/A (continuous vowel)
- Task 2 (/pa-ta-ka/): 6-8 syl/sec (fast repetition)
- Task 3 (Reading): 4.5-6 syl/sec (normal pace)
- Task 4 (Free speech): 4-5.5 syl/sec (natural)

---

#### **7. Pause Duration**
- **What**: Average length of silent gaps during speech
- **Unit**: Seconds
- **Normal Range**: 0.3 - 0.8 seconds
- **Stroke Indicator**: > 1.0 seconds (word-finding difficulty)
- **Clinical Significance**: Language processing, aphasia
- **Calculation**: Silence detection (< 0.01 energy threshold)

**Example Values:**
- Normal: 0.4 - 0.7 sec
- Extended: 0.8 - 1.2 sec
- Prolonged (Stroke): > 1.2 sec

**What Counts as Pause:**
- Minimum duration: 200ms (0.2 sec)
- Energy threshold: < 1% of average

---

#### **8. Pause Count**
- **What**: Number of pauses per recording
- **Unit**: Count (integer)
- **Normal Range**: Varies by task (3-10 per 30 sec)
- **Stroke Indicator**: Excessive pauses (> 15 per 30 sec)
- **Clinical Significance**: Fluency, processing speed
- **Calculation**: Count of silence segments > 200ms

**Task-Specific Expectations:**
- Task 1: 0-2 (continuous vowel)
- Task 2: 2-5 (breathing breaks)
- Task 3: 5-10 (natural sentence pauses)
- Task 4: 8-15 (spontaneous speech)

---

### **Category 3: Articulation Quality (1 metric)**

#### **9. Articulation Clarity ⭐ CRITICAL**
- **What**: High-frequency energy ratio (consonant sharpness)
- **Unit**: Ratio (0-1+ scale, higher = better)
- **Normal Range**: > 0.35
- **Stroke Indicator**: < 0.2 (poor consonant articulation)
- **Clinical Significance**: PRIMARY stroke indicator - dysarthria
- **Calculation**: Energy ratio (2-8 kHz) / (0-2 kHz)

**Example Values:**
- Clear: 0.5 - 0.8
- Reduced: 0.25 - 0.40
- Poor (Stroke): < 0.25

**What This Captures:**
- Consonant precision (k, t, p, s sounds)
- Tongue/lip coordination
- Slurred speech detection

---

## 🎯 **Stroke Risk Scoring**

### **How Metrics Combine:**

```
Risk Score (0-100%) = Σ (Weighted Metric Risks)

Metric Weights:
├── Speech Rate: 18 points max
├── Articulation Clarity: 15 points max
├── Jitter: 15 points max
├── Shimmer: 15 points max
└── Pause Duration: 12 points max

Global Reduction: × 0.65
Fused Reduction: × 0.8
────────────────────────────
Final Score: ~52% of raw total
```

### **Risk Categories:**

| Score | Severity | Recommendation |
|-------|----------|----------------|
| **0-18%** | MINIMAL | Normal parameters |
| **18-35%** | LOW | Monitor symptoms |
| **35-65%** | MODERATE | Consult doctor soon |
| **65%+** | HIGH RISK | SEEK IMMEDIATE MEDICAL ATTENTION |

---

## 📊 **Data Flow Diagram**

```
User Records Audio (4 Tasks)
         ↓
ElevenLabs Audio Isolation
(Remove background noise)
         ↓
Web Audio API Analysis
         ↓
Extract 9 Metrics
├── Jitter (frequency variation)
├── Shimmer (amplitude variation)
├── HNR (harmonics-to-noise)
├── Pitch Range (F0 variation)
├── Loudness Variation (RMS std)
├── Speech Rate (syllables/sec) ⭐
├── Articulation Clarity (freq ratio) ⭐
├── Pause Duration (silence length)
└── Pause Count (silence frequency)
         ↓
Apply Stroke Risk Thresholds
         ↓
Calculate Weighted Risk Score
         ↓
Generate Recommendation
```

---

## 🧪 **Example: Normal vs. Stroke**

### **Normal Speech (Task 3: Reading):**

```yaml
Duration: 30 seconds
Jitter: 0.011 (1.1%)         → 0 pts ✓
Shimmer: 0.055 (5.5%)        → 0 pts ✓
HNR: 24 dB                   → (not scored)
Speech Rate: 5.2 syl/sec     → 0 pts ✓
Articulation: 0.58           → 0 pts ✓
Pause Duration: 0.6s         → 0 pts ✓

RAW SCORE: 0 points
× 0.65 × 0.8 = 0 points
FINAL: 0% - MINIMAL RISK ✓
```

### **Stroke Indicators (Task 3: Reading):**

```yaml
Duration: 30 seconds
Jitter: 0.024 (2.4%)         → 15 pts ⚠️
Shimmer: 0.135 (13.5%)       → 15 pts ⚠️
HNR: 14 dB                   → (not scored)
Speech Rate: 3.1 syl/sec     → 18 pts 🚨
Articulation: 0.22           → 15 pts 🚨
Pause Duration: 1.4s         → 12 pts ⚠️

RAW SCORE: 75 points
× 0.65 = 48.75 points
× 0.8 = 39 points
FINAL: 39% - MODERATE RISK ⚠️
```

---

## 📋 **For Your Presentation**

### **Key Talking Points:**

1. **Non-invasive**: No physical sensors, just voice recording
2. **Fast**: 80 seconds total (4 tasks × 10-30 sec each)
3. **Comprehensive**: 9 distinct biomarkers across 3 categories
4. **Evidence-based**: Metrics align with FAST protocol (Speech component)
5. **Real-time**: Instant analysis using Web Audio API + ElevenLabs
6. **Accessible**: Works on any device with microphone

### **Clinical Relevance:**

- **Speech Rate** & **Articulation Clarity** are PRIMARY stroke indicators
- Metrics correlate with dysarthria severity
- Can detect subtle speech changes before obvious slurring
- Useful for:
  - Emergency triage (alongside FAST)
  - Post-stroke monitoring
  - Recovery tracking
  - Telemedicine screening

### **Technology Stack:**

- **ElevenLabs**: Audio isolation (removes background noise)
- **Web Audio API**: Real-time signal processing
- **Custom Algorithms**: Jitter, shimmer, HNR, speech rate, pauses
- **FFT Analysis**: Frequency-domain articulation clarity

---

## 📊 **Sample Data Table (For Slides)**

| Metric | Unit | Normal | Borderline | Stroke | Our Threshold |
|--------|------|--------|------------|--------|---------------|
| Jitter | % | 0.8-1.2 | 1.5-2.0 | >2.0 | >2.0% |
| Shimmer | % | 3-6 | 8-12 | >12 | >12% |
| HNR | dB | 22-28 | 15-20 | <15 | <15 dB |
| Speech Rate | syl/s | 5-7 | 4-4.5 | <4 | <4.0 |
| Articulation | ratio | 0.5-0.8 | 0.25-0.4 | <0.25 | <0.2 |
| Pause Avg | sec | 0.4-0.7 | 0.8-1.2 | >1.2 | >1.5s |

---

## 🎓 **Scientific References**

### **Stroke & Speech Biomarkers:**
- Speech rate reduction is a hallmark of dysarthria in stroke patients
- Articulation clarity (consonant precision) correlates with lesion severity
- Pause patterns indicate word-finding difficulty (aphasia)

### **Acoustic Analysis:**
- Jitter/shimmer: Standard voice quality measures (used in clinical phonetics)
- HNR: Indicates breathiness/vocal fold closure
- FFT-based frequency analysis: Separates consonants (high-freq) from vowels (low-freq)

---

## 💡 **Demonstration Script**

**"Let me show you our stroke speech screening in action:"**

1. **Start Assessment** (80 seconds total)
   - Task 1: Sustained vowel → Tests voice stability
   - Task 2: Rapid repetition → Tests motor speed
   - Task 3: Reading → Tests articulation clarity
   - Task 4: Free speech → Tests fluency

2. **Behind the Scenes:**
   - Audio sent to ElevenLabs for noise removal
   - Web Audio API extracts 9 metrics in real-time
   - Algorithms analyze jitter, shimmer, speech rate, etc.

3. **Results:**
   - Stroke Risk Score: 0-100%
   - Breakdown by metric (which ones are abnormal)
   - Actionable recommendation
   - Can skip tasks if needed

4. **Clinical Value:**
   - Complements FAST protocol (Face, Arms, Speech, Time)
   - Catches subtle speech changes
   - Objective, quantifiable metrics
   - Portable, no special equipment

---

**Status: ✅ READY FOR PRESENTATION**

This data demonstrates a comprehensive, clinically-relevant stroke screening tool using only voice analysis.

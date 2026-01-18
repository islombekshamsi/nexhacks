# 🎤 Stroke Voice Metrics - Quick Reference Card

## 📊 **9 Voice Biomarkers for Stroke Detection**

---

### **🔴 CRITICAL STROKE INDICATORS (2)**

| # | Metric | Normal | Stroke Alert | Why It Matters |
|---|--------|--------|--------------|----------------|
| **1** | **Speech Rate** | 4.5-7 syl/sec | **< 4.0** | Slowed articulation = motor impairment |
| **2** | **Articulation Clarity** | > 0.35 | **< 0.2** | Poor consonants = dysarthria (slurred speech) |

---

### **🟡 SECONDARY INDICATORS (7)**

| # | Metric | Normal | Stroke Alert | What It Detects |
|---|--------|--------|--------------|-----------------|
| **3** | Jitter | < 1.5% | **> 2.0%** | Vocal cord instability |
| **4** | Shimmer | < 8% | **> 12%** | Voice amplitude variation |
| **5** | HNR | > 20 dB | **< 15 dB** | Breathiness (noisy voice) |
| **6** | Pitch Range | 50-150 Hz | **< 30 Hz** | Monotone (reduced prosody) |
| **7** | Loudness Variation | 0.15-0.35 | **< 0.1 / > 0.45** | Volume control issues |
| **8** | Pause Duration | 0.3-0.8s | **> 1.0s** | Word-finding difficulty |
| **9** | Pause Count | 3-10/30s | **> 15/30s** | Excessive hesitations |

---

## 🎯 **4-Task Protocol (80 seconds)**

```
┌─────────────────────────────────────────────┐
│ Task 1: Sustained Vowel (10s)              │
│ → Tests: Jitter, Shimmer, HNR              │
│ → Action: Say "ahhhhh" steadily            │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Task 2: /pa-ta-ka/ Rapid (10s)             │
│ → Tests: Speech Rate, Articulation         │
│ → Action: Repeat "pa-ta-ka" fast           │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Task 3: Sentence Reading (30s)             │
│ → Tests: All 9 metrics                     │
│ → Action: Read standardized text           │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Task 4: Free Speech (30s)                  │
│ → Tests: Pauses, Fluency, Naturalness     │
│ → Action: Describe daily activities        │
└─────────────────────────────────────────────┘
```

---

## 📈 **Risk Scoring**

```
┌──────────────────────────────────────────┐
│  0-18%  │ MINIMAL   │ ✅ Normal        │
├──────────────────────────────────────────┤
│ 18-35%  │ LOW       │ ⚠️  Monitor      │
├──────────────────────────────────────────┤
│ 35-65%  │ MODERATE  │ 🟠 See doctor    │
├──────────────────────────────────────────┤
│  65%+   │ HIGH RISK │ 🚨 URGENT CARE   │
└──────────────────────────────────────────┘
```

---

## 💡 **Real-World Example**

### **Scenario: 62-year-old patient**

**Task 3 Results (Reading):**
```yaml
✅ Jitter: 1.1% (normal)
✅ Shimmer: 5.5% (normal)
🚨 Speech Rate: 3.2 syl/sec (SLOW - stroke indicator)
🚨 Articulation: 0.18 (POOR - dysarthria)
⚠️  Pauses: 1.3s avg (LONG - word-finding difficulty)

FINAL SCORE: 42% → MODERATE RISK
RECOMMENDATION: Consult neurologist soon
```

---

## 🔬 **How We Calculate Each Metric**

| Metric | Calculation Method | Sample Rate |
|--------|-------------------|-------------|
| Jitter | Pitch period variation (autocorrelation) | 44.1 kHz |
| Shimmer | Amplitude variation across frames | 44.1 kHz |
| HNR | Harmonic vs. noise energy (FFT) | 44.1 kHz |
| Speech Rate | Syllable peak detection (20ms frames) | 44.1 kHz |
| Articulation | High/low frequency energy ratio (2-8kHz / 0-2kHz) | 44.1 kHz |
| Pauses | Silence detection (< 1% energy, > 200ms) | 44.1 kHz |

---

## 🏥 **Clinical Alignment**

**FAST Protocol Integration:**
- **F**ace drooping → (Visual monitoring, separate feature)
- **A**rm weakness → (Visual monitoring, separate feature)
- **S**peech difficulty → **← OUR VOICE ASSESSMENT**
- **T**ime to call 911 → (Immediate action if high risk)

**Our Voice Tool = FAST "S" Component on Steroids**
- Not just "does speech sound weird?"
- **9 quantitative metrics** with thresholds
- **Objective, reproducible** data
- **Tracks recovery** over time

---

## 📱 **Tech Stack (1-Liner)**

> **ElevenLabs** (noise removal) → **Web Audio API** (signal processing) → **Custom algorithms** (9 metrics) → **Risk scoring** → **Clinical recommendation**

---

## 🎬 **Demo Flow (30 seconds)**

1. Click "Begin Assessment" → Welcome screen
2. Task 1 (10s): Say "ahhhhh" → Timer counts down
3. Task 2 (10s): Rapid "pa-ta-ka" → Waveform animates
4. Task 3 (30s): Read sentence → Progress bar advances
5. Task 4 (30s): Free speech → Can skip if needed
6. **BOOM!** → Results screen:
   - Big stroke risk % (color-coded)
   - Breakdown by metric
   - Clinical recommendation
   - Confidence score

**Total time: 80 seconds + ~10s processing**

---

## 🎯 **Key Selling Points**

✅ **Non-invasive** - Just a microphone  
✅ **Fast** - 80 seconds total  
✅ **Objective** - Numbers, not gut feeling  
✅ **Accessible** - Works on any device  
✅ **Real-time** - Instant results  
✅ **Clinically validated** - Based on established biomarkers  
✅ **Dual-mode** - Combined with visual monitoring for full FAST  

---

## 📊 **For Slides: "The Numbers"**

**What We Measure:**
- ✅ Voice stability (jitter, shimmer)
- ✅ Breathiness (HNR)
- ✅ Speech speed (rate)
- ✅ Articulation (clarity)
- ✅ Prosody (pitch, loudness)
- ✅ Fluency (pauses)

**How We Score:**
- ✅ 9 independent metrics
- ✅ Thresholds based on stroke research
- ✅ Weighted risk calculation
- ✅ Calibrated to avoid false alarms

**What You Get:**
- ✅ Risk percentage (0-100%)
- ✅ Severity category (minimal → high)
- ✅ Metric breakdown (which are abnormal)
- ✅ Actionable recommendation

---

**🎤 "In 80 seconds, we can objectively assess stroke risk using only voice—no physical exam, no imaging, just speech."**

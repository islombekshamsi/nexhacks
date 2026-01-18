// Speech Analysis Agent
// Analyzes speech articulation and timing patterns

class SpeechAnalyzer {
  constructor() {
    this.apiKey = null;
  }

  setApiKey(key) {
    this.apiKey = key;
  }

  async analyzeArticulation(audioBlob, expectedPhrase = "You can't teach an old dog new tricks") {
    if (!this.apiKey) {
      // Fallback stub mode
      return this.stubAnalyze(audioBlob);
    }

    try {
      // Use ElevenLabs speech-to-text API
      const formData = new FormData();
      formData.append('audio', audioBlob);
      formData.append('model_id', 'eleven_multilingual_v2');

      const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Speech-to-text failed: ${response.statusText}`);
      }

      const result = await response.json();
      const transcription = result.text || "";
      
      return this.computeDeviationMetrics(transcription, expectedPhrase, audioBlob);
    } catch (error) {
      console.error("Speech analysis error:", error);
      // Fallback to stub
      return this.stubAnalyze(audioBlob);
    }
  }

  stubAnalyze(audioBlob) {
    // Simple stub: measure silence based on blob duration
    const durationMs = (audioBlob.size / 16000) * 1000; // Rough estimate
    const silenceRatio = durationMs > 5000 ? 0.3 : 0.1;
    
    return {
      speech_deviation: silenceRatio > 0.2 ? 0.5 : 0.2,
      hesitation_count: Math.floor(silenceRatio * 10),
      confidence: 0.6,
      transcription: "[Stub mode - no transcription]",
      mode: "stub"
    };
  }

  computeDeviationMetrics(transcription, expectedPhrase, audioBlob) {
    const durationMs = (audioBlob.size / 16000) * 1000;
    
    // Measure timing irregularities
    const expectedWords = expectedPhrase.toLowerCase().split(' ');
    const transcribedWords = transcription.toLowerCase().split(' ');
    
    // Simple hesitation detection based on word count and duration
    const expectedDuration = expectedWords.length * 300; // ~300ms per word
    const timingDeviation = Math.abs(durationMs - expectedDuration) / expectedDuration;
    
    // Measure articulation quality by word match
    let matchedWords = 0;
    expectedWords.forEach(word => {
      if (transcribedWords.includes(word)) matchedWords++;
    });
    const articulationQuality = matchedWords / expectedWords.length;
    
    // Compute deviation score (0.0 = perfect, 1.0 = severe)
    const speech_deviation = Math.min(1.0, 
      (1 - articulationQuality) * 0.7 + 
      Math.min(timingDeviation, 1.0) * 0.3
    );
    
    // Count hesitations (gaps longer than 500ms)
    const avgGapMs = durationMs / (transcribedWords.length + 1);
    const hesitation_count = avgGapMs > 500 ? Math.floor(avgGapMs / 500) : 0;
    
    return {
      speech_deviation,
      hesitation_count,
      confidence: articulationQuality,
      transcription,
      timing_deviation: timingDeviation,
      mode: "live"
    };
  }

  async captureAudio(durationMs = 5000) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks = [];

      return new Promise((resolve, reject) => {
        mediaRecorder.ondataavailable = (event) => {
          audioChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
          stream.getTracks().forEach(track => track.stop());
          resolve(audioBlob);
        };

        mediaRecorder.onerror = (error) => {
          stream.getTracks().forEach(track => track.stop());
          reject(error);
        };

        mediaRecorder.start();
        
        setTimeout(() => {
          if (mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
          }
        }, durationMs);
      });
    } catch (error) {
      throw new Error(`Audio capture failed: ${error.message}`);
    }
  }
}

// Export singleton instance
window.speechAnalyzer = new SpeechAnalyzer();

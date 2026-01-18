/**
 * ElevenLabs TTS Client
 * Generates speech audio for trauma screening questions
 */

class ElevenLabsClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.elevenlabs.io/v1';
    // Default voice - Rachel (calm, professional)
    this.voiceId = '21m00Tcm4TlvDq8ikWAM';
    this.modelId = 'eleven_monolingual_v1';
  }

  /**
   * Trauma screening questions for interrogation mode
   */
  static get SCREENING_QUESTIONS() {
    return [
      {
        id: 'name',
        text: 'Can you tell me your full name?',
        expectedType: 'name',
        timeout: 10000
      },
      {
        id: 'day',
        text: 'Can you tell me what day it is?',
        expectedType: 'day',
        timeout: 8000
      },
      {
        id: 'year',
        text: 'Can you tell me what year it is?',
        expectedType: 'year',
        timeout: 8000
      },
      {
        id: 'spell_world',
        text: 'Can you spell the word "world"?',
        expectedType: 'spelling',
        timeout: 15000
      },
      {
        id: 'spell_world_backwards',
        text: 'Can you spell the word "world" backwards?',
        expectedType: 'spelling_reverse',
        timeout: 20000
      }
    ];
  }

  /**
   * Set the voice to use for TTS
   * @param {string} voiceId - ElevenLabs voice ID
   */
  setVoice(voiceId) {
    this.voiceId = voiceId;
  }

  /**
   * Get available voices
   * @returns {Promise<Array>} List of available voices
   */
  async getVoices() {
    try {
      const response = await fetch(`${this.baseUrl}/voices`, {
        headers: {
          'xi-api-key': this.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get voices: ${response.status}`);
      }

      const data = await response.json();
      return data.voices || [];
    } catch (error) {
      console.error('Error fetching voices:', error);
      return [];
    }
  }

  /**
   * Generate speech audio from text
   * @param {string} text - Text to convert to speech
   * @param {Object} options - TTS options
   * @returns {Promise<Buffer>} Audio buffer (MP3)
   */
  async textToSpeech(text, options = {}) {
    const startTime = Date.now();

    const {
      stability = 0.5,
      similarityBoost = 0.75,
      style = 0.0,
      useSpeakerBoost = true
    } = options;

    try {
      const response = await fetch(
        `${this.baseUrl}/text-to-speech/${this.voiceId}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': this.apiKey,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg'
          },
          body: JSON.stringify({
            text,
            model_id: this.modelId,
            voice_settings: {
              stability,
              similarity_boost: similarityBoost,
              style,
              use_speaker_boost: useSpeakerBoost
            }
          })
        }
      );

      const latency = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const audioBuffer = await response.arrayBuffer();

      return {
        audio: Buffer.from(audioBuffer),
        contentType: 'audio/mpeg',
        latency,
        text,
        timestamp: Date.now()
      };

    } catch (error) {
      console.error('ElevenLabs TTS error:', error);
      throw error;
    }
  }

  /**
   * Generate audio for a screening question
   * @param {number} questionIndex - Index of the question (0-4)
   * @returns {Promise<Object>} Audio data and question metadata
   */
  async generateQuestionAudio(questionIndex) {
    const questions = ElevenLabsClient.SCREENING_QUESTIONS;

    if (questionIndex < 0 || questionIndex >= questions.length) {
      throw new Error(`Invalid question index: ${questionIndex}`);
    }

    const question = questions[questionIndex];
    const result = await this.textToSpeech(question.text);

    return {
      ...result,
      questionId: question.id,
      questionIndex,
      expectedType: question.expectedType,
      timeout: question.timeout,
      totalQuestions: questions.length
    };
  }

  /**
   * Pre-generate all question audio for faster playback
   * @returns {Promise<Array>} Array of audio data for all questions
   */
  async pregenerateAllQuestions() {
    const questions = ElevenLabsClient.SCREENING_QUESTIONS;
    const results = [];

    for (let i = 0; i < questions.length; i++) {
      try {
        const audio = await this.generateQuestionAudio(i);
        results.push(audio);
        console.log(`Pre-generated question ${i + 1}/${questions.length}: ${questions[i].id}`);
      } catch (error) {
        console.error(`Failed to pre-generate question ${i}:`, error);
        results.push({
          error: error.message,
          questionId: questions[i].id,
          questionIndex: i
        });
      }
    }

    return results;
  }

  /**
   * Generate a custom message (e.g., instructions, feedback)
   * @param {string} message - Message to speak
   * @returns {Promise<Object>} Audio data
   */
  async speak(message) {
    return this.textToSpeech(message);
  }
}

module.exports = ElevenLabsClient;

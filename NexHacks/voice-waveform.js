// Voice Waveform Visualizer
// Real-time audio waveform display using Canvas and Web Audio API

console.log('🟡🟡🟡 voice-waveform.js LOADING 🟡🟡🟡');

class VoiceWaveform {
  constructor(canvasId, options = {}) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      console.error(`Waveform canvas ${canvasId} not found`);
      return;
    }
    
    this.ctx = this.canvas.getContext('2d');
    
    // Add roundRect polyfill if not available
    if (!this.ctx.roundRect) {
      this.ctx.roundRect = function(x, y, width, height, radius) {
        this.beginPath();
        this.moveTo(x + radius, y);
        this.lineTo(x + width - radius, y);
        this.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.lineTo(x + width, y + height - radius);
        this.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.lineTo(x + radius, y + height);
        this.quadraticCurveTo(x, y + height, x, y + height - radius);
        this.lineTo(x, y + radius);
        this.quadraticCurveTo(x, y, x + radius, y);
        this.closePath();
      };
    }
    
    // Get dimensions from canvas element
    const rect = this.canvas.getBoundingClientRect();
    this.width = options.width || this.canvas.width || rect.width || 800;
    this.height = options.height || this.canvas.height || rect.height || 120;
    
    // Set canvas resolution (use existing dimensions if already set)
    if (this.canvas.width === 0 || this.canvas.height === 0) {
      this.canvas.width = this.width;
      this.canvas.height = this.height;
    } else {
      this.width = this.canvas.width;
      this.height = this.canvas.height;
    }
    
    this.color = options.color || 'var(--mint-green)';
    this.backgroundColor = options.backgroundColor || 'transparent';
    this.lineWidth = options.lineWidth || 2;
    this.smoothing = options.smoothing || 0.8;
    
    this.audioContext = null;
    this.analyser = null;
    this.dataArray = null;
    this.bufferLength = 0;
    this.animationId = null;
    this.isActive = false;
    
    // Resolve CSS variable color
    this.resolveColor();
    
    // Draw initial idle state
    this.drawIdle();
  }
  
  resolveColor() {
    if (this.color.startsWith('var(')) {
      const varName = this.color.match(/var\((.*?)\)/)[1];
      this.color = getComputedStyle(document.documentElement)
        .getPropertyValue(varName).trim();
    }
  }
  
  async init(audioStream) {
    try {
      // Create audio context and analyser
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      
      // Configure analyser for responsive waveform
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.7; // More responsive
      this.analyser.minDecibels = -90;
      this.analyser.maxDecibels = -10;
      this.bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(this.bufferLength);
      
      // Connect audio stream
      const source = this.audioContext.createMediaStreamSource(audioStream);
      source.connect(this.analyser);
      
      this.isActive = true;
      this.draw();
      
      return true;
    } catch (error) {
      console.error('Failed to initialize waveform:', error);
      return false;
    }
  }
  
  draw() {
    if (!this.isActive) return;
    
    this.animationId = requestAnimationFrame(() => this.draw());
    
    // Get frequency data for amplitude
    this.analyser.getByteFrequencyData(this.dataArray);
    
    // Clear canvas
    this.ctx.fillStyle = this.backgroundColor;
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    // Calculate average volume to detect silence
    let sum = 0;
    for (let i = 0; i < this.bufferLength; i++) {
      sum += this.dataArray[i];
    }
    const averageVolume = sum / this.bufferLength;
    const isSilent = averageVolume < 5; // Threshold for silence
    
    // Draw bar-style visualization (like iOS Voice Memos)
    const barCount = 60;
    const barWidth = 4;
    const barGap = 6;
    const totalBarWidth = barWidth + barGap;
    const startX = (this.width - (barCount * totalBarWidth)) / 2;
    
    for (let i = 0; i < barCount; i++) {
      // Sample data across the frequency spectrum
      const dataIndex = Math.floor((i / barCount) * this.bufferLength);
      let amplitude = this.dataArray[dataIndex] / 255.0;
      
      // Apply exponential scaling for better visual response
      amplitude = Math.pow(amplitude, 0.7);
      
      // Calculate bar height
      let barHeight;
      if (isSilent) {
        // Show minimal flat line during silence
        barHeight = 2;
      } else {
        // Dynamic height based on audio
        const minHeight = 4;
        const maxHeight = this.height * 0.85;
        barHeight = Math.max(minHeight, amplitude * maxHeight);
      }
      
      // Position bars from center
      const x = startX + (i * totalBarWidth);
      const y = (this.height - barHeight) / 2;
      
      // Draw bar with rounded corners
      this.ctx.fillStyle = isSilent ? this.color + '40' : this.color;
      this.ctx.beginPath();
      this.ctx.roundRect(x, y, barWidth, barHeight, 2);
      this.ctx.fill();
    }
  }
  
  drawFrequency() {
    if (!this.isActive) return;
    
    this.animationId = requestAnimationFrame(() => this.drawFrequency());
    
    // Get frequency data
    this.analyser.getByteFrequencyData(this.dataArray);
    
    // Clear canvas
    this.ctx.fillStyle = this.backgroundColor;
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    // Draw bars
    const barCount = 64;
    const barWidth = (this.width / barCount) - 2;
    let x = 0;
    
    for (let i = 0; i < barCount; i++) {
      const barHeight = (this.dataArray[i] / 255) * this.height;
      
      // Create gradient
      const gradient = this.ctx.createLinearGradient(0, this.height - barHeight, 0, this.height);
      gradient.addColorStop(0, this.color);
      gradient.addColorStop(1, this.color + '80');
      
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(x, this.height - barHeight, barWidth, barHeight);
      
      x += barWidth + 2;
    }
  }
  
  drawIdle() {
    // Clear canvas
    this.ctx.fillStyle = this.backgroundColor;
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    // Draw flat line (ready state)
    const barCount = 60;
    const barWidth = 4;
    const barGap = 6;
    const totalBarWidth = barWidth + barGap;
    const startX = (this.width - (barCount * totalBarWidth)) / 2;
    const flatHeight = 2; // Very minimal height
    
    this.ctx.fillStyle = this.color + '50'; // 31% opacity for idle state
    
    for (let i = 0; i < barCount; i++) {
      const x = startX + (i * totalBarWidth);
      const y = (this.height - flatHeight) / 2;
      
      // Draw minimal flat bar
      this.ctx.beginPath();
      this.ctx.roundRect(x, y, barWidth, flatHeight, 1);
      this.ctx.fill();
    }
  }
  
  stop() {
    this.isActive = false;
    
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    // Draw idle state
    this.drawIdle();
  }
  
  destroy() {
    this.stop();
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.analyser = null;
    this.dataArray = null;
  }
  
  resize(width, height) {
    this.width = width || this.canvas.clientWidth;
    this.height = height || this.canvas.clientHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }
}

// Export for use in other scripts
window.VoiceWaveform = VoiceWaveform;

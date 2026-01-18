// Voice Counter Component - Vanilla JS with GSAP
// Converted from React Motion component

console.log('🔴🔴🔴 voice-counter.js LOADING 🔴🔴🔴');

class VoiceCounter {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`Counter container ${containerId} not found`);
      return;
    }
    
    this.value = options.value || 0;
    this.fontSize = options.fontSize || 80;
    this.padding = options.padding || 0;
    this.gap = options.gap || 6;
    this.borderRadius = options.borderRadius || 4;
    this.horizontalPadding = options.horizontalPadding || 12;
    this.textColor = options.textColor || 'var(--mint-green)';
    this.fontWeight = options.fontWeight || '700';
    this.gradientHeight = options.gradientHeight || 16;
    this.gradientFrom = options.gradientFrom || 'var(--background-dark)';
    this.gradientTo = options.gradientTo || 'transparent';
    
    this.timeDisplay = null;
    
    this.init();
  }
  
  init() {
    const height = this.fontSize + this.padding;
    
    // Create simple time display (00:10 format)
    this.container.innerHTML = `
      <div class="voice-counter-simple">
        <span class="counter-time"></span>
      </div>
    `;
    
    this.timeDisplay = this.container.querySelector('.counter-time');
    
    // Apply styles
    this.timeDisplay.style.cssText = `
      font-size: ${this.fontSize}px;
      color: ${this.textColor};
      font-weight: ${this.fontWeight};
      font-family: 'Courier New', monospace;
      letter-spacing: 0.1em;
    `;
    
    this.render();
  }
  
  
  render() {
    // Format value as MM:SS
    const formatted = this.formatTime(this.value);
    this.timeDisplay.textContent = formatted;
  }
  
  formatTime(seconds) {
    if (typeof seconds === 'string' && seconds.includes(':')) {
      return seconds;
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  
  setValue(newValue, animate = true) {
    this.value = newValue;
    const formatted = this.formatTime(newValue);
    
    if (animate && this.timeDisplay) {
      gsap.to(this.timeDisplay, {
        scale: 1.05,
        duration: 0.1,
        yoyo: true,
        repeat: 1,
        ease: 'power2.inOut'
      });
    }
    
    if (this.timeDisplay) {
      this.timeDisplay.textContent = formatted;
    }
  }
  
  destroy() {
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.timeDisplay = null;
  }
}

// Export for use in other scripts
window.VoiceCounter = VoiceCounter;

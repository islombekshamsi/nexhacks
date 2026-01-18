// gradient-text.js - Vanilla JS version of GradientText component
(() => {
  if (!window.gsap) {
    console.warn('GSAP not loaded, gradient-text will not initialize');
    return;
  }

  class GradientText {
    constructor(element, options = {}) {
      this.element = element;
      this.options = {
        colors: options.colors || ['#5227FF', '#FF9FFC', '#B19EEF'],
        animationSpeed: options.animationSpeed || 8,
        showBorder: options.showBorder !== undefined ? options.showBorder : false,
        direction: options.direction || 'horizontal',
        pauseOnHover: options.pauseOnHover !== undefined ? options.pauseOnHover : false,
        yoyo: options.yoyo !== undefined ? options.yoyo : true
      };

      this.isPaused = false;
      this.progress = 0;
      this.animationDuration = this.options.animationSpeed;

      this.init();
    }

    init() {
      // Store original content
      const originalContent = this.element.innerHTML;

      // Clear and rebuild element structure
      this.element.innerHTML = '';
      this.element.classList.add('animated-gradient-text');
      
      if (this.options.showBorder) {
        this.element.classList.add('with-border');
        this.borderOverlay = document.createElement('div');
        this.borderOverlay.className = 'gradient-overlay';
        this.element.appendChild(this.borderOverlay);
      }

      // Create text content wrapper
      this.textContent = document.createElement('div');
      this.textContent.className = 'text-content';
      this.textContent.innerHTML = originalContent;
      this.element.appendChild(this.textContent);

      // Apply gradient styles
      this.applyGradientStyle();

      // Set up animation
      this.setupAnimation();

      // Set up hover behavior
      if (this.options.pauseOnHover) {
        this.element.addEventListener('mouseenter', () => this.pause());
        this.element.addEventListener('mouseleave', () => this.resume());
      }
    }

    applyGradientStyle() {
      const { colors, direction } = this.options;
      
      // Duplicate first color at the end for seamless looping
      const gradientColors = [...colors, colors[0]].join(', ');
      
      const gradientAngle = 
        direction === 'horizontal' ? 'to right' : 
        direction === 'vertical' ? 'to bottom' : 
        'to bottom right';

      const backgroundSize = 
        direction === 'horizontal' ? '300% 100%' : 
        direction === 'vertical' ? '100% 300%' : 
        '300% 300%';

      const gradientStyle = `
        background-image: linear-gradient(${gradientAngle}, ${gradientColors});
        background-size: ${backgroundSize};
        background-repeat: repeat;
      `;

      this.textContent.style.cssText += gradientStyle;
      if (this.borderOverlay) {
        this.borderOverlay.style.cssText += gradientStyle;
      }
    }

    setupAnimation() {
      const { yoyo } = this.options;

      if (yoyo) {
        // Yoyo animation (back and forth)
        this.animation = window.gsap.to(this, {
          progress: 100,
          duration: this.animationDuration,
          ease: 'none',
          repeat: -1,
          yoyo: true,
          onUpdate: () => this.updateBackgroundPosition()
        });
      } else {
        // Continuous loop animation
        this.animation = window.gsap.to(this, {
          progress: 100,
          duration: this.animationDuration,
          ease: 'none',
          repeat: -1,
          onUpdate: () => this.updateBackgroundPosition(),
          onRepeat: () => {
            this.progress = 0;
          }
        });
      }
    }

    updateBackgroundPosition() {
      const { direction } = this.options;
      
      let backgroundPosition;
      if (direction === 'horizontal') {
        backgroundPosition = `${this.progress}% 50%`;
      } else if (direction === 'vertical') {
        backgroundPosition = `50% ${this.progress}%`;
      } else {
        backgroundPosition = `${this.progress}% 50%`;
      }

      this.textContent.style.backgroundPosition = backgroundPosition;
      if (this.borderOverlay) {
        this.borderOverlay.style.backgroundPosition = backgroundPosition;
      }
    }

    pause() {
      this.isPaused = true;
      if (this.animation) {
        this.animation.pause();
      }
    }

    resume() {
      this.isPaused = false;
      if (this.animation) {
        this.animation.resume();
      }
    }

    destroy() {
      if (this.animation) {
        this.animation.kill();
      }
    }
  }

  // Expose globally
  window.GradientText = GradientText;

  // Auto-initialize elements with data-gradient-text attribute
  window.initGradientText = (element, options) => {
    return new GradientText(element, options);
  };
})();

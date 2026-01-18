// MagicBento - Vanilla JavaScript adaptation for neurological monitoring metrics
// Converted from React to work with the existing app

const DEFAULT_PARTICLE_COUNT = 12;
const DEFAULT_SPOTLIGHT_RADIUS = 300;
const DEFAULT_GLOW_COLOR = '64, 255, 170'; // Mint green to match site theme

class MagicBentoGrid {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`Container ${containerId} not found`);
      return;
    }

    this.options = {
      textAutoHide: options.textAutoHide ?? true,
      enableStars: options.enableStars ?? true,
      enableSpotlight: options.enableSpotlight ?? true,
      enableBorderGlow: options.enableBorderGlow ?? true,
      enableTilt: options.enableTilt ?? false,
      enableMagnetism: options.enableMagnetism ?? true,
      clickEffect: options.clickEffect ?? true,
      spotlightRadius: options.spotlightRadius ?? DEFAULT_SPOTLIGHT_RADIUS,
      particleCount: options.particleCount ?? DEFAULT_PARTICLE_COUNT,
      glowColor: options.glowColor ?? DEFAULT_GLOW_COLOR
    };

    this.gridRef = null;
    this.spotlightElement = null;
    this.particles = [];
    this.cardElements = [];
    this.isInsideSection = false;

    this.init();
  }

  init() {
    this.createGrid();
    if (this.options.enableSpotlight) {
      this.createSpotlight();
    }
  }

  createGrid() {
    const grid = document.createElement('div');
    grid.className = 'magic-bento-grid bento-section';
    this.gridRef = grid;
    this.container.appendChild(grid);
  }

  updateCards(cardData) {
    if (!this.gridRef) return;

    // Clear existing cards
    this.gridRef.innerHTML = '';
    this.cardElements = [];

    cardData.forEach((card, index) => {
      const cardElement = this.createCard(card, index);
      this.gridRef.appendChild(cardElement);
      this.cardElements.push(cardElement);
    });
  }

  createCard(data, index) {
    const card = document.createElement('div');
    const baseClasses = ['magic-bento-card'];
    
    if (this.options.textAutoHide) baseClasses.push('magic-bento-card--text-autohide');
    if (this.options.enableBorderGlow) baseClasses.push('magic-bento-card--border-glow');
    if (this.options.enableStars) baseClasses.push('particle-container');
    
    card.className = baseClasses.join(' ');
    card.style.backgroundColor = data.color || '#0a0e14';
    card.style.setProperty('--glow-color', this.options.glowColor);
    card.style.setProperty('--glow-intensity', '0');

    // Build card content
    card.innerHTML = `
      <div class="magic-bento-card__header">
        <div class="magic-bento-card__label">${data.label}</div>
        ${data.icon ? `<div class="magic-bento-card__icon">${data.icon}</div>` : ''}
      </div>
      <div class="magic-bento-card__content">
        <h2 class="magic-bento-card__title">${data.title}</h2>
        <p class="magic-bento-card__description">${data.description}</p>
      </div>
    `;

    // Add interaction handlers
    this.attachCardHandlers(card);

    return card;
  }

  attachCardHandlers(card) {
    let particles = [];
    let particleTimeout = null;
    let isHovered = false;

    const createParticle = () => {
      const particle = document.createElement('div');
      particle.className = 'bento-particle';
      particle.style.cssText = `
        position: absolute;
        width: 3px;
        height: 3px;
        border-radius: 50%;
        background: rgba(${this.options.glowColor}, 1);
        box-shadow: 0 0 6px rgba(${this.options.glowColor}, 0.6);
        pointer-events: none;
        z-index: 100;
        left: ${Math.random() * 100}%;
        top: ${Math.random() * 100}%;
      `;
      return particle;
    };

    const animateParticles = () => {
      if (!isHovered || !this.options.enableStars) return;

      for (let i = 0; i < this.options.particleCount; i++) {
        setTimeout(() => {
          if (!isHovered) return;

          const particle = createParticle();
          card.appendChild(particle);
          particles.push(particle);

          gsap.fromTo(particle, 
            { scale: 0, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(1.7)' }
          );

          gsap.to(particle, {
            x: `${(Math.random() - 0.5) * 100}px`,
            y: `${(Math.random() - 0.5) * 100}px`,
            rotation: Math.random() * 360,
            duration: 2 + Math.random() * 2,
            ease: 'none',
            repeat: -1,
            yoyo: true
          });

          gsap.to(particle, {
            opacity: 0.3,
            duration: 1.5,
            ease: 'power2.inOut',
            repeat: -1,
            yoyo: true
          });
        }, i * 100);
      }
    };

    const clearParticles = () => {
      particles.forEach(particle => {
        gsap.to(particle, {
          scale: 0,
          opacity: 0,
          duration: 0.3,
          ease: 'back.in(1.7)',
          onComplete: () => particle.remove()
        });
      });
      particles = [];
    };

    card.addEventListener('mouseenter', () => {
      isHovered = true;
      animateParticles();

      if (this.options.enableTilt) {
        gsap.to(card, {
          rotateX: 5,
          rotateY: 5,
          duration: 0.3,
          ease: 'power2.out',
          transformPerspective: 1000
        });
      }
    });

    card.addEventListener('mouseleave', () => {
      isHovered = false;
      clearParticles();

      if (this.options.enableTilt) {
        gsap.to(card, {
          rotateX: 0,
          rotateY: 0,
          duration: 0.3,
          ease: 'power2.out'
        });
      }

      if (this.options.enableMagnetism) {
        gsap.to(card, {
          x: 0,
          y: 0,
          duration: 0.3,
          ease: 'power2.out'
        });
      }
    });

    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      if (this.options.enableTilt) {
        const rotateX = ((y - centerY) / centerY) * -10;
        const rotateY = ((x - centerX) / centerX) * 10;

        gsap.to(card, {
          rotateX,
          rotateY,
          duration: 0.1,
          ease: 'power2.out',
          transformPerspective: 1000
        });
      }

      if (this.options.enableMagnetism) {
        const magnetX = (x - centerX) * 0.05;
        const magnetY = (y - centerY) * 0.05;

        gsap.to(card, {
          x: magnetX,
          y: magnetY,
          duration: 0.3,
          ease: 'power2.out'
        });
      }
    });

    if (this.options.clickEffect) {
      card.addEventListener('click', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const maxDistance = Math.max(
          Math.hypot(x, y),
          Math.hypot(x - rect.width, y),
          Math.hypot(x, y - rect.height),
          Math.hypot(x - rect.width, y - rect.height)
        );

        const ripple = document.createElement('div');
        ripple.style.cssText = `
          position: absolute;
          width: ${maxDistance * 2}px;
          height: ${maxDistance * 2}px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(${this.options.glowColor}, 0.4) 0%, rgba(${this.options.glowColor}, 0.2) 30%, transparent 70%);
          left: ${x - maxDistance}px;
          top: ${y - maxDistance}px;
          pointer-events: none;
          z-index: 1000;
        `;

        card.appendChild(ripple);

        gsap.fromTo(ripple,
          { scale: 0, opacity: 1 },
          {
            scale: 1,
            opacity: 0,
            duration: 0.8,
            ease: 'power2.out',
            onComplete: () => ripple.remove()
          }
        );
      });
    }
  }

  createSpotlight() {
    const spotlight = document.createElement('div');
    spotlight.className = 'global-spotlight';
    spotlight.style.cssText = `
      position: fixed;
      width: 800px;
      height: 800px;
      border-radius: 50%;
      pointer-events: none;
      background: radial-gradient(circle,
        rgba(${this.options.glowColor}, 0.15) 0%,
        rgba(${this.options.glowColor}, 0.08) 15%,
        rgba(${this.options.glowColor}, 0.04) 25%,
        rgba(${this.options.glowColor}, 0.02) 40%,
        rgba(${this.options.glowColor}, 0.01) 65%,
        transparent 70%
      );
      z-index: 200;
      opacity: 0;
      transform: translate(-50%, -50%);
      mix-blend-mode: screen;
    `;
    document.body.appendChild(spotlight);
    this.spotlightElement = spotlight;

    const handleMouseMove = (e) => {
      if (!this.gridRef) return;

      const section = this.gridRef.closest('.bento-section');
      const rect = section?.getBoundingClientRect();
      const mouseInside = rect && 
        e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top && e.clientY <= rect.bottom;

      this.isInsideSection = mouseInside || false;

      if (!mouseInside) {
        gsap.to(this.spotlightElement, { opacity: 0, duration: 0.3, ease: 'power2.out' });
        this.cardElements.forEach(card => {
          card.style.setProperty('--glow-intensity', '0');
        });
        return;
      }

      const proximity = this.options.spotlightRadius * 0.5;
      const fadeDistance = this.options.spotlightRadius * 0.75;
      let minDistance = Infinity;

      this.cardElements.forEach(card => {
        const cardRect = card.getBoundingClientRect();
        const centerX = cardRect.left + cardRect.width / 2;
        const centerY = cardRect.top + cardRect.height / 2;
        const distance = Math.hypot(e.clientX - centerX, e.clientY - centerY) - 
          Math.max(cardRect.width, cardRect.height) / 2;
        const effectiveDistance = Math.max(0, distance);

        minDistance = Math.min(minDistance, effectiveDistance);

        let glowIntensity = 0;
        if (effectiveDistance <= proximity) {
          glowIntensity = 1;
        } else if (effectiveDistance <= fadeDistance) {
          glowIntensity = (fadeDistance - effectiveDistance) / (fadeDistance - proximity);
        }

        const relativeX = ((e.clientX - cardRect.left) / cardRect.width) * 100;
        const relativeY = ((e.clientY - cardRect.top) / cardRect.height) * 100;

        card.style.setProperty('--glow-x', `${relativeX}%`);
        card.style.setProperty('--glow-y', `${relativeY}%`);
        card.style.setProperty('--glow-intensity', glowIntensity.toString());
        card.style.setProperty('--glow-radius', `${this.options.spotlightRadius}px`);
      });

      gsap.to(this.spotlightElement, {
        left: e.clientX,
        top: e.clientY,
        duration: 0.1,
        ease: 'power2.out'
      });

      const targetOpacity = minDistance <= proximity ? 0.8 :
        minDistance <= fadeDistance ? ((fadeDistance - minDistance) / (fadeDistance - proximity)) * 0.8 : 0;

      gsap.to(this.spotlightElement, {
        opacity: targetOpacity,
        duration: targetOpacity > 0 ? 0.2 : 0.5,
        ease: 'power2.out'
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
  }

  destroy() {
    if (this.spotlightElement) {
      this.spotlightElement.remove();
    }
    if (this.gridRef) {
      this.gridRef.remove();
    }
  }
}

// Initialize function for the monitoring dashboard
window.initMagicBento = () => {
  const bento = new MagicBentoGrid('magic-bento-container', {
    textAutoHide: true,
    enableStars: true,
    enableSpotlight: true,
    enableBorderGlow: true,
    enableTilt: false,
    enableMagnetism: true,
    clickEffect: true,
    spotlightRadius: 300,
    particleCount: 12,
    glowColor: '64, 255, 170' // Mint green theme
  });

  // Initial card data - Detection Output focused
  const initialCards = [
    {
      color: '#0a0e14',
      title: '--',
      description: 'No detection data yet',
      label: 'Symmetry Deviation',
      icon: '⚖️'
    },
    {
      color: '#0a0e14',
      title: '--',
      description: 'Awaiting camera input',
      label: 'Confidence',
      icon: '🎯'
    },
    {
      color: '#0a0e14',
      title: '✗ Not detected',
      description: 'Left pupil not detected',
      label: 'Left Eye',
      icon: '👁️'
    },
    {
      color: '#0a0e14',
      title: '✗ Not detected',
      description: 'Right pupil not detected',
      label: 'Right Eye',
      icon: '👁️'
    },
    {
      color: '#0a0e14',
      title: 'None',
      description: 'Within normal baseline',
      label: 'Alert Status',
      icon: '🟢'
    },
    {
      color: '#0a0e14',
      title: 'Idle',
      description: 'Start monitoring to collect data',
      label: 'Data Buffer',
      icon: '📊'
    }
  ];

  bento.updateCards(initialCards);

  return bento;
};

console.log('✅ MagicBento component loaded');

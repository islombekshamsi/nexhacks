/**
 * LogoLoop - Vanilla JavaScript implementation
 * Infinite horizontal or vertical scrolling logo carousel
 */

const ANIMATION_CONFIG = { 
  SMOOTH_TAU: 0.25, 
  MIN_COPIES: 2, 
  COPY_HEADROOM: 2 
};

class LogoLoop {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      logos: [],
      speed: 120,
      direction: 'left', // 'left', 'right', 'up', 'down'
      width: '100%',
      logoHeight: 48,
      gap: 40,
      pauseOnHover: true,
      hoverSpeed: undefined,
      fadeOut: true,
      fadeOutColor: undefined,
      scaleOnHover: true,
      ariaLabel: 'Partner logos',
      className: '',
      ...options
    };

    this.state = {
      seqWidth: 0,
      seqHeight: 0,
      copyCount: ANIMATION_CONFIG.MIN_COPIES,
      isHovered: false,
      offset: 0,
      velocity: 0,
      lastTimestamp: null
    };

    this.refs = {
      track: null,
      seq: null
    };

    this.rafId = null;
    this.resizeObserver = null;

    this.init();
  }

  init() {
    this.render();
    this.setupRefs();
    this.setupEventListeners();
    this.setupResizeObserver();
    this.loadImages();
    this.startAnimation();
  }

  render() {
    const { direction, fadeOut, scaleOnHover, className, logoHeight, gap, fadeOutColor, width, ariaLabel } = this.options;
    const isVertical = direction === 'up' || direction === 'down';

    const rootClassName = [
      'logoloop',
      isVertical ? 'logoloop--vertical' : 'logoloop--horizontal',
      fadeOut && 'logoloop--fade',
      scaleOnHover && 'logoloop--scale-hover',
      className
    ].filter(Boolean).join(' ');

    const cssVariables = {
      '--logoloop-gap': `${gap}px`,
      '--logoloop-logoHeight': `${logoHeight}px`,
      ...(fadeOutColor && { '--logoloop-fadeColor': fadeOutColor })
    };

    const styleStr = Object.entries(cssVariables)
      .map(([key, value]) => `${key}: ${value}`)
      .join('; ');

    const containerStyle = isVertical 
      ? (width === '100%' ? '' : `width: ${width};`)
      : `width: ${width};`;

    this.container.className = rootClassName;
    this.container.setAttribute('role', 'region');
    this.container.setAttribute('aria-label', ariaLabel);
    this.container.setAttribute('style', `${containerStyle} ${styleStr}`);

    const trackHTML = `<div class="logoloop__track">${this.renderLists()}</div>`;
    this.container.innerHTML = trackHTML;
  }

  renderLists() {
    const { copyCount } = this.state;
    let html = '';
    for (let copyIndex = 0; copyIndex < copyCount; copyIndex++) {
      html += `<ul class="logoloop__list" data-copy="${copyIndex}" role="list" ${copyIndex > 0 ? 'aria-hidden="true"' : ''}>`;
      this.options.logos.forEach((logo, itemIndex) => {
        html += this.renderLogoItem(logo, `${copyIndex}-${itemIndex}`);
      });
      html += '</ul>';
    }
    return html;
  }

  renderLogoItem(item, key) {
    const content = `<img 
      src="${item.src}" 
      alt="${item.alt || ''}" 
      ${item.title ? `title="${item.title}"` : ''}
      loading="lazy" 
      decoding="async" 
      draggable="false"
    />`;

    const itemContent = item.href 
      ? `<a class="logoloop__link" href="${item.href}" aria-label="${item.alt || item.title || 'logo link'}" target="_blank" rel="noreferrer noopener">${content}</a>`
      : content;

    return `<li class="logoloop__item" key="${key}" role="listitem">${itemContent}</li>`;
  }

  setupRefs() {
    this.refs.track = this.container.querySelector('.logoloop__track');
    this.refs.seq = this.container.querySelector('.logoloop__list[data-copy="0"]');
  }

  setupEventListeners() {
    const { pauseOnHover, hoverSpeed } = this.options;
    const effectiveHoverSpeed = hoverSpeed !== undefined ? hoverSpeed : (pauseOnHover ? 0 : undefined);

    if (effectiveHoverSpeed !== undefined) {
      this.refs.track.addEventListener('mouseenter', () => {
        this.state.isHovered = true;
      });
      this.refs.track.addEventListener('mouseleave', () => {
        this.state.isHovered = false;
      });
    }
  }

  setupResizeObserver() {
    const updateDimensions = () => {
      const isVertical = this.options.direction === 'up' || this.options.direction === 'down';
      const containerWidth = this.container.clientWidth || 0;
      const sequenceRect = this.refs.seq?.getBoundingClientRect();
      const sequenceWidth = sequenceRect?.width || 0;
      const sequenceHeight = sequenceRect?.height || 0;

      if (isVertical) {
        const parentHeight = this.container.parentElement?.clientHeight || 0;
        if (parentHeight > 0) {
          this.container.style.height = `${Math.ceil(parentHeight)}px`;
        }
        if (sequenceHeight > 0) {
          this.state.seqHeight = Math.ceil(sequenceHeight);
          const viewport = this.container.clientHeight || parentHeight || sequenceHeight;
          const copiesNeeded = Math.ceil(viewport / sequenceHeight) + ANIMATION_CONFIG.COPY_HEADROOM;
          const newCopyCount = Math.max(ANIMATION_CONFIG.MIN_COPIES, copiesNeeded);
          if (newCopyCount !== this.state.copyCount) {
            this.state.copyCount = newCopyCount;
            this.updateCopies();
          }
        }
      } else if (sequenceWidth > 0) {
        this.state.seqWidth = Math.ceil(sequenceWidth);
        const copiesNeeded = Math.ceil(containerWidth / sequenceWidth) + ANIMATION_CONFIG.COPY_HEADROOM;
        const newCopyCount = Math.max(ANIMATION_CONFIG.MIN_COPIES, copiesNeeded);
        if (newCopyCount !== this.state.copyCount) {
          this.state.copyCount = newCopyCount;
          this.updateCopies();
        }
      }
    };

    if (window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(updateDimensions);
      this.resizeObserver.observe(this.container);
      if (this.refs.seq) {
        this.resizeObserver.observe(this.refs.seq);
      }
    } else {
      window.addEventListener('resize', updateDimensions);
    }

    updateDimensions();
  }

  updateCopies() {
    this.refs.track.innerHTML = this.renderLists();
    this.refs.seq = this.container.querySelector('.logoloop__list[data-copy="0"]');
  }

  loadImages() {
    const images = this.refs.seq?.querySelectorAll('img') || [];
    if (images.length === 0) {
      this.updateDimensions();
      return;
    }

    let remainingImages = images.length;
    const handleImageLoad = () => {
      remainingImages -= 1;
      if (remainingImages === 0) {
        this.updateDimensions();
      }
    };

    images.forEach(img => {
      if (img.complete) {
        handleImageLoad();
      } else {
        img.addEventListener('load', handleImageLoad, { once: true });
        img.addEventListener('error', handleImageLoad, { once: true });
      }
    });
  }

  updateDimensions() {
    if (this.resizeObserver) {
      // Trigger manual update
      const isVertical = this.options.direction === 'up' || this.options.direction === 'down';
      const containerWidth = this.container.clientWidth || 0;
      const sequenceRect = this.refs.seq?.getBoundingClientRect();
      const sequenceWidth = sequenceRect?.width || 0;
      const sequenceHeight = sequenceRect?.height || 0;

      if (isVertical && sequenceHeight > 0) {
        this.state.seqHeight = Math.ceil(sequenceHeight);
      } else if (sequenceWidth > 0) {
        this.state.seqWidth = Math.ceil(sequenceWidth);
      }
    }
  }

  getTargetVelocity() {
    const { speed, direction } = this.options;
    const magnitude = Math.abs(speed);
    const isVertical = direction === 'up' || direction === 'down';
    
    let directionMultiplier;
    if (isVertical) {
      directionMultiplier = direction === 'up' ? 1 : -1;
    } else {
      directionMultiplier = direction === 'left' ? 1 : -1;
    }
    
    const speedMultiplier = speed < 0 ? -1 : 1;
    return magnitude * directionMultiplier * speedMultiplier;
  }

  startAnimation() {
    const animate = (timestamp) => {
      if (this.state.lastTimestamp === null) {
        this.state.lastTimestamp = timestamp;
      }

      const deltaTime = Math.max(0, timestamp - this.state.lastTimestamp) / 1000;
      this.state.lastTimestamp = timestamp;

      const { pauseOnHover, hoverSpeed, direction } = this.options;
      const isVertical = direction === 'up' || direction === 'down';
      const effectiveHoverSpeed = hoverSpeed !== undefined ? hoverSpeed : (pauseOnHover ? 0 : undefined);
      
      const targetVelocity = this.getTargetVelocity();
      const target = this.state.isHovered && effectiveHoverSpeed !== undefined ? effectiveHoverSpeed : targetVelocity;

      const easingFactor = 1 - Math.exp(-deltaTime / ANIMATION_CONFIG.SMOOTH_TAU);
      this.state.velocity += (target - this.state.velocity) * easingFactor;

      const seqSize = isVertical ? this.state.seqHeight : this.state.seqWidth;

      if (seqSize > 0) {
        let nextOffset = this.state.offset + this.state.velocity * deltaTime;
        nextOffset = ((nextOffset % seqSize) + seqSize) % seqSize;
        this.state.offset = nextOffset;

        const transformValue = isVertical
          ? `translate3d(0, ${-this.state.offset}px, 0)`
          : `translate3d(${-this.state.offset}px, 0, 0)`;
        this.refs.track.style.transform = transformValue;
      }

      this.rafId = requestAnimationFrame(animate);
    };

    this.rafId = requestAnimationFrame(animate);
  }

  destroy() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    this.state.lastTimestamp = null;
  }
}

// Global initialization function
window.initLogoLoop = (container, options) => {
  return new LogoLoop(container, options);
};

// Auto-initialize if data attributes are present
document.addEventListener('DOMContentLoaded', () => {
  const autoInitContainers = document.querySelectorAll('[data-logoloop]');
  autoInitContainers.forEach(container => {
    const options = JSON.parse(container.getAttribute('data-logoloop-options') || '{}');
    new LogoLoop(container, options);
  });
});

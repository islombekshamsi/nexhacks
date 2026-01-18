// dome-gallery.js - Vanilla JS 3D Image Gallery
(() => {
  if (!window.gsap) {
    console.warn('GSAP not loaded, dome-gallery will not initialize');
    return;
  }

  const DEFAULT_IMAGES = [
    {
      src: 'https://images.unsplash.com/photo-1755331039789-7e5680e26e8f?q=80&w=774&auto=format&fit=crop',
      alt: 'Abstract art'
    },
    {
      src: 'https://images.unsplash.com/photo-1755569309049-98410b94f66d?q=80&w=772&auto=format&fit=crop',
      alt: 'Modern sculpture'
    },
    {
      src: 'https://images.unsplash.com/photo-1755497595318-7e5e3523854f?q=80&w=774&auto=format&fit=crop',
      alt: 'Digital artwork'
    },
    {
      src: 'https://images.unsplash.com/photo-1755353985163-c2a0fe5ac3d8?q=80&w=774&auto=format&fit=crop',
      alt: 'Contemporary art'
    },
    {
      src: 'https://images.unsplash.com/photo-1745965976680-d00be7dc0377?q=80&w=774&auto=format&fit=crop',
      alt: 'Geometric pattern'
    },
    {
      src: 'https://images.unsplash.com/photo-1752588975228-21f44630bb3c?q=80&w=774&auto=format&fit=crop',
      alt: 'Textured surface'
    },
    {
      src: 'https://pbs.twimg.com/media/Gyla7NnXMAAXSo_?format=jpg&name=large',
      alt: 'Social media image'
    }
  ];

  const DEFAULTS = {
    maxVerticalRotationDeg: 5,
    dragSensitivity: 20,
    enlargeTransitionMs: 300,
    segments: 35,
    dragDampening: 2
  };

  class DomeGallery {
    constructor(container, options = {}) {
      this.container = container;
      this.options = {
        images: options.images || DEFAULT_IMAGES,
        segments: options.segments || DEFAULTS.segments,
        maxVerticalRotationDeg: options.maxVerticalRotationDeg || DEFAULTS.maxVerticalRotationDeg,
        dragSensitivity: options.dragSensitivity || DEFAULTS.dragSensitivity,
        enlargeTransitionMs: options.enlargeTransitionMs || DEFAULTS.enlargeTransitionMs,
        dragDampening: options.dragDampening || DEFAULTS.dragDampening,
        fit: options.fit || 0.5,
        minRadius: options.minRadius || 600,
        grayscale: options.grayscale !== undefined ? options.grayscale : true,
        imageBorderRadius: options.imageBorderRadius || '30px',
        openedImageBorderRadius: options.openedImageBorderRadius || '30px',
        openedImageWidth: options.openedImageWidth || '250px',
        openedImageHeight: options.openedImageHeight || '350px'
      };

      this.rotation = { x: 0, y: 0 };
      this.startRot = { x: 0, y: 0 };
      this.startPos = null;
      this.isDragging = false;
      this.hasMoved = false;
      this.focusedElement = null;
      this.inertiaRAF = null;
      this.lastDragEnd = 0;

      this.init();
    }

    init() {
      this.buildDOM();
      this.buildItems();
      this.setupResize();
      this.setupGestures();
      this.setupKeyboard();
    }

    buildDOM() {
      this.container.className = 'sphere-root';
      this.container.innerHTML = `
        <main class="sphere-main">
          <div class="stage">
            <div class="sphere"></div>
          </div>
          <div class="overlay"></div>
          <div class="overlay overlay--blur"></div>
          <div class="edge-fade edge-fade--top"></div>
          <div class="edge-fade edge-fade--bottom"></div>
          <div class="viewer">
            <div class="scrim"></div>
            <div class="frame"></div>
          </div>
        </main>
      `;

      this.main = this.container.querySelector('.sphere-main');
      this.sphere = this.container.querySelector('.sphere');
      this.viewer = this.container.querySelector('.viewer');
      this.scrim = this.container.querySelector('.scrim');
      this.frame = this.container.querySelector('.frame');
    }

    buildItems() {
      const items = this.generateItems();
      items.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'item';
        itemDiv.dataset.src = item.src;
        itemDiv.dataset.offsetX = item.x;
        itemDiv.dataset.offsetY = item.y;
        itemDiv.style.setProperty('--offset-x', item.x);
        itemDiv.style.setProperty('--offset-y', item.y);

        const imageDiv = document.createElement('div');
        imageDiv.className = 'item__image cursor-target';
        imageDiv.setAttribute('role', 'button');
        imageDiv.setAttribute('tabindex', '0');
        imageDiv.setAttribute('aria-label', item.alt || 'Open image');

        const img = document.createElement('img');
        img.src = item.src;
        img.alt = item.alt;
        img.draggable = false;

        imageDiv.appendChild(img);
        itemDiv.appendChild(imageDiv);
        this.sphere.appendChild(itemDiv);

        // Click handler
        imageDiv.addEventListener('click', (e) => {
          if (!this.isDragging && !this.hasMoved && 
              performance.now() - this.lastDragEnd > 80) {
            this.openImage(imageDiv);
          }
        });
      });
    }

    generateItems() {
      const seg = this.options.segments;
      const xCols = Array.from({ length: seg }, (_, i) => -37 + i * 2);
      const evenYs = [-4, -2, 0, 2, 4];
      const oddYs = [-3, -1, 1, 3, 5];

      const coords = xCols.flatMap((x, c) => {
        const ys = c % 2 === 0 ? evenYs : oddYs;
        return ys.map(y => ({ x, y }));
      });

      const images = this.options.images;
      return coords.map((c, i) => ({
        ...c,
        src: images[i % images.length].src,
        alt: images[i % images.length].alt
      }));
    }

    setupResize() {
      const updateSize = () => {
        const rect = this.container.getBoundingClientRect();
        const w = Math.max(1, rect.width);
        const h = Math.max(1, rect.height);
        
        let radius = Math.min(w, h) * this.options.fit;
        radius = Math.max(radius, this.options.minRadius);
        radius = Math.round(radius);

        this.container.style.setProperty('--radius', `${radius}px`);
        this.container.style.setProperty('--segments-x', this.options.segments);
        this.container.style.setProperty('--segments-y', this.options.segments);
        this.container.style.setProperty('--tile-radius', this.options.imageBorderRadius);
        this.container.style.setProperty('--enlarge-radius', this.options.openedImageBorderRadius);
        this.container.style.setProperty('--image-filter', this.options.grayscale ? 'grayscale(1)' : 'none');

        this.applyTransform(this.rotation.x, this.rotation.y);
      };

      new ResizeObserver(updateSize).observe(this.container);
      updateSize();
    }

    setupGestures() {
      let startX, startY;

      this.main.addEventListener('pointerdown', (e) => {
        if (this.focusedElement) return;
        this.stopInertia();
        this.isDragging = true;
        this.hasMoved = false;
        this.startRot = { ...this.rotation };
        startX = e.clientX;
        startY = e.clientY;
        this.main.style.cursor = 'grabbing';
      });

      this.main.addEventListener('pointermove', (e) => {
        if (!this.isDragging) return;
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        if (!this.hasMoved && (dx * dx + dy * dy) > 16) {
          this.hasMoved = true;
        }

        const nextX = this.clamp(
          this.startRot.x - dy / this.options.dragSensitivity,
          -this.options.maxVerticalRotationDeg,
          this.options.maxVerticalRotationDeg
        );
        const nextY = this.wrapAngle(this.startRot.y + dx / this.options.dragSensitivity);

        this.rotation = { x: nextX, y: nextY };
        this.applyTransform(nextX, nextY);
      });

      const endDrag = (e) => {
        if (!this.isDragging) return;
        this.isDragging = false;
        this.main.style.cursor = '';

        // Calculate velocity for inertia
        if (this.hasMoved) {
          const dx = e.clientX - startX;
          const dy = e.clientY - startY;
          const vx = dx * 0.01;
          const vy = dy * 0.01;
          this.startInertia(vx, vy);
          this.lastDragEnd = performance.now();
        }

        this.hasMoved = false;
      };

      this.main.addEventListener('pointerup', endDrag);
      this.main.addEventListener('pointercancel', endDrag);
    }

    setupKeyboard() {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.focusedElement) {
          this.closeImage();
        }
      });

      this.scrim.addEventListener('click', () => {
        if (this.focusedElement) {
          this.closeImage();
        }
      });
    }

    applyTransform(xDeg, yDeg) {
      if (this.sphere) {
        this.sphere.style.transform = `translateZ(calc(var(--radius) * -1)) rotateX(${xDeg}deg) rotateY(${yDeg}deg)`;
      }
    }

    startInertia(vx, vy) {
      this.stopInertia();
      
      let velocityX = this.clamp(vx, -1.4, 1.4) * 80;
      let velocityY = this.clamp(vy, -1.4, 1.4) * 80;
      let frames = 0;
      const friction = 0.94 + 0.055 * this.clamp(this.options.dragDampening, 0, 1);
      const maxFrames = 200;

      const step = () => {
        velocityX *= friction;
        velocityY *= friction;

        if (Math.abs(velocityX) < 0.015 && Math.abs(velocityY) < 0.015) {
          this.inertiaRAF = null;
          return;
        }

        if (++frames > maxFrames) {
          this.inertiaRAF = null;
          return;
        }

        const nextX = this.clamp(
          this.rotation.x - velocityY / 200,
          -this.options.maxVerticalRotationDeg,
          this.options.maxVerticalRotationDeg
        );
        const nextY = this.wrapAngle(this.rotation.y + velocityX / 200);

        this.rotation = { x: nextX, y: nextY };
        this.applyTransform(nextX, nextY);

        this.inertiaRAF = requestAnimationFrame(step);
      };

      this.inertiaRAF = requestAnimationFrame(step);
    }

    stopInertia() {
      if (this.inertiaRAF) {
        cancelAnimationFrame(this.inertiaRAF);
        this.inertiaRAF = null;
      }
    }

    openImage(imageDiv) {
      const parent = imageDiv.parentElement;
      this.focusedElement = imageDiv;
      
      document.body.style.overflow = 'hidden';
      this.container.setAttribute('data-enlarging', 'true');

      // Get positions
      const frameRect = this.frame.getBoundingClientRect();
      const mainRect = this.main.getBoundingClientRect();
      const tileRect = imageDiv.getBoundingClientRect();

      // Create enlarged overlay
      const overlay = document.createElement('div');
      overlay.className = 'enlarge';
      overlay.style.cssText = `
        position: absolute;
        left: ${frameRect.left - mainRect.left}px;
        top: ${frameRect.top - mainRect.top}px;
        width: ${frameRect.width}px;
        height: ${frameRect.height}px;
        opacity: 0;
        z-index: 30;
        border-radius: var(--enlarge-radius);
        overflow: hidden;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        transition: all ${this.options.enlargeTransitionMs}ms ease;
      `;

      const img = document.createElement('img');
      img.src = parent.dataset.src || imageDiv.querySelector('img').src;
      img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
      overlay.appendChild(img);

      this.viewer.appendChild(overlay);

      // Hide original
      imageDiv.style.visibility = 'hidden';

      // Animate in
      requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        
        // Resize after initial animation
        setTimeout(() => {
          const centeredLeft = frameRect.left - mainRect.left + (frameRect.width - parseFloat(this.options.openedImageWidth)) / 2;
          const centeredTop = frameRect.top - mainRect.top + (frameRect.height - parseFloat(this.options.openedImageHeight)) / 2;
          
          overlay.style.left = `${centeredLeft}px`;
          overlay.style.top = `${centeredTop}px`;
          overlay.style.width = this.options.openedImageWidth;
          overlay.style.height = this.options.openedImageHeight;
        }, this.options.enlargeTransitionMs);
      });
    }

    closeImage() {
      if (!this.focusedElement) return;

      const overlay = this.viewer.querySelector('.enlarge');
      if (overlay) {
        overlay.style.opacity = '0';
        overlay.style.transform = 'scale(0.9)';

        setTimeout(() => {
          overlay.remove();
          if (this.focusedElement) {
            this.focusedElement.style.visibility = '';
            this.focusedElement = null;
          }
          document.body.style.overflow = '';
          this.container.removeAttribute('data-enlarging');
        }, this.options.enlargeTransitionMs);
      }
    }

    clamp(v, min, max) {
      return Math.min(Math.max(v, min), max);
    }

    wrapAngle(deg) {
      const a = ((deg % 360) + 360) % 360;
      return a > 180 ? a - 360 : a;
    }

    destroy() {
      this.stopInertia();
      document.body.style.overflow = '';
    }
  }

  // Expose globally
  window.DomeGallery = DomeGallery;

  // Auto-initialize if container exists
  window.initDomeGallery = (container, options) => {
    return new DomeGallery(container, options);
  };
})();

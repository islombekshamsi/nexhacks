(() => {
  const initTrueFocus = (gridSelector, cardSelector, config = {}) => {
    const grid = document.querySelector(gridSelector);
    if (!grid) return null;

    const cards = Array.from(grid.querySelectorAll(cardSelector));
    if (!cards.length) return null;

    const settings = {
      blurAmount: config.blurAmount || 5,
      borderColor: config.borderColor || '#40ffaa',
      glowColor: config.glowColor || 'rgba(64, 255, 170, 0.6)',
      animationDuration: config.animationDuration || 0.5,
      pauseBetween: config.pauseBetween || 1
    };

    grid.classList.add('true-focus-grid');
    grid.style.setProperty('--true-focus-border', settings.borderColor);
    grid.style.setProperty('--true-focus-glow', settings.glowColor);
    grid.style.setProperty('--true-focus-blur', `${settings.blurAmount}px`);

    const frame = document.createElement('div');
    frame.className = 'true-focus-frame';
    frame.innerHTML = [
      '<span class="true-focus-corner top-left"></span>',
      '<span class="true-focus-corner top-right"></span>',
      '<span class="true-focus-corner bottom-left"></span>',
      '<span class="true-focus-corner bottom-right"></span>'
    ].join('');
    grid.appendChild(frame);

    let currentIndex = 0;
    let isHovering = false;
    let intervalId = null;

    const updateFrame = (index, animate = true) => {
      const card = cards[index];
      if (!card) return;

      const parentRect = grid.getBoundingClientRect();
      const activeRect = card.getBoundingClientRect();
      const target = {
        x: activeRect.left - parentRect.left,
        y: activeRect.top - parentRect.top,
        width: activeRect.width,
        height: activeRect.height
      };

      if (window.gsap && animate) {
        gsap.to(frame, {
          x: target.x,
          y: target.y,
          width: target.width,
          height: target.height,
          duration: settings.animationDuration,
          ease: 'power2.out'
        });
      } else {
        frame.style.transition = animate
          ? `transform ${settings.animationDuration}s ease, width ${settings.animationDuration}s ease, height ${settings.animationDuration}s ease`
          : 'none';
        frame.style.transform = `translate(${target.x}px, ${target.y}px)`;
        frame.style.width = `${target.width}px`;
        frame.style.height = `${target.height}px`;
      }
    };

    const setActive = (index, animate = true) => {
      currentIndex = index;
      cards.forEach((card, i) => {
        if (i === index) {
          card.classList.add('true-focus-active');
        } else {
          card.classList.remove('true-focus-active');
        }
      });
      updateFrame(index, animate);
      grid.classList.add('true-focus-ready');
    };

    const startAutoCycle = () => {
      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(() => {
        if (isHovering) return;
        const nextIndex = (currentIndex + 1) % cards.length;
        setActive(nextIndex, true);
      }, (settings.animationDuration + settings.pauseBetween) * 1000);
    };

    cards.forEach((card, index) => {
      card.addEventListener('mouseenter', () => {
        isHovering = true;
        setActive(index, true);
      });
      card.addEventListener('mouseleave', () => {
        isHovering = false;
      });
    });

    window.addEventListener('resize', () => updateFrame(currentIndex, false));

    setActive(0, false);
    startAutoCycle();

    return { grid, cards, frame };
  };

  // Initialize for intro spotlight grid
  initTrueFocus('.spotlight-grid', '.card-spotlight', {
    blurAmount: 5,
    borderColor: '#40ffaa',
    glowColor: 'rgba(64, 255, 170, 0.6)',
    animationDuration: 0.5,
    pauseBetween: 1
  });

  // Initialize for voice protocol tasks grid
  initTrueFocus('.protocol-tasks-grid', '.protocol-task-card', {
    blurAmount: 5,
    borderColor: '#40ffaa',
    glowColor: 'rgba(64, 255, 170, 0.6)',
    animationDuration: 0.5,
    pauseBetween: 1
  });
})();

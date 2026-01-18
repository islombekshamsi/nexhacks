(() => {
  if (!window.gsap) return;

  const targetSelector = ".cursor-target";
  const spinDuration = 2;
  const hideDefaultCursor = true;
  const hoverDuration = 0.2;
  const parallaxOn = true;

  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  if (hasTouch) return;

  const cursor = document.createElement("div");
  cursor.className = "target-cursor-wrapper";
  cursor.innerHTML = `
    <div class="target-cursor-dot"></div>
    <div class="target-cursor-corner corner-tl"></div>
    <div class="target-cursor-corner corner-tr"></div>
    <div class="target-cursor-corner corner-br"></div>
    <div class="target-cursor-corner corner-bl"></div>
  `;
  document.body.appendChild(cursor);

  const corners = Array.from(cursor.querySelectorAll(".target-cursor-corner"));
  const dot = cursor.querySelector(".target-cursor-dot");

  if (hideDefaultCursor) {
    document.body.style.cursor = "none";
  }

  window.gsap.set(cursor, {
    xPercent: -50,
    yPercent: -50,
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  });

  const spinTl = window.gsap.timeline({ repeat: -1 }).to(cursor, {
    rotation: "+=360",
    duration: spinDuration,
    ease: "none",
  });

  const moveCursor = (x, y) => {
    window.gsap.to(cursor, { x, y, duration: 0.1, ease: "power3.out" });
  };

  window.addEventListener("mousemove", (e) => moveCursor(e.clientX, e.clientY));

  const getTargets = () => Array.from(document.querySelectorAll(targetSelector));

  let activeTarget = null;
  let targetCorners = null;

  const updateTargetCorners = (rect) => {
    const borderWidth = 3;
    const cornerSize = 12;
    targetCorners = [
      { x: rect.left - borderWidth, y: rect.top - borderWidth },
      { x: rect.right + borderWidth - cornerSize, y: rect.top - borderWidth },
      { x: rect.right + borderWidth - cornerSize, y: rect.bottom + borderWidth - cornerSize },
      { x: rect.left - borderWidth, y: rect.bottom + borderWidth - cornerSize },
    ];
  };

  const activateTarget = (target) => {
    activeTarget = target;
    const rect = target.getBoundingClientRect();
    updateTargetCorners(rect);

    const cursorX = window.gsap.getProperty(cursor, "x");
    const cursorY = window.gsap.getProperty(cursor, "y");

    spinTl.pause();
    window.gsap.set(cursor, { rotation: 0 });

    corners.forEach((corner, i) => {
      window.gsap.to(corner, {
        x: targetCorners[i].x - cursorX,
        y: targetCorners[i].y - cursorY,
        duration: 0.2,
        ease: "power2.out",
      });
    });

    window.gsap.to(dot, { scale: 0.7, duration: hoverDuration, ease: "power2.out" });
  };

  const deactivateTarget = () => {
    activeTarget = null;
    targetCorners = null;
    const cornerSize = 12;
    const positions = [
      { x: -cornerSize * 1.5, y: -cornerSize * 1.5 },
      { x: cornerSize * 0.5, y: -cornerSize * 1.5 },
      { x: cornerSize * 0.5, y: cornerSize * 0.5 },
      { x: -cornerSize * 1.5, y: cornerSize * 0.5 },
    ];

    corners.forEach((corner, i) => {
      window.gsap.to(corner, {
        x: positions[i].x,
        y: positions[i].y,
        duration: 0.3,
        ease: "power3.out",
      });
    });

    window.gsap.to(dot, { scale: 1, duration: 0.3, ease: "power2.out" });
    spinTl.restart();
  };

  document.addEventListener("mouseover", (e) => {
    const target = e.target.closest(targetSelector);
    if (!target || target === activeTarget) return;
    activateTarget(target);
  });

  document.addEventListener("mouseleave", (e) => {
    if (activeTarget && e.target === activeTarget) {
      deactivateTarget();
    }
  }, true);

  window.addEventListener("scroll", () => {
    if (!activeTarget) return;
    const rect = activeTarget.getBoundingClientRect();
    updateTargetCorners(rect);
  }, { passive: true });

  if (parallaxOn) {
    window.gsap.ticker.add(() => {
      if (!targetCorners || !cursor) return;
      const cursorX = window.gsap.getProperty(cursor, "x");
      const cursorY = window.gsap.getProperty(cursor, "y");
      corners.forEach((corner, i) => {
        const targetX = targetCorners[i].x - cursorX;
        const targetY = targetCorners[i].y - cursorY;
        const currentX = window.gsap.getProperty(corner, "x");
        const currentY = window.gsap.getProperty(corner, "y");
        const finalX = currentX + (targetX - currentX) * 0.2;
        const finalY = currentY + (targetY - currentY) * 0.2;
        window.gsap.to(corner, { x: finalX, y: finalY, duration: 0.2, ease: "power1.out" });
      });
    });
  }

  const autoTargets = Array.from(document.querySelectorAll("button, a, .card-spotlight, .pill-logo"));
  autoTargets.forEach((el) => el.classList.add("cursor-target"));
})();

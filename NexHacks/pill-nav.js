(() => {
  if (!window.gsap) return;

  const nav = document.querySelector(".pill-nav");
  const pills = Array.from(document.querySelectorAll(".pill"));
  const circles = Array.from(document.querySelectorAll(".hover-circle"));
  const logo = document.querySelector(".pill-logo");
  const logoText = document.querySelector(".pill-logo-text");
  const mobileToggle = document.getElementById("pillNavMobileToggle");
  const mobileMenu = document.getElementById("pillNavMobileMenu");

  const showIntroView = () => {
    console.log("🏠 showIntroView() called");
    
    // Hide all dashboard sections
    const appViews = document.querySelectorAll(".app-view");
    appViews.forEach((section) => {
      section.classList.add("hidden");
      console.log("❌ Hiding dashboard section:", section.id || section.className);
    });
    
    // Show intro sections
    const introSection = document.getElementById("introSection");
    const introHighlights = document.getElementById("introHighlights");
    const introViews = document.querySelectorAll(".intro-view");
    
    if (introSection) {
      introSection.classList.remove("hidden");
      console.log("✅ Showing introSection");
    }
    
    if (introHighlights) {
      introHighlights.classList.remove("hidden");
      console.log("✅ Showing introHighlights");
    }
    
    introViews.forEach((section) => {
      section.classList.remove("hidden");
      console.log("✅ Showing intro view section:", section.className);
    });
    
    // Scroll to top
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 100);
  };

  const showAppView = () => {
    console.log("🎯 showAppView() called");
    
    const appViews = document.querySelectorAll(".app-view");
    console.log(`📊 Found ${appViews.length} app-view sections`);
    
    appViews.forEach((section) => {
      section.classList.remove("hidden");
      console.log("✅ Showing section:", section.id || section.className);
    });
    
    const introSection = document.getElementById("introSection");
    const introHighlights = document.getElementById("introHighlights");
    const introViews = document.querySelectorAll(".intro-view");
    
    if (introSection) {
      introSection.classList.add("hidden");
      console.log("❌ Hiding introSection");
    }
    
    if (introHighlights) {
      introHighlights.classList.add("hidden");
      console.log("❌ Hiding introHighlights");
    }
    
    introViews.forEach((section) => {
      section.classList.add("hidden");
      console.log("❌ Hiding intro view section:", section.className);
    });
  };

  const isHomeLink = (href) => href === "#detectionSection" || href === "#home" || href === "";
  const isIntroLink = (href) => href === "#introSection";
  const isVoiceLink = (href) => href === "#voiceAssessmentSection";
  const isDashboardLink = (href) =>
    href === "#monitoringSection" || href === "#alertsSection";

  const setupPill = (pill, circle) => {
    const rect = pill.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const R = ((w * w) / 4 + h * h) / (2 * h);
    const D = Math.ceil(2 * R) + 2;
    const delta = Math.ceil(R - Math.sqrt(Math.max(0, R * R - (w * w) / 4))) + 1;
    const originY = D - delta;

    circle.style.width = `${D}px`;
    circle.style.height = `${D}px`;
    circle.style.bottom = `-${delta}px`;

    window.gsap.set(circle, {
      xPercent: -50,
      scale: 0,
      transformOrigin: `50% ${originY}px`,
    });

    const label = pill.querySelector(".pill-label");
    const hover = pill.querySelector(".pill-label-hover");
    if (label) window.gsap.set(label, { y: 0 });
    if (hover) window.gsap.set(hover, { y: h + 12, opacity: 0 });

    const tl = window.gsap.timeline({ paused: true });
    tl.to(circle, { scale: 1.2, duration: 2, ease: "power2.easeOut" }, 0);
    if (label) tl.to(label, { y: -(h + 8), duration: 2, ease: "power2.easeOut" }, 0);
    if (hover) {
      window.gsap.set(hover, { y: Math.ceil(h + 100), opacity: 0 });
      tl.to(hover, { y: 0, opacity: 1, duration: 2, ease: "power2.easeOut" }, 0);
    }

    pill.addEventListener("mouseenter", () => tl.tweenTo(tl.duration(), { duration: 0.3 }));
    pill.addEventListener("mouseleave", () => tl.tweenTo(0, { duration: 0.2 }));
  };

  const layout = () => {
    pills.forEach((pill, i) => setupPill(pill, circles[i]));
  };

  layout();
  window.addEventListener("resize", layout);

  if (logo && logoText) {
    logo.addEventListener("mouseenter", () => {
      window.gsap.to(logoText, { rotation: 360, duration: 0.4, ease: "power2.out" });
    });
  }

  const showVoiceView = () => {
    console.log("🎤 showVoiceView() called");
    
    // Hide intro sections
    const introSection = document.getElementById("introSection");
    const introHighlights = document.getElementById("introHighlights");
    const introViews = document.querySelectorAll(".intro-view");
    
    if (introSection) introSection.classList.add("hidden");
    if (introHighlights) introHighlights.classList.add("hidden");
    introViews.forEach((section) => section.classList.add("hidden"));
    
    // Hide other app sections but show voice assessment
    const appViews = document.querySelectorAll(".app-view");
    appViews.forEach((section) => {
      if (section.id === "voiceAssessmentSection") {
        section.classList.remove("hidden");
        console.log("✅ Showing voice assessment");
      } else {
        section.classList.add("hidden");
      }
    });
    
    // Scroll to voice assessment
    setTimeout(() => {
      const voiceSection = document.getElementById("voiceAssessmentSection");
      if (voiceSection) {
        voiceSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  };

  const handleNavClick = (event) => {
    const target = event.target.closest("a");
    if (!target) return;
    
    event.preventDefault(); // Always prevent default anchor behavior
    
    const href = target.getAttribute("href") || "";
    console.log("🔍 Nav click detected - href:", href); // Debug log
    
    if (isHomeLink(href)) {
      console.log("🏠 Home link clicked - showing intro view");
      showIntroView();
      return;
    }
    
    if (isIntroLink(href)) {
      console.log("📍 About link clicked - showing intro view");
      showIntroView();
      return;
    }
    
    if (isVoiceLink(href)) {
      console.log("🎤 Voice link clicked - showing voice assessment");
      showVoiceView();
      return;
    }
    
    if (isDashboardLink(href)) {
      console.log("✅ Dashboard link clicked - showing app view");
      showAppView();
      
      // Small delay to ensure DOM updates before scrolling
      setTimeout(() => {
        const targetSection = document.getElementById(href.replace("#", ""));
        if (targetSection) {
          targetSection.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    }
  };

  nav?.addEventListener("click", handleNavClick);

  logo?.addEventListener("click", (event) => {
    event.preventDefault();
    console.log("🏠 Logo clicked - showing intro view");
    showIntroView();
  });

  if (mobileToggle && mobileMenu) {
    window.gsap.set(mobileMenu, { visibility: "hidden", opacity: 0, scaleY: 1 });
    mobileToggle.addEventListener("click", () => {
      const open = mobileMenu.style.visibility !== "visible";
      if (open) {
        window.gsap.set(mobileMenu, { visibility: "visible" });
        window.gsap.fromTo(
          mobileMenu,
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" }
        );
      } else {
        window.gsap.to(mobileMenu, {
          opacity: 0,
          y: 10,
          duration: 0.2,
          ease: "power2.in",
          onComplete: () => window.gsap.set(mobileMenu, { visibility: "hidden" }),
        });
      }
    });

    mobileMenu.addEventListener("click", (event) => {
      const link = event.target.closest("a");
      if (link) {
        event.preventDefault(); // Prevent default anchor behavior
        
        const href = link.getAttribute("href") || "";
        console.log("📱 Mobile menu link clicked - href:", href);
        
        if (isHomeLink(href)) {
          console.log("🏠 Mobile: Home link clicked");
          showIntroView();
        } else if (isIntroLink(href)) {
          console.log("📍 Mobile: About link clicked");
          showIntroView();
        } else if (isVoiceLink(href)) {
          console.log("🎤 Mobile: Voice link clicked");
          showVoiceView();
        } else if (isDashboardLink(href)) {
          console.log("✅ Mobile: Dashboard link clicked");
          showAppView();
          
          // Scroll to target section
          setTimeout(() => {
            const targetSection = document.getElementById(href.replace("#", ""));
            if (targetSection) {
              targetSection.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }, 100);
        }
        
        // Close mobile menu
        window.gsap.set(mobileMenu, { visibility: "hidden", opacity: 0 });
      }
    });
  }
})();

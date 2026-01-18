(() => {
  const navEl = document.querySelector(".card-nav");
  const contentEl = document.getElementById("cardNavContent");
  const toggle = document.getElementById("cardNavToggle");
  const cta = document.getElementById("getStartedBtn");

  if (!navEl || !contentEl || !toggle || !window.gsap) return;

  const items = [
    {
      label: "Project",
      bgColor: "#0D0716",
      textColor: "#fff",
      links: [
        { label: "Overview", href: "#introSection" },
        { label: "Safety", href: "#safetySection" },
      ],
    },
    {
      label: "Monitoring",
      bgColor: "#170D27",
      textColor: "#fff",
      links: [
        { label: "Status", href: "#monitoringSection" },
        { label: "Alerts", href: "#alertsSection" },
      ],
    },
    {
      label: "Detection",
      bgColor: "#271E37",
      textColor: "#fff",
      links: [
        { label: "Live Preview", href: "#detectionSection" },
        { label: "Output Stream", href: "#outputSection" },
      ],
    },
  ];

  const buildCards = () => {
    contentEl.innerHTML = "";
    items.slice(0, 3).forEach((item, idx) => {
      const card = document.createElement("div");
      card.className = "nav-card";
      card.style.backgroundColor = item.bgColor;
      card.style.color = item.textColor;
      card.dataset.index = String(idx);

      const label = document.createElement("div");
      label.className = "nav-card-label";
      label.textContent = item.label;
      card.appendChild(label);

      const links = document.createElement("div");
      links.className = "nav-card-links";
      (item.links || []).forEach((lnk, i) => {
        const a = document.createElement("a");
        a.className = "nav-card-link";
        a.href = lnk.href;
        a.setAttribute("aria-label", lnk.ariaLabel || lnk.label);
        a.innerHTML = `<span class="nav-card-link-icon">↗</span>${lnk.label}`;
        a.addEventListener("click", () => closeMenu());
        links.appendChild(a);
      });

      card.appendChild(links);
      contentEl.appendChild(card);
    });
  };

  let isExpanded = false;
  let tl = null;

  const calculateHeight = () => {
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    if (isMobile) {
      const topBar = 60;
      const padding = 16;
      return topBar + contentEl.scrollHeight + padding;
    }
    return 260;
  };

  const createTimeline = () => {
    window.gsap.set(navEl, { height: 60, overflow: "hidden" });
    window.gsap.set(contentEl.children, { y: 50, opacity: 0 });

    const timeline = window.gsap.timeline({ paused: true });
    timeline.to(navEl, { height: calculateHeight, duration: 0.4, ease: "power3.out" });
    timeline.to(contentEl.children, { y: 0, opacity: 1, duration: 0.4, ease: "power3.out", stagger: 0.08 }, "-=0.1");
    return timeline;
  };

  const openMenu = () => {
    if (!tl) return;
    toggle.classList.add("open");
    navEl.classList.add("open");
    contentEl.setAttribute("aria-hidden", "false");
    tl.play(0);
    isExpanded = true;
  };

  const closeMenu = () => {
    if (!tl) return;
    toggle.classList.remove("open");
    tl.eventCallback("onReverseComplete", () => {
      navEl.classList.remove("open");
      contentEl.setAttribute("aria-hidden", "true");
      isExpanded = false;
    });
    tl.reverse();
  };

  const toggleMenu = () => {
    if (!isExpanded) {
      openMenu();
    } else {
      closeMenu();
    }
  };

  buildCards();
  tl = createTimeline();

  toggle.addEventListener("click", toggleMenu);
  toggle.addEventListener("keypress", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      toggleMenu();
    }
  });

  cta?.addEventListener("click", () => {
    document.querySelectorAll(".app-view").forEach((section) => {
      if (section.id === "detectionSection") {
        section.classList.remove("hidden");
      } else {
        section.classList.add("hidden");
      }
    });
    document.getElementById("introSection")?.classList.add("hidden");
    document.getElementById("introHighlights")?.classList.add("hidden");
    document.getElementById("detectionSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
    closeMenu();
  });

  window.addEventListener("resize", () => {
    if (!tl) return;
    tl.kill();
    tl = createTimeline();
    if (isExpanded) {
      tl.progress(1);
    }
  });
})();

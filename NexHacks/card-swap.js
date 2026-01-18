(() => {
  // Initialize Dome Gallery
  const domeContainer = document.getElementById("domeGallery");
  if (domeContainer && window.DomeGallery) {
    // Prevent other scripts (e.g., app.js) from re-initializing and overriding images
    window.__domeGalleryInitialized = true;
    new window.DomeGallery(domeContainer, {
      images: [
        {
          src: 'r1.png',
          alt: 'Research Paper 1'
        },
        {
          src: 'r2.png',
          alt: 'Research Paper 2'
        },
        {
          src: 'r3.png',
          alt: 'Research Paper 3'
        },
        {
          src: 'r4.png',
          alt: 'Research Paper 4'
        },
        {
          src: 'r5.png',
          alt: 'Research Paper 5'
        },
        {
          src: 'r6.png',
          alt: 'Research Paper 6'
        },
        {
          src: 'r7.png',
          alt: 'Research Paper 7'
        },
        {
          src: 'r8.png',
          alt: 'Research Paper 8'
        },
        {
          src: 'r9.png',
          alt: 'Research Paper 9'
        },
        {
          src: 'r10.png',
          alt: 'Research Paper 10'
        }
      ],
      segments: 12,
      fit: 1.0,
      minRadius: 350,
      maxRadius: 500,
      grayscale: false,
      dragSensitivity: 18,
      dragDampening: 2.5,
      enlargeTransitionMs: 500,
      imageBorderRadius: '32px',
      openedImageBorderRadius: '36px',
      openedImageWidth: '850px',
      openedImageHeight: '1050px',
      maxVerticalRotationDeg: 8
    });
    console.log('✨ Dome Gallery initialized - Full screen mode');
  }

  // Legacy card swap code (keeping for reference, can be removed)
  if (!window.gsap) return;

  const container = document.getElementById("cardSwap");
  if (!container) return;

  const cards = [
    {
      title: "Recognize Stroke Fast",
      description: "CDC signs & symptoms to spot early neurological change.",
      href: "https://www.cdc.gov/stroke/signs_symptoms.htm",
      image: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=900&q=80",
    },
    {
      title: "Pupillary Light Reflex",
      description: "Clinical explanation of pupil response and reflex basics.",
      href: "https://www.ncbi.nlm.nih.gov/books/NBK392/",
      image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=900&q=80",
    },
    {
      title: "Time‑to‑Treatment",
      description: "Why minutes matter in neurological deterioration.",
      href: "https://www.stroke.org/en/about-stroke/stroke-symptoms",
      image: "https://images.unsplash.com/photo-1495364141860-b0d03eccd065?auto=format&fit=crop&w=900&q=80",
    },
  ];

  const width = 520;
  const height = 360;
  const cardDistance = 60;
  const verticalDistance = 70;
  const delay = 5000;
  const skewAmount = 6;

  container.style.width = `${width}px`;
  container.style.height = `${height}px`;

  const elements = cards.map((card, idx) => {
    const el = document.createElement("article");
    el.className = "card-swap-item";
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
    el.innerHTML = `
      <img src="${card.image}" alt="${card.title}" />
      <div>
        <h3>${card.title}</h3>
        <p>${card.description}</p>
        <a href="#" class="article-link cursor-target" data-article-index="${idx}">Read article</a>
      </div>
    `;
    container.appendChild(el);
    
    // Add click handler for the article link
    const link = el.querySelector('.article-link');
    link.addEventListener('click', (e) => {
      e.preventDefault();
      openArticleModal(card.title, card.href);
    });
    
    return el;
  });

  const makeSlot = (i, total) => ({
    x: i * cardDistance,
    y: -i * verticalDistance,
    z: -i * cardDistance * 1.5,
    zIndex: total - i,
  });

  const placeNow = (el, slot) => {
    window.gsap.set(el, {
      x: slot.x,
      y: slot.y,
      z: slot.z,
      xPercent: -50,
      yPercent: -50,
      skewY: skewAmount,
      transformOrigin: "center center",
      zIndex: slot.zIndex,
      force3D: true,
    });
  };

  const order = Array.from({ length: elements.length }, (_, i) => i);

  elements.forEach((el, i) => placeNow(el, makeSlot(i, elements.length)));

  const swap = () => {
    if (order.length < 2) return;
    const [front, ...rest] = order;
    const elFront = elements[front];
    const tl = window.gsap.timeline();

    tl.to(elFront, {
      y: "+=500",
      duration: 2,
      ease: "elastic.out(0.6,0.9)",
    });

    tl.addLabel("promote", "-=1.8");
    rest.forEach((idx, i) => {
      const el = elements[idx];
      const slot = makeSlot(i, elements.length);
      tl.set(el, { zIndex: slot.zIndex }, "promote");
      tl.to(
        el,
        {
          x: slot.x,
          y: slot.y,
          z: slot.z,
          duration: 2,
          ease: "elastic.out(0.6,0.9)",
        },
        `promote+=${i * 0.15}`
      );
    });

    const backSlot = makeSlot(elements.length - 1, elements.length);
    tl.addLabel("return", "-=1.6");
    tl.call(() => {
      window.gsap.set(elFront, { zIndex: backSlot.zIndex });
    });
    tl.to(elFront, {
      x: backSlot.x,
      y: backSlot.y,
      z: backSlot.z,
      duration: 2,
      ease: "elastic.out(0.6,0.9)",
    });

    order.push(order.shift());
  };

  swap();
  setInterval(swap, delay);

  // Article modal functionality
  function openArticleModal(title, url) {
    const modal = document.getElementById('articleModal');
    const modalTitle = document.getElementById('articleModalTitle');
    const modalIframe = document.getElementById('articleModalIframe');
    const modalLoading = document.getElementById('articleModalLoading');
    
    if (!modal || !modalTitle || !modalIframe || !modalLoading) {
      console.error('Article modal elements not found');
      return;
    }
    
    // Set title
    modalTitle.textContent = title;
    
    // Show loading
    modalLoading.style.display = 'flex';
    modalIframe.style.opacity = '0';
    
    // Clear previous iframe
    modalIframe.src = '';
    
    // Open modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Load iframe after a short delay
    setTimeout(() => {
      modalIframe.src = url;
      
      // Hide loading when iframe loads
      modalIframe.onload = () => {
        modalLoading.style.display = 'none';
        window.gsap.to(modalIframe, {
          opacity: 1,
          duration: 0.3,
          ease: 'power2.out'
        });
      };
      
      // Handle iframe load errors
      modalIframe.onerror = () => {
        modalLoading.innerHTML = '<span style="color: #ff6b6b;">Failed to load article. <a href="' + url + '" target="_blank" style="color: #40ffaa;">Open in new tab →</a></span>';
      };
    }, 100);
  }

  // Close modal functionality
  const closeModal = document.getElementById('articleModalClose');
  const modal = document.getElementById('articleModal');
  
  if (closeModal && modal) {
    closeModal.addEventListener('click', () => {
      modal.classList.remove('active');
      document.body.style.overflow = '';
      
      // Clear iframe after closing
      setTimeout(() => {
        const iframe = document.getElementById('articleModalIframe');
        if (iframe) iframe.src = '';
      }, 300);
    });
    
    // Close on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal.click();
      }
    });
    
    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('active')) {
        closeModal.click();
      }
    });
  }
})();

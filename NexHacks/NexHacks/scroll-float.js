(() => {
  if (!window.gsap || !window.ScrollTrigger) return;

  window.gsap.registerPlugin(window.ScrollTrigger);

  const targets = document.querySelectorAll(".scroll-float");
  targets.forEach((el) => {
    const text = el.dataset.text || "";
    el.innerHTML = "";

    const wrapper = document.createElement("span");
    wrapper.className = "scroll-float-text";
    text.split("").forEach((char) => {
      const span = document.createElement("span");
      span.className = "char";
      span.textContent = char === " " ? "\u00A0" : char;
      wrapper.appendChild(span);
    });
    el.appendChild(wrapper);

    const chars = wrapper.querySelectorAll(".char");

    window.gsap.fromTo(
      chars,
      {
        opacity: 0,
        yPercent: 120,
        scaleY: 2.3,
        scaleX: 0.7,
        transformOrigin: "50% 0%",
      },
      {
        duration: 1,
        ease: "back.inOut(2)",
        opacity: 1,
        yPercent: 0,
        scaleY: 1,
        scaleX: 1,
        stagger: 0.03,
        scrollTrigger: {
          trigger: el,
          start: "center bottom+=50%",
          end: "bottom bottom-=40%",
          scrub: true,
        },
      }
    );
  });
})();

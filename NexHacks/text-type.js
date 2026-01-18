(() => {
  const target = document.getElementById("introType");
  if (!target) return;

  const textArray = [
    "Continuous monitoring with on-demand interrogation for neurological vigilance.",
    "Tracks facial symmetry, pupil behavior, and speech timing.",
    "Advisory-only alerts to support clinical review.",
  ];

  const typingSpeed = 42;
  const deletingSpeed = 24;
  const pauseDuration = 1800;
  const loop = true;

  let displayedText = "";
  let currentCharIndex = 0;
  let isDeleting = false;
  let currentTextIndex = 0;

  const tick = () => {
    const currentText = textArray[currentTextIndex];

    if (isDeleting) {
      displayedText = displayedText.slice(0, -1);
      target.textContent = displayedText;
      if (displayedText.length === 0) {
        isDeleting = false;
        currentTextIndex = (currentTextIndex + 1) % textArray.length;
        setTimeout(tick, 200);
        return;
      }
      setTimeout(tick, deletingSpeed);
      return;
    }

    if (currentCharIndex < currentText.length) {
      displayedText += currentText[currentCharIndex];
      currentCharIndex += 1;
      target.textContent = displayedText;
      setTimeout(tick, typingSpeed);
      return;
    }

    if (!loop && currentTextIndex === textArray.length - 1) return;
    currentCharIndex = 0;
    isDeleting = true;
    setTimeout(tick, pauseDuration);
  };

  tick();
})();

const STEPS = 6;
const scene = document.getElementById("scroll-scene");
const mover = document.getElementById("mover");
const frames = [...mover.querySelectorAll("img")];

let ticking = false;
let currentStep = -1;

const update = () => {
  const rect = scene.getBoundingClientRect();
  const travel = scene.offsetHeight - window.innerHeight;
  const scrolled = Math.min(Math.max(-rect.top, 0), travel);
  const progress = travel === 0 ? 0 : scrolled / travel;
  const step = Math.min(STEPS - 1, Math.floor(progress * STEPS));

  const widthVw = (mover.offsetWidth / window.innerWidth) * 100;
  const inset = 15;
  const start = inset;
  const end = 100 - inset - widthVw;
  const x = start + ((end - start) * step) / (STEPS - 1);

  mover.style.transform = `translate3d(${x}vw, -50%, 0)`;

  if (step !== currentStep) {
    frames.forEach((frame, index) => {
      frame.classList.toggle("is-active", index === step);
    });
    currentStep = step;
  }

  ticking = false;
};

const onScroll = () => {
  if (!ticking) {
    ticking = true;
    requestAnimationFrame(update);
  }
};

update();
window.addEventListener("scroll", onScroll, { passive: true });
window.addEventListener("resize", update);

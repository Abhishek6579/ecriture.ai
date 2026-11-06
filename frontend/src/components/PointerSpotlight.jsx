import { useEffect } from 'react';

// One page-wide cursor light. Its intensity fades with scroll depth and is
// fully gone after the visitor has moved well past the opening sections.
export default function PointerSpotlight() {
  useEffect(() => {
    let frame = 0;
    let pointerX = window.innerWidth * 0.5;
    let pointerY = window.innerHeight * 0.25;
    let scrollY = window.scrollY;
    const root = document.documentElement;

    const render = () => {
      frame = 0;
      const fade = Math.max(0, 1 - Math.max(0, scrollY - 80) / 1450);
      root.style.setProperty('--pointer-x', `${pointerX}px`);
      root.style.setProperty('--pointer-y', `${pointerY}px`);
      root.style.setProperty('--pointer-glow-opacity', `${fade}`);
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(render); };
    const onPointerMove = (event) => { pointerX = event.clientX; pointerY = event.clientY; schedule(); };
    const onScroll = () => { scrollY = window.scrollY; schedule(); };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    render();
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
      root.style.removeProperty('--pointer-x');
      root.style.removeProperty('--pointer-y');
      root.style.removeProperty('--pointer-glow-opacity');
    };
  }, []);
  return null;
}

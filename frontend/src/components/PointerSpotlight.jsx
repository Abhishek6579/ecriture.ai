import { useEffect } from 'react';

// Draw one shared dot field. Each dot is painted exactly once; pointer proximity
// changes that same dot's colour, opacity, and soft shadow instead of drawing
// a second set of dots over the background.
export default function PointerSpotlight() {
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.className = 'pointer-dot-field';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(canvas);

    const context = canvas.getContext('2d', { alpha: true });
    if (!context) {
      canvas.remove();
      return undefined;
    }
    const root = document.documentElement;
    const mediaReduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const spacing = 22;
    const radius = 205;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 1.6);
    let pointerX = -1000;
    let pointerY = -1000;
    let pointerActive = false;
    let scrollY = window.scrollY;
    let frame = 0;
    let theme = root.dataset.theme || 'dark';

    const palettes = {
      dark: { base: [164, 175, 180], lit: [226, 234, 237], baseAlpha: 0.22, litAlpha: 0.78 },
      light: { base: [76, 91, 98], lit: [20, 35, 42], baseAlpha: 0.2, litAlpha: 0.76 },
    };

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.6);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      schedule();
    };

    const mix = (from, to, amount) => from.map((value, index) => Math.round(value + (to[index] - value) * amount));

    const render = () => {
      frame = 0;
      context.clearRect(0, 0, width, height);
      context.shadowBlur = 0;
      const palette = palettes[theme] || palettes.dark;
      const scrollFade = Math.max(0, 1 - Math.max(0, scrollY - 40) / 1180);
      const pointerStrength = pointerActive && !mediaReduceMotion?.matches ? scrollFade : 0;
      const radiusSquared = radius * radius;

      // This loop is the only source of background dots: the existing dots
      // become darker/brighter near the pointer without any overlay pattern.
      for (let y = spacing / 2; y < height; y += spacing) {
        for (let x = spacing / 2; x < width; x += spacing) {
          const dx = x - pointerX;
          const dy = y - pointerY;
          const distanceSquared = dx * dx + dy * dy;
          const proximity = distanceSquared < radiusSquared
            ? Math.exp(-distanceSquared / (2 * (radius * 0.48) ** 2)) * pointerStrength
            : 0;
          const colour = mix(palette.base, palette.lit, proximity);
          const alpha = palette.baseAlpha + (palette.litAlpha - palette.baseAlpha) * proximity;

          context.beginPath();
          context.fillStyle = `rgba(${colour[0]}, ${colour[1]}, ${colour[2]}, ${alpha})`;
          context.shadowColor = `rgba(${colour[0]}, ${colour[1]}, ${colour[2]}, ${proximity * 0.52})`;
          context.shadowBlur = proximity > 0.035 ? proximity * 5 : 0;
          context.arc(x, y, 0.82 + proximity * 0.12, 0, Math.PI * 2);
          context.fill();
        }
      }
      context.shadowBlur = 0;
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(render);
    };

    const onPointerMove = (event) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      pointerActive = true;
      schedule();
    };
    const onPointerLeave = (event) => {
      if (event.relatedTarget === null) {
        pointerActive = false;
        schedule();
      }
    };
    const onScroll = () => { scrollY = window.scrollY; schedule(); };
    const onThemeChange = () => { theme = root.dataset.theme || 'dark'; schedule(); };
    const themeObserver = new MutationObserver(onThemeChange);
    themeObserver.observe(root, { attributes: true, attributeFilter: ['data-theme'] });

    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerout', onPointerLeave, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    resize();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerout', onPointerLeave);
      window.removeEventListener('scroll', onScroll);
      themeObserver.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      canvas.remove();
    };
  }, []);

  return null;
}

import { useEffect } from 'react';

// Draw one shared dot field. Each dot is painted exactly once; pointer proximity
// changes that same dot's colour and opacity instead of drawing a second set of
// dots over the background.
//
// Dark theme: the original soft, glowing spotlight.
// Light theme: a quiet silver field that darkens to graphite under the pointer.
//   Light dots are deliberately pale so body text stays readable, and there is
//   no glow or blue tint.
//
// Touch / small screens: the spotlight is mouse-only. The dots stay as a static
// background, and scrolling never triggers a redraw.
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
    const mediaCompact = window.matchMedia?.('(max-width: 760px), (hover: none) and (pointer: coarse)');
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
    let sized = false;

    const palettes = {
      dark: { base: [164, 175, 180], lit: [226, 234, 237], baseAlpha: 0.22, litAlpha: 0.78 },
      light: { base: [160, 171, 177], lit: [58, 68, 74], baseAlpha: 0.5, litAlpha: 0.62 },
    };

    const isCompact = () => Boolean(mediaCompact?.matches);

    const resize = () => {
      const nextWidth = window.innerWidth;
      const nextHeight = window.innerHeight;
      // Mobile browsers fire resize while the address bar slides in and out
      // during a scroll. Re-allocating the canvas each time causes flicker and
      // jank, so on compact screens only grow the canvas, never shrink it.
      if (sized && isCompact() && nextWidth === width && nextHeight <= height) return;
      width = nextWidth;
      height = nextHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.6);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      sized = true;
      schedule();
    };

    const mix = (from, to, amount) => from.map((value, index) => Math.round(value + (to[index] - value) * amount));

    const render = () => {
      frame = 0;
      context.clearRect(0, 0, width, height);
      context.shadowBlur = 0;
      const palette = palettes[theme] || palettes.dark;
      const glows = theme !== 'light';
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
          if (glows) {
            context.shadowColor = `rgba(${colour[0]}, ${colour[1]}, ${colour[2]}, ${proximity * 0.52})`;
            context.shadowBlur = proximity > 0.035 ? proximity * 5 : 0;
          }
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
      // Touch and pen input (and any small screen) never drives the spotlight.
      if (event.pointerType !== 'mouse' || isCompact()) {
        if (pointerActive) {
          pointerActive = false;
          schedule();
        }
        return;
      }
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
    const onScroll = () => {
      scrollY = window.scrollY;
      // The scroll position only changes how strong the spotlight is, so there
      // is nothing to repaint unless a mouse spotlight is currently showing.
      if (pointerActive) schedule();
    };
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

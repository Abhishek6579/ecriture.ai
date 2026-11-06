import { useEffect, useRef } from 'react';
import './LetterGlitch.css';

const CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*+=<>?/\\[]{}';
const LIGHT_THEME_COLORS = ['#64747a', '#2c9069'];
const randomCharacter = () => CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * Lightweight canvas letter field for the recognition workspace.
 * The props intentionally mirror the LetterGlitch configuration used by the page.
 */
export default function LetterGlitch({
  glitchColors = ['#ffffff', '#61dca3'],
  glitchAmount = 0.5,
  speed = 1,
  flow = 0.5,
  clickEffect = 'tear',
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d', { alpha: true });
    if (!canvas || !context) return undefined;

    const host = canvas.parentElement;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const colors = Array.isArray(glitchColors) && glitchColors.length
      ? glitchColors
      : ['#ffffff', '#61dca3'];
    const amount = clamp(Number(glitchAmount) || 0, 0, 1);
    const rate = clamp(Number(speed) || 1, 0.1, 4);
    const drift = clamp(Number(flow) || 0, -1, 1);
    const fontSize = 13;
    const cellWidth = 14;
    const cellHeight = 20;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let columns = 0;
    let rows = 0;
    let cells = [];
    let frame = 0;
    let lastUpdate = 0;
    let lastPaint = 0;
    let offset = 0;
    let pointer = { x: -1000, y: -1000, active: false };
    let tear = null;
    let disposed = false;

    const resize = () => {
      const bounds = host.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      columns = Math.ceil(width / cellWidth) + 2;
      rows = Math.ceil(height / cellHeight) + 1;
      cells = Array.from({ length: columns * rows }, () => ({
        character: randomCharacter(),
        color: Math.floor(Math.random() * colors.length),
        opacity: 0.09 + Math.random() * 0.11,
      }));
      context.clearRect(0, 0, width, height);
    };

    const pointFromEvent = (event) => {
      const bounds = host.getBoundingClientRect();
      pointer = {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
        active: event.clientX >= bounds.left && event.clientX <= bounds.right
          && event.clientY >= bounds.top && event.clientY <= bounds.bottom,
      };
    };

    const onPointerMove = (event) => pointFromEvent(event);
    const onPointerLeave = () => { pointer.active = false; };
    const onPointerDown = (event) => {
      const bounds = host.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;
      if (x < 0 || y < 0 || x > bounds.width || y > bounds.height) return;
      pointer = { x, y, active: true };
      if (clickEffect === 'tear') tear = { x, y, startedAt: performance.now() };
    };

    const draw = (timestamp) => {
      if (disposed) return;
      frame = window.requestAnimationFrame(draw);
      const updateInterval = reduceMotion ? 1000 : Math.max(26, 86 / rate);
      const shouldUpdateCells = timestamp - lastUpdate >= updateInterval;
      if (shouldUpdateCells) lastUpdate = timestamp;
      if (reduceMotion && !shouldUpdateCells) return;

      const elapsed = Math.min(80, timestamp - (lastPaint || timestamp));
      lastPaint = timestamp;
      if (!reduceMotion) offset = (offset + elapsed * drift * 0.018 * rate) % cellWidth;

      context.clearRect(0, 0, width, height);
      context.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      context.textBaseline = 'middle';

      const radius = Math.min(190, Math.max(120, width * 0.19));
      const tearAge = tear ? timestamp - tear.startedAt : Infinity;
      const tearStrength = tear && tearAge < 560 ? 1 - tearAge / 560 : 0;
      if (!tearStrength) tear = null;

      const isLightTheme = document.documentElement.dataset.theme === 'light';
      const drawColors = isLightTheme ? LIGHT_THEME_COLORS : colors;

      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const cell = cells[row * columns + column];
          if (!cell) continue;

          if (shouldUpdateCells && !reduceMotion && Math.random() < amount * 0.018 * rate) {
            cell.character = randomCharacter();
            cell.color = Math.floor(Math.random() * colors.length);
          }

          const rowFlow = (row % 2 === 0 ? 1 : -1) * offset;
          let x = column * cellWidth + rowFlow;
          if (x < -cellWidth) x += width + cellWidth;
          if (x > width) x -= width + cellWidth;
          const y = row * cellHeight + cellHeight / 2;

          let proximity = 0;
          if (pointer.active) {
            const distance = Math.hypot(x - pointer.x, y - pointer.y);
            proximity = Math.pow(Math.max(0, 1 - distance / radius), 1.7);
          }

          let alpha = cell.opacity + proximity * 0.62;
          let colorIndex = cell.color;
          if (proximity > 0.24) colorIndex = (column + row + Math.floor(timestamp / 120)) % colors.length;

          let drawX = x;
          let drawY = y;
          if (tearStrength && Math.abs(y - tear.y) < 25) {
            const band = 1 - Math.abs(y - tear.y) / 25;
            drawX += Math.sin((x / Math.max(1, width)) * Math.PI * 5 + tearAge * 0.025)
              * 22 * tearStrength * band;
            alpha = Math.min(1, alpha + tearStrength * band * 0.5);
            colorIndex = (colorIndex + 1) % colors.length;
          }

          context.fillStyle = drawColors[colorIndex % drawColors.length];
          context.globalAlpha = clamp(alpha, 0, 0.88);
          context.fillText(cell.character, drawX, drawY);
        }
      }

      context.globalAlpha = 1;
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('blur', onPointerLeave);
    frame = window.requestAnimationFrame(draw);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('blur', onPointerLeave);
    };
  }, [glitchColors, glitchAmount, speed, flow, clickEffect]);

  return <canvas ref={canvasRef} className="letter-glitch-canvas" aria-hidden="true" />;
}

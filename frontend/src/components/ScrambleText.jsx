import { useCallback, useEffect, useRef, useState } from 'react';

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+-/<>[]{}';

function randomGlyph() {
  return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
}

export default function ScrambleText({ text, className = '' }) {
  const [display, setDisplay] = useState(text);
  const timer = useRef(null);

  const runScramble = useCallback(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    window.clearInterval(timer.current);
    const characters = Array.from(text);
    let revealed = 0;

    // Scramble the complete string at once; do not treat words independently.
    setDisplay(characters.map(() => randomGlyph()).join(''));

    timer.current = window.setInterval(() => {
      revealed = Math.min(revealed + 1, characters.length);
      setDisplay(characters.map((character, index) => (
        index < revealed ? character : randomGlyph()
      )).join(''));

      if (revealed >= characters.length) {
        window.clearInterval(timer.current);
        timer.current = null;
        setDisplay(text);
      }
    }, 25);
  }, [text]);

  useEffect(() => {
    setDisplay(text);
    return () => window.clearInterval(timer.current);
  }, [text]);

  return (
    <span className={className} aria-label={text} onMouseEnter={runScramble}>
      <span aria-hidden="true">{display}</span>
    </span>
  );
}

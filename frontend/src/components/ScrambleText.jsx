import { useCallback, useEffect, useRef, useState } from 'react';

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+-';

export default function ScrambleText({ text, className = '' }) {
  const [display, setDisplay] = useState(text);
  const timer = useRef(null);

  const runScramble = useCallback(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    window.clearInterval(timer.current);
    let progress = 0;
    const characters = Array.from(text);
    setDisplay(characters.map((character) => (
      character === ' ' ? ' ' : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
    )).join(''));

    timer.current = window.setInterval(() => {
      progress += 1;
      setDisplay(characters.map((character, index) => {
        if (character === ' ' || index < progress) return character;
        return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }).join(''));

      if (progress >= characters.length) {
        window.clearInterval(timer.current);
        timer.current = null;
        setDisplay(text);
      }
    }, 24);
  }, [text]);

  useEffect(() => {
    setDisplay(text);
    return () => window.clearInterval(timer.current);
  }, [text]);

  return (
    <span className={className} aria-label={text} onMouseEnter={runScramble} onFocus={runScramble}>
      <span aria-hidden="true">{display}</span>
    </span>
  );
}

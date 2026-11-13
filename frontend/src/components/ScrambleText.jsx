import { useCallback, useEffect, useRef, useState } from 'react';

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+-/<>[]{}';

function randomGlyph() {
  return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
}

// `stable` reserves the final text's exact size (useful for wrapping, sentence-case
// labels such as card titles) and draws the scrambling glyphs on top, so the
// layout never jumps while the characters change.
export default function ScrambleText({ text, className = '', stable = false }) {
  const [display, setDisplay] = useState(text);
  const timer = useRef(null);
  const textRef = useRef(null);

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

  // Trigger from the whole enclosing link/button, not just the text glyphs.
  useEffect(() => {
    const control = textRef.current?.closest('a, button, [role="button"]');
    if (!control) return undefined;

    const handlePointerEnter = () => runScramble();
    const handleFocus = () => runScramble();
    control.addEventListener('pointerenter', handlePointerEnter);
    control.addEventListener('focus', handleFocus, true);

    return () => {
      control.removeEventListener('pointerenter', handlePointerEnter);
      control.removeEventListener('focus', handleFocus, true);
    };
  }, [runScramble]);

  if (stable) {
    return (
      <span ref={textRef} className={`scramble-stable ${className}`.trim()} aria-label={text}>
        <span className="scramble-stable-size" aria-hidden="true">{text}</span>
        <span className="scramble-stable-live" aria-hidden="true">{display}</span>
      </span>
    );
  }

  return (
    <span ref={textRef} className={className} aria-label={text}>
      <span aria-hidden="true">{display}</span>
    </span>
  );
}

export function scrollToTop(event) {
  event?.preventDefault?.();

  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const behavior = prefersReducedMotion ? 'auto' : 'smooth';

  if (typeof window.scrollTo === 'function') {
    try {
      window.scrollTo({ top: 0, left: 0, behavior });
      return;
    } catch {
      window.scrollTo(0, 0);
      return;
    }
  }

  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

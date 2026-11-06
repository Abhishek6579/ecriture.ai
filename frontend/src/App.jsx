import { Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Home from './pages/Home.jsx';
import Recognize from './pages/Recognize.jsx';
import Architecture from './pages/Architecture.jsx';
import PointerSpotlight from './components/PointerSpotlight.jsx';


function ScrollRevealObserver() {
  const location = useLocation();

  useEffect(() => {
    const elements = [...document.querySelectorAll('.scroll-reveal')];
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || !('IntersectionObserver' in window)) {
      elements.forEach((element) => element.classList.add('is-visible'));
      return undefined;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -4% 0px' });

    elements.forEach((element, index) => {
      element.style.setProperty('--reveal-delay', `${(index % 3) * 70}ms`);
      observer.observe(element);
    });

    return () => observer.disconnect();
  }, [location.pathname]);

  return null;
}


function App() {
  const location = useLocation();

  return (
    <>
      {location.pathname !== '/' && <PointerSpotlight />}
      <ScrollRevealObserver />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/recognize" element={<Recognize />} />
        <Route path="/recognition" element={<Recognize />} />
        <Route path="/architecture" element={<Architecture />} />
        <Route path="/process" element={<Architecture />} />
      </Routes>
    </>
  );
}

export default App;

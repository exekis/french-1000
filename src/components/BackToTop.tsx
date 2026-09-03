import { useEffect, useState } from 'react';

// the way back up only earns its place once the masthead is well out of view. a rank
// jump scrolls the page too, so the same listener covers the random word button
const REVEAL_AFTER = 640;

function backToTop() {
  // no behavior passed on purpose so the css scroll-behavior rule decides, which is
  // what makes this jump instantly under reduced motion
  window.scrollTo({ top: 0, left: 0 });
}

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function sync() {
      setVisible(window.scrollY > REVEAL_AFTER);
    }

    sync();
    window.addEventListener('scroll', sync, { passive: true });
    return () => window.removeEventListener('scroll', sync);
  }, []);

  return (
    <button
      type="button"
      className={visible ? 'back-to-top is-visible' : 'back-to-top'}
      onClick={backToTop}
      title="Back to top"
      aria-label="Back to top"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 19.5V5.5" />
        <path d="M5 12.5 12 5.5l7 7" />
      </svg>
    </button>
  );
}

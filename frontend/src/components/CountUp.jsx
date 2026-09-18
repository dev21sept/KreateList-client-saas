import React, { useEffect, useRef, useState } from 'react';
import { useInView } from 'framer-motion';

/**
 * Lightweight scroll-triggered count-up. Purely presentational — animates a
 * numeric display from 0 to `value` or `end` once it enters the viewport. Renders the
 * final value immediately (no animation) when `disabled` is true, e.g. for
 * prefers-reduced-motion users.
 */
const CountUp = ({ value, end, suffix = '', decimals = 0, duration = 1.2, disabled = false }) => {
  const target = Number(value ?? end ?? 0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-40px' });
  const [display, setDisplay] = useState(disabled ? target : 0);

  useEffect(() => {
    if (disabled) {
      setDisplay(target);
      return;
    }
    if (!isInView) return;

    let raf;
    const start = performance.now();
    const animate = (now) => {
      const progress = Math.min((now - start) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(target * eased);
      if (progress < 1) {
        raf = requestAnimationFrame(animate);
      } else {
        setDisplay(target);
      }
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [isInView, target, duration, disabled]);

  const num = typeof display === 'number' && !isNaN(display) ? display : 0;

  return (
    <span ref={ref}>
      {num.toFixed(decimals)}
      {suffix}
    </span>
  );
};

export default CountUp;

import React, { useEffect, useRef, useState } from 'react';
import { useInView } from 'framer-motion';

/**
 * Lightweight scroll-triggered count-up. Purely presentational — animates a
 * numeric display from 0 to `value` once it enters the viewport. Renders the
 * final value immediately (no animation) when `disabled` is true, e.g. for
 * prefers-reduced-motion users.
 */
const CountUp = ({ value, suffix = '', decimals = 0, duration = 1.2, disabled = false }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-40px' });
  const [display, setDisplay] = useState(disabled ? value : 0);

  useEffect(() => {
    if (disabled) {
      setDisplay(value);
      return;
    }
    if (!isInView) return;

    let raf;
    const start = performance.now();
    const animate = (now) => {
      const progress = Math.min((now - start) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(value * eased);
      if (progress < 1) {
        raf = requestAnimationFrame(animate);
      } else {
        setDisplay(value);
      }
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [isInView, value, duration, disabled]);

  return (
    <span ref={ref}>
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
};

export default CountUp;

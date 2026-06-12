import { useEffect, useState } from 'react';
import type { CountdownBannerProps } from './types';
import styles from './CountdownBanner.module.css';

export function CountdownBanner({ initialSeconds }: CountdownBannerProps) {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setInterval(() => {
      setSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

  return (
    <div
      role="timer"
      aria-live="polite"
      aria-label={`Event ending in ${timeStr}`}
      className={styles.banner}
    >
      Event ending in {timeStr}
    </div>
  );
}

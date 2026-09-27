import { useEffect, useState } from 'react';

type AnimatedSpriteProps = {
  /** Frame urls in play order. Falls back to `still` when empty or all broken. */
  frames: string[];
  /** Ordered fallback chain for the still image (file -> fallbacks -> inline). */
  still: string[];
  intervalMs?: number;
  /** False plays once and holds the last frame (attacks, victory, defeat). */
  loop?: boolean;
  alt: string;
};

/** One full 8-frame strip fits a 1400ms execution beat. */
export const FRAME_INTERVAL_MS = 160;

/**
 * Plays a hero frame strip. Frame errors skip that frame; a missing strip
 * degrades to the still chain, so animation can never blank the screen.
 * The parent passes a new `key` per animation so every cue restarts at frame 1.
 */
export const AnimatedSprite = ({ frames, still, intervalMs = FRAME_INTERVAL_MS, loop = true, alt }: AnimatedSpriteProps) => {
  const [index, setIndex] = useState(0);
  const [brokenFrames, setBrokenFrames] = useState<readonly string[]>([]);
  const [stillIndex, setStillIndex] = useState(0);

  const playable = frames.filter((src) => !brokenFrames.includes(src));
  const showingFrame = playable.length > 0;
  const src = showingFrame
    ? playable[index % playable.length]
    : (still[Math.min(stillIndex, still.length - 1)] ?? '');

  useEffect(() => {
    if (playable.length <= 1) return undefined;
    const id = window.setInterval(() => {
      setIndex((current) => {
        if (!loop && current >= playable.length - 1) {
          window.clearInterval(id);
          return current;
        }
        return current + 1;
      });
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [playable.length, intervalMs, loop]);

  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      onError={() => {
        if (showingFrame) {
          const bad = playable[index % playable.length];
          setBrokenFrames((prev) => (prev.includes(bad) ? prev : [...prev, bad]));
        } else {
          setStillIndex((current) => current + 1);
        }
      }}
    />
  );
};

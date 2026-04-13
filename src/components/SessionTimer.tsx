import { useEffect, useState, useRef } from "react";
import { ClockIcon } from "@heroicons/react/24/outline";

interface SessionTimerProps {
  durationMinutes: number;
  onExpire: () => void;
}

const STORAGE_KEY_PREFIX = "sessionFinishTime_";

export const SessionTimer: React.FC<SessionTimerProps> = ({
  durationMinutes,
  onExpire,
}) => {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const onExpireRef = useRef(onExpire);
  const hasExpiredRef = useRef(false);

  // Keep onExpire ref up to date without restarting the timer
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (!durationMinutes || durationMinutes <= 0) return;

    // Use sessionId from localStorage to namespace the finish time
    const sessionId = localStorage.getItem("sessionId") || "unknown";
    const storageKey = STORAGE_KEY_PREFIX + sessionId;

    // Set finishTime on first mount, reuse if already set (e.g. page refresh)
    let finishTime: number;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      finishTime = parseInt(stored, 10);
    } else {
      finishTime = Date.now() + durationMinutes * 60 * 1000;
      localStorage.setItem(storageKey, String(finishTime));
    }

    const tick = () => {
      const remaining = Math.floor((finishTime - Date.now()) / 1000);
      if (remaining <= 0) {
        setSecondsLeft(0);
        if (!hasExpiredRef.current) {
          hasExpiredRef.current = true;
          localStorage.removeItem(storageKey);
          onExpireRef.current();
        }
      } else {
        setSecondsLeft(remaining);
      }
    };

    tick(); // run immediately
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [durationMinutes]);

  if (secondsLeft === null) return null;

  const hours = Math.floor(secondsLeft / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);
  const seconds = secondsLeft % 60;

  const isWarning = secondsLeft <= 60;
  const isCritical = secondsLeft <= 0;

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-mono font-medium ${
        isCritical
          ? "bg-red-100 text-red-700 border border-red-300"
          : isWarning
          ? "bg-orange-100 text-orange-700 border border-orange-300 animate-pulse"
          : "bg-gray-100 text-gray-700 border border-gray-300"
      }`}
    >
      <ClockIcon className="w-4 h-4 flex-shrink-0" />
      <span>
        {hours > 0
          ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
          : `${pad(minutes)}:${pad(seconds)}`}
      </span>
    </div>
  );
};
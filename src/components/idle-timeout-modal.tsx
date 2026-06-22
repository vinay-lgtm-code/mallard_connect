"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getDemoUser, clearDemoUser } from "@/hooks/useAuth";

const IDLE_LIMIT_MS = 4 * 60 * 1000; // 4 min before warning
const COUNTDOWN_SECONDS = 60;
const TIMEOUT_LIMIT_MS = IDLE_LIMIT_MS + COUNTDOWN_SECONDS * 1000;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"] as const;

export function IdleTimeoutModal() {
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);
  const [showWarning, setShowWarning] = useState(false);
  const showWarningRef = useRef(false);
  const lastActivityAtRef = useRef(Date.now());
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (idleTimer.current) {
      clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current);
      countdownTimer.current = null;
    }
  }, []);

  const signOut = useCallback(async () => {
    clearTimers();
    if (getDemoUser()) {
      clearDemoUser();
    } else {
      const supabase = createClient();
      await supabase.auth.signOut();
    }
    router.push("/login");
  }, [clearTimers, router]);

  const getMsUntilTimeout = useCallback(() => {
    return lastActivityAtRef.current + TIMEOUT_LIMIT_MS - Date.now();
  }, []);

  const updateCountdown = useCallback(() => {
    const msUntilTimeout = getMsUntilTimeout();
    if (msUntilTimeout <= 0) {
      void signOut();
      return false;
    }
    setSecondsLeft(Math.ceil(msUntilTimeout / 1000));
    return true;
  }, [getMsUntilTimeout, signOut]);

  const startCountdown = useCallback(() => {
    if (!updateCountdown()) return;

    setShowWarning(true);
    showWarningRef.current = true;

    if (!countdownTimer.current) {
      countdownTimer.current = setInterval(updateCountdown, 1000);
    }
  }, [updateCountdown]);

  const resetIdleTimer = useCallback(() => {
    if (getMsUntilTimeout() <= 0) {
      void signOut();
      return;
    }
    if (showWarningRef.current) return;
    clearTimers();
    lastActivityAtRef.current = Date.now();
    idleTimer.current = setTimeout(startCountdown, IDLE_LIMIT_MS);
  }, [clearTimers, getMsUntilTimeout, signOut, startCountdown]);

  const syncTimeoutState = useCallback(() => {
    if (!showWarningRef.current && Date.now() - lastActivityAtRef.current < IDLE_LIMIT_MS) return;

    if (getMsUntilTimeout() <= 0) {
      void signOut();
      return;
    }

    startCountdown();
  }, [getMsUntilTimeout, signOut, startCountdown]);

  const handleStaySignedIn = useCallback(() => {
    if (getMsUntilTimeout() <= 0) {
      void signOut();
      return;
    }

    clearTimers();
    setShowWarning(false);
    showWarningRef.current = false;
    setSecondsLeft(COUNTDOWN_SECONDS);
    lastActivityAtRef.current = Date.now();
    idleTimer.current = setTimeout(startCountdown, IDLE_LIMIT_MS);
  }, [clearTimers, getMsUntilTimeout, signOut, startCountdown]);

  useEffect(() => {
    idleTimer.current = setTimeout(startCountdown, IDLE_LIMIT_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncTimeoutState();
      }
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, resetIdleTimer, { passive: true });
    }
    window.addEventListener("focus", syncTimeoutState);
    window.addEventListener("pageshow", syncTimeoutState);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearTimers();
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, resetIdleTimer);
      }
      window.removeEventListener("focus", syncTimeoutState);
      window.removeEventListener("pageshow", syncTimeoutState);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [startCountdown, resetIdleTimer, syncTimeoutState, clearTimers]);

  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" role="alertdialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative bg-white rounded-[12px] shadow-xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="px-6 pt-6 pb-2 text-center">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-amber-600">
              <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 14a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm1-4a1 1 0 0 1-2 0V8a1 1 0 0 1 2 0v4Z" fill="currentColor" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Still there?</h2>
          <p className="text-sm text-gray-500 mb-1">
            You will be logged out due to inactivity.
          </p>
          <p className="text-2xl font-bold text-gray-900 tabular-nums py-3">
            {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
          </p>
        </div>
        <div className="px-6 pb-6 flex flex-col gap-2">
          <button
            onClick={handleStaySignedIn}
            className="w-full py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Stay signed in
          </button>
          <button
            onClick={signOut}
            className="w-full py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Log out now
          </button>
        </div>
      </div>
    </div>
  );
}

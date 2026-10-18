import { useEffect, useRef } from "react";
import { isTurnstileEnabled, turnstileSiteKey } from "../config/turnstile";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback": () => void;
          "error-callback": () => void;
          "response-field": boolean;
          theme: string;
          language: string;
        }
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

interface TurnstileWidgetProps {
  onTokenChange: (token: string) => void;
}

export const TurnstileWidget = ({ onTokenChange }: TurnstileWidgetProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isTurnstileEnabled || !turnstileSiteKey) {
      return;
    }

    let widgetId: string | undefined;
    let intervalId: number | undefined;

    const renderWidget = () => {
      if (!containerRef.current || !window.turnstile || widgetId) {
        return;
      }

      widgetId = window.turnstile.render(containerRef.current, {
        sitekey: turnstileSiteKey,
        callback: onTokenChange,
        "expired-callback": () => onTokenChange(""),
        "error-callback": () => onTokenChange(""),
        "response-field": false,
        theme: "light",
        language: "en",
      });
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };

    renderWidget();
    if (!widgetId) {
      intervalId = window.setInterval(renderWidget, 100);
    }

    return () => {
      if (intervalId) {
        window.clearInterval(intervalId);
      }
      if (widgetId) {
        window.turnstile?.remove(widgetId);
      }
    };
  }, [onTokenChange]);

  if (!isTurnstileEnabled) {
    return null;
  }

  if (!turnstileSiteKey) {
    return (
      <p role="alert" className="text-center text-sm text-red-600">
        Verification is temporarily unavailable. Please try again later.
      </p>
    );
  }

  return <div ref={containerRef} className="flex justify-center"></div>;
};

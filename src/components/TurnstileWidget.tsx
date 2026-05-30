import { useEffect, useRef } from "react";

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
          theme: "light";
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
    let widgetId: string | undefined;
    let intervalId: number | undefined;

    const renderWidget = () => {
      if (!containerRef.current || !window.turnstile || widgetId) {
        return;
      }

      widgetId = window.turnstile.render(containerRef.current, {
        sitekey: import.meta.env.VITE_CLOUDFLARE_SITE_KEY,
        callback: onTokenChange,
        "expired-callback": () => onTokenChange(""),
        "error-callback": () => onTokenChange(""),
        "response-field": false,
        theme: "light",
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

  return <div ref={containerRef}></div>;
};

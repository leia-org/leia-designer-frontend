import { useEffect, useRef } from "react";
import { Box } from "@mui/material";
import { turnstileSiteKey } from "../config/turnstile";

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
    let widgetId: string | undefined;
    let intervalId: number | undefined;

    const renderWidget = () => {
      if (!containerRef.current || !window.turnstile || widgetId || !turnstileSiteKey) {
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

  return <Box ref={containerRef} sx={{ display: "flex", justifyContent: "center" }} />;
};

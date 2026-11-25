import React, { useCallback, useLayoutEffect, useRef } from "react";
import { Box } from "@mui/material";
import type { PlaceholderItem } from "../lib/behaviourPlaceholders";
import { PlaceholderAutocompletePopper } from "./PlaceholderAutocompletePopper";
import { usePlaceholderAutocomplete } from "../hooks/usePlaceholderAutocomplete";

export type HighlightableInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement>,
  "className" | "color"
> & Pick<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "rows" | "wrap"> & {
  multiline?: boolean;
  autoResize?: boolean;
  autocompleteItems?: readonly PlaceholderItem[];
  onValueChange?: (value: string) => void;
};

const highlightTokenSx = { borderRadius: 0.5, bgcolor: "#F3E8FF", color: "#7E22CE" };
const highlightableTextSx = {
  boxSizing: "border-box",
  px: 1.5,
  py: 1,
  font: "inherit",
  lineHeight: 1.5,
  letterSpacing: "inherit",
} as const;

export const HighlightableInput: React.FC<HighlightableInputProps> = ({
  value,
  placeholder,
  multiline = false,
  autoResize = false,
  autocompleteItems,
  onValueChange,
  onScroll,
  onChange,
  onKeyDown,
  onKeyUp,
  onClick,
  onBlur,
  ...rest
}) => {
  const text = Array.isArray(value) ? value.join(", ") : String(value ?? "");
  const controlRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const lastWidthRef = useRef<number | null>(null);
  const whiteSpace = multiline && rest.wrap !== "off" ? "pre-wrap" : "pre";
  const autocomplete = usePlaceholderAutocomplete({
    text,
    items: autocompleteItems,
    controlRef,
    onValueChange,
  });

  const adjustHeight = useCallback(() => {
    const control = controlRef.current;
    if (!multiline || !autoResize || !control) return;
    control.style.height = "auto";
    if (control.scrollHeight > 0) {
      control.style.height = `${control.scrollHeight}px`;
    } else {
      control.style.height = "";
    }
  }, [autoResize, multiline]);

  const syncOverlay = useCallback(() => {
    const control = controlRef.current;
    if (!control || !overlayRef.current || !contentRef.current) return;
    const { borderLeftWidth: left, borderTopWidth: top } = getComputedStyle(control);
    Object.assign(overlayRef.current.style, {
      left, top, width: `${control.clientWidth}px`, height: `${control.clientHeight}px`,
    });
    contentRef.current.style.transform = `translate(${-control.scrollLeft}px, ${-control.scrollTop}px)`;
  }, []);

  useLayoutEffect(() => {
    adjustHeight();
    syncOverlay();
  }, [adjustHeight, syncOverlay, text]);

  useLayoutEffect(() => {
    const observer = new ResizeObserver(() => {
      const control = controlRef.current;
      if (control && lastWidthRef.current !== control.clientWidth) {
        lastWidthRef.current = control.clientWidth;
        adjustHeight();
      }
      syncOverlay();
    });
    if (controlRef.current) {
      lastWidthRef.current = controlRef.current.clientWidth;
      observer.observe(controlRef.current);
    }
    return () => observer.disconnect();
  }, [adjustHeight, syncOverlay]);

  const renderHighlightedText = (segment: string, keyPrefix: string) =>
    segment.split(/(\{\{[^}]+\}\})/g).map((part, index) => (
      <Box component="span" key={`${keyPrefix}-${index}`} sx={index % 2 ? highlightTokenSx : undefined}>
        {part}
      </Box>
    ));

  return (
    <Box sx={{ position: "relative", width: "100%" }}>
      <Box
        component={multiline ? "textarea" : "input"}
        {...rest}
        ref={controlRef}
        value={text}
        placeholder={placeholder}
        onChange={(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
          onChange?.(event);
          autocomplete.updateFromControl(event.target.value, event.target.selectionStart);
        }}
        onKeyDown={(event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
          if (autocomplete.handleKeyDown(event)) return;
          onKeyDown?.(event);
        }}
        onKeyUp={(event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
          onKeyUp?.(event);
          if (
            event.key !== "ArrowDown" &&
            event.key !== "ArrowUp" &&
            event.key !== "Enter" &&
            event.key !== "Tab" &&
            event.key !== "Escape"
          ) {
            autocomplete.updateFromControl(
              event.currentTarget.value,
              event.currentTarget.selectionStart,
            );
          }
        }}
        onClick={(event: React.MouseEvent<HTMLInputElement | HTMLTextAreaElement>) => {
          onClick?.(event);
          autocomplete.updateFromControl(
            event.currentTarget.value,
            event.currentTarget.selectionStart,
          );
        }}
        onBlur={(event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
          onBlur?.(event);
          autocomplete.close();
        }}
        onScroll={(event: React.UIEvent<HTMLInputElement | HTMLTextAreaElement>) => {
          syncOverlay();
          onScroll?.(event);
        }}
        sx={{
          ...highlightableTextSx,
          width: "100%",
          display: "block",
          border: 1,
          borderColor: "divider",
          borderRadius: 1,
          bgcolor: "transparent",
          color: "transparent",
          caretColor: (theme) => theme.palette.text.primary,
          position: "relative",
          zIndex: 1,
          resize: multiline ? "vertical" : "none",
          whiteSpace,
          overflowWrap: "break-word",
          "&::placeholder": { color: "transparent" },
          "&::selection": { color: "HighlightText", backgroundColor: "Highlight" },
          "&:focus": {
            outline: "none",
            borderColor: "primary.main",
            boxShadow: "0 0 0 2px rgba(37, 99, 235, 0.16)",
          },
        }}
      />
      <Box ref={overlayRef} aria-hidden="true" sx={{
        position: "absolute", overflow: "hidden", pointerEvents: "none", borderRadius: 1,
      }}>
        <Box ref={contentRef} sx={{
          ...highlightableTextSx, whiteSpace, overflowWrap: "break-word", color: "text.primary",
        }}>
          {text ? (
            autocomplete.trigger ? (
              <>
                {renderHighlightedText(text.slice(0, autocomplete.trigger.start), "before")}
                <Box
                  component="span"
                  ref={autocomplete.caretMarkerRef}
                  sx={{ display: "inline-block", width: 0, height: "1.2em", verticalAlign: "text-bottom" }}
                />
                {renderHighlightedText(text.slice(autocomplete.trigger.start), "after")}
              </>
            ) : (
              renderHighlightedText(text, "full")
            )
          ) : (
            <Box component="span" sx={{ color: "text.disabled" }}>{placeholder}</Box>
          )}
          {multiline && text.endsWith("\n") && "\u200b"}
        </Box>
      </Box>
      <PlaceholderAutocompletePopper
        open={autocomplete.isOpen}
        anchorEl={autocomplete.caretAnchor}
        suggestions={autocomplete.suggestions}
        activeIndex={autocomplete.activeIndex}
        onSelect={autocomplete.selectSuggestion}
      />
    </Box>
  );
};

export const HighlightableTextarea: React.FC<HighlightableInputProps> = (props) => (
  <HighlightableInput {...props} multiline />
);

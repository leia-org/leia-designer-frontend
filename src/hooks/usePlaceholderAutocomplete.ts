import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PlaceholderItem } from "../lib/behaviourPlaceholders";

export interface AutocompleteTrigger {
  start: number;
  end: number;
  query: string;
}

export interface AutocompleteSuggestion {
  key: string;
  label: string;
  description: string;
  insertText: string;
  isComplete: boolean;
}

interface UsePlaceholderAutocompleteParams {
  text: string;
  items?: readonly PlaceholderItem[];
  controlRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  onValueChange?: (value: string) => void;
}

export const usePlaceholderAutocomplete = ({
  text,
  items,
  controlRef,
  onValueChange,
}: UsePlaceholderAutocompleteParams) => {
  const caretMarkerRef = useRef<HTMLSpanElement>(null);
  const [trigger, setTrigger] = useState<AutocompleteTrigger | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [caretAnchor, setCaretAnchor] = useState<HTMLSpanElement | null>(null);

  const suggestions = useMemo<AutocompleteSuggestion[]>(() => {
    if (!trigger || !items?.length) return [];

    const query = trigger.query;
    const lastDot = query.lastIndexOf(".");
    const completedPrefix = lastDot >= 0 ? query.slice(0, lastDot + 1) : "";
    const completedPrefixLower = completedPrefix.toLowerCase();
    const segmentQuery = (lastDot >= 0 ? query.slice(lastDot + 1) : query).toLowerCase();

    const groups = new Map<string, { label: string; insertText: string; count: number }>();
    const leaves: AutocompleteSuggestion[] = [];

    for (const item of items) {
      const inner = item.token.replace(/^\{\{|\}\}$/g, "");
      if (!inner.toLowerCase().startsWith(completedPrefixLower)) continue;

      const remainder = inner.slice(completedPrefix.length);
      const nextDot = remainder.indexOf(".");

      if (nextDot >= 0) {
        const segment = remainder.slice(0, nextDot);
        if (segmentQuery && !segment.toLowerCase().includes(segmentQuery)) continue;

        const insertText = `{{${inner.slice(0, completedPrefix.length + nextDot + 1)}`;
        const existing = groups.get(insertText);
        if (existing) {
          existing.count += 1;
        } else {
          groups.set(insertText, { label: segment, insertText, count: 1 });
        }
      } else {
        if (
          segmentQuery &&
          !remainder.toLowerCase().includes(segmentQuery) &&
          !item.description.toLowerCase().includes(segmentQuery)
        ) {
          continue;
        }
        leaves.push({
          key: item.token,
          label: remainder,
          description: item.description,
          insertText: item.token,
          isComplete: true,
        });
      }
    }

    const groupSuggestions: AutocompleteSuggestion[] = [...groups.values()].map((group) => ({
      key: group.insertText,
      label: group.label,
      description: `${group.count} ${group.count === 1 ? "option" : "options"}`,
      insertText: group.insertText,
      isComplete: false,
    }));

    return [...groupSuggestions, ...leaves];
  }, [items, trigger]);

  const isOpen = Boolean(trigger && suggestions.length > 0);

  useLayoutEffect(() => {
    setCaretAnchor(isOpen ? caretMarkerRef.current : null);
  }, [isOpen, trigger?.start, text]);

  const updateFromControl = useCallback(
    (nextText: string, cursorPos: number | null) => {
      if (!items?.length || cursorPos === null) {
        setTrigger(null);
        return;
      }
      const beforeCursor = nextText.slice(0, cursorPos);
      const match = beforeCursor.match(/\{\{([a-zA-Z0-9_.]*)$/);
      if (!match) {
        setTrigger(null);
        return;
      }
      setTrigger({ start: cursorPos - match[0].length, end: cursorPos, query: match[1] });
      setActiveIndex(0);
    },
    [items],
  );

  const selectSuggestion = useCallback(
    (suggestion: AutocompleteSuggestion) => {
      if (!trigger) return;
      const afterCursor = text.slice(trigger.end);
      const replaceEnd =
        suggestion.isComplete && afterCursor.startsWith("}}")
          ? trigger.end + 2
          : trigger.end;
      const nextValue =
        text.slice(0, trigger.start) + suggestion.insertText + text.slice(replaceEnd);
      const nextCursor = trigger.start + suggestion.insertText.length;

      const nextTrigger = suggestion.isComplete
        ? null
        : {
            start: trigger.start,
            end: nextCursor,
            query: suggestion.insertText.slice(2),
          };
      setTrigger(nextTrigger);
      setActiveIndex(0);

      const control = controlRef.current;
      if (control) {
        control.focus();
        control.setSelectionRange?.(trigger.start, replaceEnd);
        if (
          typeof document.execCommand === "function" &&
          document.execCommand("insertText", false, suggestion.insertText)
        ) {
          return;
        }
      }

      onValueChange?.(nextValue);
      window.requestAnimationFrame(() => {
        const current = controlRef.current;
        if (!current) return;
        current.focus();
        current.setSelectionRange?.(nextCursor, nextCursor);
      });
    },
    [controlRef, onValueChange, text, trigger],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>): boolean => {
      if (!isOpen) return false;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((prev) => (prev + 1) % suggestions.length);
        return true;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        const chosen = suggestions[activeIndex] ?? suggestions[0];
        if (chosen) selectSuggestion(chosen);
        return true;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setTrigger(null);
        return true;
      }
      return false;
    },
    [activeIndex, isOpen, selectSuggestion, suggestions],
  );

  const close = useCallback(() => setTrigger(null), []);

  return {
    caretMarkerRef,
    caretAnchor,
    trigger,
    suggestions,
    activeIndex,
    isOpen,
    updateFromControl,
    selectSuggestion,
    handleKeyDown,
    close,
  };
};

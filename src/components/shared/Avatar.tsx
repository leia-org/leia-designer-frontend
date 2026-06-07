import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { buildAvatarCandidateSources } from "../../lib/avatar";

interface AvatarProps {
  src?: string | null;
  fallbackSrc?: string | null;
  alt: string;
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-12 w-12",
  lg: "h-16 w-16",
};

const textSizeClasses = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-lg",
};

const getInitials = (value: string): string => {
  const cleanValue = value
    .replace(/\bavatar\b/gi, "")
    .trim();

  if (!cleanValue) return "?";

  const parts = cleanValue
    .split(/[\s._-]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

export const Avatar: React.FC<AvatarProps> = ({
  src,
  fallbackSrc,
  alt,
  label,
  size = "md",
  className = "",
}) => {
  const candidateSources = useMemo(
    () => buildAvatarCandidateSources(src, fallbackSrc),
    [src, fallbackSrc],
  );
  const [currentSourceIndex, setCurrentSourceIndex] = useState(0);
  const resolvedSrc = candidateSources[currentSourceIndex] || "";
  const initials = getInitials(label || alt);

  useEffect(() => {
    setCurrentSourceIndex(0);
  }, [candidateSources]);

  return (
    <div
      className={`${sizeClasses[size]} ${className} shrink-0 overflow-hidden rounded-full border border-gray-200 bg-gray-100 flex items-center justify-center text-gray-600`}
      title={label || alt}
      aria-label={alt}
    >
      {resolvedSrc ? (
        <img
          src={resolvedSrc}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => {
            setCurrentSourceIndex((previousIndex) => {
              const nextIndex = previousIndex + 1;
              return nextIndex < candidateSources.length
                ? nextIndex
                : candidateSources.length;
            });
          }}
        />
      ) : (
        <span
          className={`${textSizeClasses[size]} font-semibold leading-none`}
          aria-hidden="true"
        >
          {initials}
        </span>
      )}
    </div>
  );
};

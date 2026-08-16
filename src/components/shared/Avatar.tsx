import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Avatar as MuiAvatar } from "@mui/material";
import { buildAvatarCandidateSources } from "../../lib/avatar";

interface AvatarProps {
  src?: string | null;
  fallbackSrc?: string | null;
  alt: string;
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeStyles = {
  sm: { dimension: 32, fontSize: 12 },
  md: { dimension: 48, fontSize: 14 },
  lg: { dimension: 64, fontSize: 18 },
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
  const { dimension, fontSize } = sizeStyles[size];

  useEffect(() => {
    setCurrentSourceIndex(0);
  }, [candidateSources]);

  const handleImageError = () => {
    setCurrentSourceIndex((previousIndex) => {
      const nextIndex = previousIndex + 1;
      return nextIndex < candidateSources.length
        ? nextIndex
        : candidateSources.length;
    });
  };

  return (
    <MuiAvatar
      className={className}
      src={resolvedSrc || undefined}
      alt={alt}
      title={label || alt}
      aria-label={alt}
      imgProps={{ loading: "lazy", onError: handleImageError }}
      sx={{
        width: dimension,
        height: dimension,
        flexShrink: 0,
        bgcolor: "grey.100",
        color: "text.secondary",
        border: 1,
        borderColor: "divider",
        fontSize,
        fontWeight: 600,
      }}
    >
      {initials}
    </MuiAvatar>
  );
};

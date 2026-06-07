export type AvatarEntityPathSegment = "leias" | "personas" | "problems";

const avatarPublicBaseUrl = (import.meta.env.VITE_AVATAR_PUBLIC_URL || "").replace(
  /\/+$/g,
  "",
);

export const buildOriginalAvatarPath = (
  entity: AvatarEntityPathSegment,
  id?: string | null,
): string => {
  const trimmedId = id?.trim();
  if (!trimmedId) {
    return "";
  }

  return `/images/${entity}/${trimmedId}/avatar/original.webp`;
};

export const resolveAvatarSrc = (value?: string | null): string => {
  const trimmedValue = typeof value === "string" ? value.trim() : "";
  if (!trimmedValue) return "";

  if (/^(https?:|data:image\/|blob:)/i.test(trimmedValue)) {
    return trimmedValue;
  }

  const normalizedValue = trimmedValue.replace(/^\/+/g, "");
  if (!normalizedValue.startsWith("images/")) {
    return "";
  }

  if (!avatarPublicBaseUrl) {
    return `/${normalizedValue}`;
  }

  return `${avatarPublicBaseUrl}/${normalizedValue}`;
};

export const buildAvatarCandidateSources = (
  primarySrc?: string | null,
  fallbackSrc?: string | null,
): string[] => {
  const candidates: string[] = [];

  const resolvedPrimary = resolveAvatarSrc(primarySrc);
  if (resolvedPrimary) {
    candidates.push(resolvedPrimary);
  }

  const resolvedFallback = resolveAvatarSrc(fallbackSrc);
  if (resolvedFallback && !candidates.includes(resolvedFallback)) {
    candidates.push(resolvedFallback);
  }

  return candidates;
};

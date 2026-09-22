const ALLOWED_PROCESSES = new Set(["requirements-elicitation", "game", "other"]);

export function normalizeProcess(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const unique = Array.from(new Set(
    value.filter((item): item is string => typeof item === "string" && ALLOWED_PROCESSES.has(item)),
  ));
  return unique.length > 1 ? unique.filter((item) => item !== "other") : unique;
}

export function normalizeProcessFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeProcessFields(item)) as T;
  }
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, child]) => [
      key,
      key === "process" ? normalizeProcess(child) : normalizeProcessFields(child),
    ]),
  ) as T;
}

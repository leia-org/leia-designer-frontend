import type { RubricDefinition, RubricSpec } from "../models/Rubric";

const splitCells = (line: string) => line.trim().replace(/^\||\|$/g, "")
  .split(/(?<!\\)\|/)
  .map((cell) => cell.trim().replace(/\\\|/g, "|").replace(/<br\s*\/?\s*>/gi, "\n"));

export function validateRubricSemantics(rubric: RubricDefinition): string | null {
  const total = rubric.spec.sections.reduce((sum, section) => sum + section.weight, 0);
  if (Math.abs(total - 100) > 0.001) return "Section weights must total 100%.";
  for (const section of rubric.spec.sections) {
    if (!section.title.trim() || section.levels.some((level) => !level.trim())) {
      return "Rubric text fields cannot be blank.";
    }
    const expected = new Set(section.levels);
    for (const criterion of section.criteria) {
      if (!criterion.name.trim() || criterion.descriptors.some((descriptor) => !descriptor.description.trim())) {
        return "Rubric text fields cannot be blank.";
      }
      const levels = criterion.descriptors.map((descriptor) => descriptor.level);
      if (levels.length !== expected.size || new Set(levels).size !== levels.length || levels.some((level) => !expected.has(level))) {
        return `Every criterion in “${section.title}” must contain exactly one descriptor for every level.`;
      }
    }
  }
  return null;
}

export function parseRubricMarkdown(markdown: string): { spec: RubricSpec | null; error: string | null } {
  const lines = markdown.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const rawSections: Array<{ title: string; explicitWeight: number | null; headers: string[]; rows: string[][] }> = [];
  let pendingHeading: { title: string; explicitWeight: number | null } | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    const heading = lines[index].match(/^#{2,6}\s+(.+?)\s*$/);
    if (heading) {
      if (pendingHeading) return { spec: null, error: "A rubric section does not contain a valid table." };
      const rawTitle = heading[1];
      const weightMatch = rawTitle.match(/\s*\[(-?\d+(?:[.,]\d+)?)%\]\s*$/);
      pendingHeading = {
        title: (weightMatch ? rawTitle.slice(0, weightMatch.index) : rawTitle).trim() || `Section ${rawSections.length + 1}`,
        explicitWeight: weightMatch ? Number(weightMatch[1].replace(",", ".")) : null,
      };
      continue;
    }
    if (index + 2 >= lines.length || !lines[index].includes("|")) continue;
    const headers = splitCells(lines[index]);
    const separators = splitCells(lines[index + 1]);
    if (headers.length < 2 || separators.length !== headers.length || !separators.every((cell) => /^:?-{3,}:?$/.test(cell))) continue;
    const rows: string[][] = [];
    let lastRowIndex = index + 1;
    for (let rowIndex = index + 2; rowIndex < lines.length; rowIndex += 1) {
      const row = splitCells(lines[rowIndex]);
      if (!lines[rowIndex].includes("|") || row.length !== headers.length) break;
      rows.push(row); lastRowIndex = rowIndex;
    }
    if (!rows.length) continue;
    if (headers.some((cell) => !cell) || rows.some((row) => row.some((cell) => !cell))) return { spec: null, error: "Rubric headers and cells cannot be empty." };
    rawSections.push({
      title: pendingHeading?.title || (rawSections.length ? `Section ${rawSections.length + 1}` : "General"),
      explicitWeight: pendingHeading?.explicitWeight ?? null, headers, rows,
    });
    pendingHeading = null; index = lastRowIndex;
  }
  if (pendingHeading || !rawSections.length) return { spec: null, error: "The rubric does not contain a valid Markdown table for every section." };
  const explicit = rawSections.filter((section) => section.explicitWeight !== null);
  if (explicit.some((section) => (section.explicitWeight ?? 0) <= 0 || (section.explicitWeight ?? 0) > 100)) return { spec: null, error: "Section weights must be greater than 0% and at most 100%." };
  const explicitTotal = explicit.reduce((sum, section) => sum + (section.explicitWeight ?? 0), 0);
  const automaticCount = rawSections.length - explicit.length;
  if (explicitTotal > 100.001 || (automaticCount === 0 && Math.abs(explicitTotal - 100) > 0.001)) return { spec: null, error: "Explicit section weights must total 100%." };
  if (automaticCount > 0 && explicit.length > 0 && 100 - explicitTotal <= 0.001) return { spec: null, error: "Unweighted sections need a percentage remaining to distribute." };
  const automaticWeight = explicit.length === 0 ? 100 / rawSections.length : (100 - explicitTotal) / automaticCount;
  return {
    spec: { sections: rawSections.map((section) => ({
      title: section.title, weight: section.explicitWeight ?? automaticWeight,
      levels: section.headers.slice(1),
      criteria: section.rows.map((row) => ({
        name: row[0],
        descriptors: section.headers.slice(1).map((level, levelIndex) => ({ level, description: row[levelIndex + 1] })),
      })),
    })) },
    error: null,
  };
}

const escapeCell = (value: string) => value.replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
const formatWeight = (weight: number) => Number.isInteger(weight) ? String(weight) : String(Number(weight.toFixed(6)));

export function serializeRubricMarkdown(spec: RubricSpec): string {
  return spec.sections.map((section) => {
    const header = ["Criterion", ...section.levels].map(escapeCell);
    const rows = section.criteria.map((criterion) => {
      const byLevel = new Map(criterion.descriptors.map((descriptor) => [descriptor.level, descriptor.description]));
      return [criterion.name, ...section.levels.map((level) => byLevel.get(level) ?? "")].map(escapeCell);
    });
    return [`## ${section.title} [${formatWeight(section.weight)}%]`, `| ${header.join(" | ")} |`, `| ${header.map(() => "---").join(" | ")} |`, ...rows.map((row) => `| ${row.join(" | ")} |`)].join("\n");
  }).join("\n\n");
}

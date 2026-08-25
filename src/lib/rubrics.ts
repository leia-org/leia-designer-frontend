import api from "./axios";
import type { Rubric } from "../models/Rubric";

export interface ParsedRubricSection {
  title: string;
  headers: string[];
  rows: string[][];
  alignments: Array<"left" | "center" | "right">;
  explicitWeight: number | null;
  weight: number;
}

export interface ParsedRubric {
  sections: ParsedRubricSection[];
  weightingMode: "equal" | "mixed" | "explicit";
}

const splitCells = (line: string) =>
  line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());

export function parseRubricMarkdown(markdown: string): { rubric: ParsedRubric | null; error: string | null } {
  const lines = markdown.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const sections: Array<Omit<ParsedRubricSection, "weight">> = [];
  let pendingHeading: { title: string; explicitWeight: number | null } | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const heading = lines[index].match(/^#{2,6}\s+(.+?)\s*$/);
    if (heading) {
      if (pendingHeading) {
        return { rubric: null, error: "A rubric section does not contain a valid table." };
      }
      const rawTitle = heading[1];
      const weightMatch = rawTitle.match(/\s*\[(-?\d+(?:[.,]\d+)?)%\]\s*$/);
      pendingHeading = {
        title: (weightMatch ? rawTitle.slice(0, weightMatch.index) : rawTitle).trim() || `Section ${sections.length + 1}`,
        explicitWeight: weightMatch ? Number(weightMatch[1].replace(",", ".")) : null,
      };
      continue;
    }

    if (index + 2 >= lines.length || !lines[index].includes("|")) continue;
    const headers = splitCells(lines[index]);
    const separators = splitCells(lines[index + 1]);
    if (
      headers.length < 2 ||
      separators.length !== headers.length ||
      !separators.every((cell) => /^:?-{3,}:?$/.test(cell))
    ) {
      continue;
    }

    const rows: string[][] = [];
    let lastRowIndex = index + 1;
    for (let rowIndex = index + 2; rowIndex < lines.length; rowIndex += 1) {
      const row = splitCells(lines[rowIndex]);
      if (!lines[rowIndex].includes("|") || row.length !== headers.length) break;
      rows.push(row);
      lastRowIndex = rowIndex;
    }
    if (!rows.length) continue;

    sections.push({
      title: pendingHeading?.title || (sections.length ? `Section ${sections.length + 1}` : "General"),
      explicitWeight: pendingHeading?.explicitWeight ?? null,
      headers,
      rows,
      alignments: separators.map((separator) => {
        if (separator.startsWith(":") && separator.endsWith(":")) return "center";
        if (separator.endsWith(":")) return "right";
        return "left";
      }),
    });
    pendingHeading = null;
    index = lastRowIndex;
  }

  if (pendingHeading || !sections.length) {
    return { rubric: null, error: "The rubric does not contain a valid Markdown table for every section." };
  }

  const explicitSections = sections.filter((section) => section.explicitWeight !== null);
  const explicitTotal = explicitSections.reduce((total, section) => total + (section.explicitWeight ?? 0), 0);
  const automaticCount = sections.length - explicitSections.length;
  const automaticWeight = explicitSections.length === 0
    ? 100 / sections.length
    : (100 - explicitTotal) / automaticCount;
  const weightingMode = explicitSections.length === 0
    ? "equal"
    : automaticCount === 0 ? "explicit" : "mixed";

  return {
    rubric: {
      sections: sections.map((section) => ({
        ...section,
        weight: section.explicitWeight ?? automaticWeight,
      })),
      weightingMode,
    },
    error: null,
  };
}

export const getRubrics = async (): Promise<Rubric[]> => (
  await api.get<Rubric[]>("/api/v1/rubrics")
).data;

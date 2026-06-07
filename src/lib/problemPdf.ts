import { jsPDF } from "jspdf";

// Builds and downloads a student-facing "boletín" (problem statement sheet)
// from a problem spec. Intentionally excludes the solution / evaluation prompt
// (those are answers, not part of the statement).
interface ProblemLike {
  description?: unknown;
  personaBackground?: unknown;
  details?: unknown;
  initialSolution?: unknown;
  process?: unknown;
  [k: string]: unknown;
}

const asText = (v: unknown): string => (typeof v === "string" ? v : "");

export function downloadProblemPdf(spec: ProblemLike | undefined, title = "Problem"): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const heading = (text: string) => {
    ensureSpace(28);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text(text, margin, y);
    y += 18;
  };

  const paragraph = (text: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    const lines = doc.splitTextToSize(text, maxWidth) as string[];
    const lineHeight = 15;
    for (const line of lines) {
      ensureSpace(lineHeight);
      doc.text(line, margin, y);
      y += lineHeight;
    }
    y += 8;
  };

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text(doc.splitTextToSize(title, maxWidth) as string[], margin, y);
  y += 30;

  const s = spec || {};
  const processText = Array.isArray(s.process) ? (s.process as unknown[]).map(String).join(", ") : "";

  const sections: Array<[string, string]> = [
    ["Description", asText(s.description)],
    ["Context", asText(s.personaBackground)],
    ["Details", asText(s.details)],
    ["Process", processText],
    ["Starting point", asText(s.initialSolution)],
  ];

  let any = false;
  for (const [h, body] of sections) {
    if (!body || !body.trim()) continue;
    any = true;
    heading(h);
    paragraph(body);
  }
  if (!any) {
    paragraph("This problem has no statement content yet.");
  }

  const safe = (title || "problem").replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "") || "problem";
  doc.save(`${safe}-boletin.pdf`);
}

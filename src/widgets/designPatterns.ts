// Single source of truth for the 11 GoF patterns covered by the design-
// pattern exercises. Shared by catalog.tsx's widget-level pattern picker
// (sets scenarioSource.pattern — which code is served) and
// ResourceEditor.tsx's Problem-level picker (sets solution/solutionFormat/
// evaluationPrompt — what gets graded), so both stay in sync.
export const DESIGN_PATTERN_OPTIONS = [
  "adapter", "bridge", "builder", "composite", "decorator",
  "facade", "factory", "observer", "prototype", "state", "strategy",
];

// All 11 names are single words, so a simple capitalize matches the
// TFG's expected_result casing exactly ("State", "Observer", "Factory", ...).
export const capitalizePatternName = (pattern: string): string =>
  pattern.charAt(0).toUpperCase() + pattern.slice(1);

// Parses a Problem's spec.solution (e.g. '{"pattern": "State"}') back into the
// lowercase key used by DESIGN_PATTERN_OPTIONS, or undefined if it isn't a
// recognized pattern-marker solution (custom/non-pattern problems).
export const patternKeyFromSolution = (solution: unknown): string | undefined => {
  if (typeof solution !== "string") return undefined;
  try {
    const parsed = JSON.parse(solution);
    const name = typeof parsed?.pattern === "string" ? parsed.pattern.trim().toLowerCase() : undefined;
    return name && DESIGN_PATTERN_OPTIONS.includes(name) ? name : undefined;
  } catch {
    return undefined;
  }
};

// Generic, pattern-agnostic evaluation prompt reused verbatim for all 11
// patterns — it never names a specific pattern, it always refers to "the
// pattern named in the expected solution" (i.e. spec.solution), so the same
// text works for all of them.
export const DESIGN_PATTERN_EVALUATION_PROMPT = `This is a design-pattern identification and justification exercise. The "Expected solution" above names the GoF design pattern that experts consider the best fit for this code problem (e.g. {"pattern": "State"}) — it is not a full reference UML diagram, so do not penalize the student merely for using different class or attribute names than you might imagine.

Your job is to judge whether the student's UML diagram (given as Mermaid syntax in "Provided solution") correctly and canonically applies THAT SAME named pattern to the given problem — not just whether the pattern name appears anywhere in text.

Focus overwhelmingly on the STRUCTURE AND RELATIONSHIPS between the classes/interfaces the student drew, not on counting how many classes or attributes are present. Concretely:
- Does the diagram show the structural relationships that define this specific pattern (for example: an abstract type plus concrete subtypes connected by inheritance/realization, a context or client holding a reference to that abstract type via composition/association, delegation to the current object rather than embedded conditional logic — reason about this generically for whichever pattern is actually named above, the structure differs per pattern)?
- Would this structure actually solve the design problem described above (e.g. the nested if-else/switch-style issue) if implemented as drawn?
- Is the diagram internally consistent (relationships point the right direction, arrows/multiplicities make sense) rather than a loose collection of unconnected class boxes?

Do NOT evaluate with a checklist count of classes/attributes matching an assumed "ideal" diagram. A smaller, cleaner diagram that correctly captures the pattern's structure deserves a higher score than a larger one with more classes but a structurally wrong or missing relationship. Two diagrams using entirely different class names can both deserve a 10 if the underlying structure is right, and two diagrams using the exact expected class names can both deserve a low score if the relationships between them are wrong or missing (e.g. no inheritance link, or the context calling concrete states directly instead of through the abstract type).

If the student's diagram applies a different pattern than the one named in the expected solution, or shows no clear structural relationship at all (unconnected boxes, or a single class with no delegation), score it low and explain specifically which structural element is missing or wrong — be concrete enough that the student knows what to reconsider, without naming the correct pattern for them.`;

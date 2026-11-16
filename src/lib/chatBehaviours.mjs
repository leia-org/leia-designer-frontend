// Keep the same runtime references as Runner's dedicated behaviour generator.
export const CORE_BEHAVIOUR_REFERENCES = [
  "{{problem.details}}",
  "{{problem.description}}",
  "{{persona.personality}}",
  "{{persona.fullName}}",
  "{{persona.description}}",
  "{{problem.personaBackground}}",
  "{{problem.solution}}",
  "{{behaviour.role}}",
];

export function templateReferences(description) {
  return [...new Set(Array.from(
    (typeof description === "string" ? description : "").matchAll(/\{\{\s*([\w.]+)\s*\}\}/g),
    match => `{{${match[1]}}}`,
  ))];
}

export function missingBehaviourReferences(description, previousDescription) {
  const present = new Set(templateReferences(description));
  return [...new Set([
    ...CORE_BEHAVIOUR_REFERENCES,
    ...templateReferences(previousDescription),
  ])].filter(reference => !present.has(reference));
}

export function behaviourCandidates(saved, remembered) {
  const candidates = new Map(saved.filter(item => item.id).map(item => [item.id, item]));
  for (const item of remembered) {
    // Pending edits take precedence; otherwise keep the latest saved version.
    if (item.id && (item.edited || !candidates.has(item.id))) candidates.set(item.id, item);
  }
  return [...candidates.values()];
}

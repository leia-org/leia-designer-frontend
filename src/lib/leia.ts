import {
  flattenObject,
  isObject,
  getValueFromFlattenedKey,
  isProcessCompatible,
  applyExtensionFlattenedKey,
  applyOverrideFlattenedKey,
  replacePlaceholders,
} from './helper.js';

import type { Problem, Behaviour, Persona } from '../models/Leia.js';
import type { RubricSnapshot } from '../models/Rubric.js';

interface Leia {
  problem?: Problem;
  persona?: Persona;
  behaviour?: Behaviour;
  rubric?: RubricSnapshot | null;
}

const RUBRIC_PLACEHOLDER_PATTERN = /{{\s*rubric\.[\w.]+\s*}}/;

function containsRubricPlaceholder(value: unknown): boolean {
  if (typeof value === 'string') return RUBRIC_PLACEHOLDER_PATTERN.test(value);
  if (Array.isArray(value)) return value.some(containsRubricPlaceholder);
  if (isObject(value)) return Object.values(value as Record<string, unknown>).some(containsRubricPlaceholder);
  return false;
}

function escapeRubricCell(value: string): string {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function formatRubricWeight(weight: number): string {
  return Number.isInteger(weight) ? String(weight) : String(Number(weight.toFixed(6)));
}

function buildRubricPlaceholderView(rubric: RubricSnapshot) {
  const sections = rubric.spec?.sections || [];
  const markdown = sections
    .map((section) => {
      const header = ['Criterion', ...section.levels].map(escapeRubricCell);
      const rows = section.criteria.map((criterion) => {
        const byLevel = new Map(criterion.descriptors.map((d) => [d.level, d.description]));
        return [criterion.name, ...section.levels.map((level) => byLevel.get(level) ?? '')].map(escapeRubricCell);
      });
      return [
        `## ${section.title} [${formatRubricWeight(section.weight)}%]`,
        `| ${header.join(' | ')} |`,
        `| ${header.map(() => '---').join(' | ')} |`,
        ...rows.map((row) => `| ${row.join(' | ')} |`),
      ].join('\n');
    })
    .join('\n\n');
  const criteria = sections
    .map((section) => {
      const levels = section.levels.join(' -> ');
      const lines = section.criteria.map((criterion) => `- ${criterion.name}`);
      return [`${section.title} (${formatRubricWeight(section.weight)}%)${levels ? ` [Levels: ${levels}]` : ''}`, ...lines].join('\n');
    })
    .join('\n\n');
  return {
    name: rubric.metadata?.name || '',
    evaluationPrompt: rubric.spec?.evaluationPrompt || '',
    markdown,
    criteria,
    sections: JSON.stringify(sections),
  };
}

/**
 * Throws an error if problem constraints are not met.
 *
 * @param {Leia} leia The leia object to check, must have a problem field.
 * @returns {void}
 * @throws {Error} If constraints defined in the problem are not met.
 *
 */
export function checkConstraints(leia: Leia) {
  const constrainedTo = leia.problem?.spec?.constrainedTo;
  if (!constrainedTo) return;
  const flattenedConstraints = flattenObject(constrainedTo);
  if (!flattenedConstraints) return;

  // Check if constraints is an object
  if (typeof flattenedConstraints !== 'object' || Array.isArray(flattenedConstraints)) {
    const error = new Error('Constraints must be an object');
    throw error;
  }

  for (const [key, constraintValue] of Object.entries(flattenedConstraints)) {
    const leiaValue = getValueFromFlattenedKey(leia, key);
    if (!leiaValue) {
      const error = new Error(`Constraint not met: ${key}. Value does not exist.`);
      throw error;
    }
    if (key.split('.').at(-1) === 'process') {
      // Check compatibility (at least one process must be in common, intersection must not be empty)
      const isCompatible = isProcessCompatible(leiaValue, constraintValue as string | string[]);
      if (!isCompatible) {
        const error = new Error(
          `Constraint not met: ${key}. No compatible processes found. EXPECTED: ${constraintValue} GOT: ${leiaValue}`
        );
        throw error;
      }
    } else {
      // Check if value matches constraint
      if (leiaValue !== constraintValue) {
        const error = new Error(
          `Constraint not met: ${key}. Value does not match. EXPECTED: ${constraintValue} GOT: ${leiaValue}`
        );
        throw error;
      }
    }
  }
}

export function checkProcessOthers(leia: Leia) {
  const processes = [
    leia.behaviour?.spec?.process,
    leia.problem?.spec?.process,
  ];

  for (const process of processes) {
    if (Array.isArray(process) && process.includes('other') && process.length > 1) {
      throw new Error("When 'other' is selected in process, it must be the only value.");
    }
  }
}

/**
 * A LEIA has one activity process. The problem owns that choice and the
 * behaviour must expose the exact same process tags so the generated LEIA is
 * coherent regardless of the order in which its components were created.
 */
export function synchronizeProcessTypes(leia: Leia) {
  if (!leia.problem?.spec || !leia.behaviour?.spec) return leia;

  const sourceProcess = Array.isArray(leia.problem.spec.process)
    ? [...leia.problem.spec.process]
    : [];
  const problemSpec = leia.problem.spec as unknown as { process?: string[] };
  const behaviourSpec = leia.behaviour.spec as unknown as { process?: string[] };

  problemSpec.process = [...sourceProcess];
  behaviourSpec.process = [...sourceProcess];
  return leia;
}

export function resolveExtensions(leia: Leia) {
  const extensions = leia.problem?.spec?.extends;
  if (!extensions) return leia;
  const flattenedExtensions = flattenObject(extensions);
  if (!flattenedExtensions) return leia;

  // Check if extensions is an object
  if (!isObject(flattenedExtensions)) {
    const error = new Error('Extensions must be an object');
    throw error;
  }

  for (const [key, value] of Object.entries(flattenedExtensions)) {
    if (key.split('.').at(1) !== 'spec') {
      console.log(`Ignoring extension: ${key}. Extensions must be in the spec field.`);
      continue;
    }
    applyExtensionFlattenedKey(leia, key, value);
  }
  return leia;
}

export function resolveOverrides(leia: Leia) {
  const overrides = leia.problem?.spec?.overrides;
  if (!overrides) return leia;
  const flattenedOverrides = flattenObject(overrides);
  if (!flattenedOverrides) return leia;

  // Check if overrides is an object
  if (!isObject(flattenedOverrides)) {
    const error = new Error('Overrides must be an object');
    throw error;
  }

  for (const [key, value] of Object.entries(flattenedOverrides)) {
    if (key.split('.').at(1) !== 'spec') {
      console.log(`Ignoring override: ${key}. Overrides must be in the spec field.`);
      continue;
    }
    applyOverrideFlattenedKey(leia, key, value);
  }
  return leia;
}

export function resolvePlaceholders(leia: Leia) {
  const hasRubric = Boolean(leia.rubric?.spec);
  if (
    !hasRubric &&
    (containsRubricPlaceholder(leia.behaviour?.spec) || containsRubricPlaceholder(leia.problem?.spec))
  ) {
    throw new Error('Behaviour or problem references rubric placeholders, but no rubric is attached to this LEIA.');
  }

  const view: Record<string, unknown> = {
    problem: leia.problem?.spec,
    persona: leia.persona?.spec,
    behaviour: leia.behaviour?.spec,
    ...(hasRubric && leia.rubric ? { rubric: buildRubricPlaceholderView(leia.rubric) } : {}),
  };

  for (const entity of ['problem', 'persona'] as const) {
    const leiaEntitySpec = leia[entity]?.spec;
    if (!leiaEntitySpec) {
      console.log(`Ignoring: ${entity}. Entity not found.`);
      continue;
    }
    leia[entity]!.spec = replacePlaceholders(leiaEntitySpec, view);
    view[entity] = leia[entity]!.spec;
  }

  if (hasRubric && leia.rubric) {
    if (typeof leia.rubric.spec.evaluationPrompt === 'string' && leia.rubric.spec.evaluationPrompt) {
      leia.rubric.spec = {
        ...leia.rubric.spec,
        evaluationPrompt: replacePlaceholders(leia.rubric.spec.evaluationPrompt, view),
      };
    }
    view.rubric = buildRubricPlaceholderView(leia.rubric);
  }

  if (leia.behaviour?.spec) {
    leia.behaviour.spec = replacePlaceholders(leia.behaviour.spec, view);
    view.behaviour = leia.behaviour.spec;
  } else {
    console.log('Ignoring: behaviour. Entity not found.');
  }
  return leia;
}

export function generateLeia(persona: any, behaviour: any, problem: any, rubric?: RubricSnapshot | null) {
  const entities: Leia = {
    persona: structuredClone(persona),
    behaviour: structuredClone(behaviour),
    problem: structuredClone(problem),
    ...(rubric ? { rubric: structuredClone(rubric) } : {}),
  };

  synchronizeProcessTypes(entities);
  checkConstraints(entities);
  const extendedEntities = resolveExtensions(entities);
  const overriddenEntities = resolveOverrides(extendedEntities);
  synchronizeProcessTypes(overriddenEntities);
  const replacedEntities = resolvePlaceholders(overriddenEntities);
  synchronizeProcessTypes(replacedEntities);
  checkProcessOthers(replacedEntities);

  const leia = {
    spec: {
      persona: replacedEntities.persona,
      behaviour: replacedEntities.behaviour,
      problem: replacedEntities.problem,
      ...(replacedEntities.rubric ? { rubric: replacedEntities.rubric } : {}),
    },
  };

  return leia;
}

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

interface Leia {
  problem?: Problem;
  persona?: Persona;
  behaviour?: Behaviour;
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
  const replacementOrder = ['problem', 'persona', 'behaviour'] as const;

  // Create a view of the leia object with only the spec fields
  const view = Object.fromEntries(Object.entries(leia).map(([key, value]) => [key, value?.spec]));

  for (const entity of replacementOrder) {
    const leiaEntitySpec = leia[entity as keyof Leia]?.spec;

    if (!leiaEntitySpec) {
      console.log(`Ignoring: ${entity}. Entity not found.`);
      continue;
    }

    // Replace placeholders in the object
    leia[entity as keyof Leia]!.spec = replacePlaceholders(leiaEntitySpec, view);

    // Update the view
    view[entity] = leia[entity as keyof Leia]!.spec;
  }
  return leia;
}

export function generateLeia(persona: any, behaviour: any, problem: any) {
  const entities = { persona: structuredClone(persona), behaviour: structuredClone(behaviour), problem: structuredClone(problem) };

  checkConstraints(entities);
  const extendedEntities = resolveExtensions(entities);
  const overriddenEntities = resolveOverrides(extendedEntities);
  const replacedEntities = resolvePlaceholders(overriddenEntities);

  const leia = {
    spec: {
      persona: replacedEntities.persona,
      behaviour: replacedEntities.behaviour,
      problem: replacedEntities.problem,
    },
  };

  return leia;
}
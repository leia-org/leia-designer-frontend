import type { Leia } from '../models/Leia';

export type ImageTarget = 'leias' | 'problems' | 'personas' | 'infographic' | 'infographicSolution';
export type RegenerationTarget = ImageTarget | 'all';
export interface ImageJob {
  id: string;
  leiaId: string;
  target: RegenerationTarget;
  active: boolean;
  status: string;
  updatedAt: string;
  error?: string;
  steps: { target: ImageTarget; entityId: string; status: string; image?: string; error?: string }[];
}

// Apply only image fields. A shared persona/problem can be used by several LEIAs.
export function applyImageJob(leia: Leia, job: ImageJob): Leia {
  let result = leia;
  for (const step of job.steps) {
    if (step.status !== 'completed' || !step.image) continue;
    if (step.target === 'problems' || step.target === 'personas') {
      const key = step.target === 'problems' ? 'problem' : 'persona';
      const component = result.spec[key];
      if (component?.id === step.entityId && component.spec.avatar !== step.image) {
        result = { ...result, spec: { ...result.spec,
          [key]: { ...component, spec: { ...component.spec, avatar: step.image } } } };
      }
    } else if (result.id === step.entityId) {
      const key = step.target === 'leias' ? 'avatar' : step.target;
      if (result.spec[key] !== step.image) result = { ...result, spec: { ...result.spec, [key]: step.image } };
    }
  }
  return result;
}


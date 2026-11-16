import test from 'node:test';
import assert from 'node:assert/strict';
import { applyImageJob } from '../src/lib/imageRegeneration.ts';

const original = { id: 'leia', metadata: { name: 'Keep this title' }, spec: {
  avatar: 'leia?v=old', infographic: 'student?v=old', infographicSolution: 'solution?v=old',
  problem: { id: 'shared', spec: { avatar: 'problem?v=old', description: 'Keep this description' } },
  persona: { id: 'persona', spec: { avatar: 'persona?v=old' } },
} };

test('a completed shared component changes only its image and preserves the persisted version', () => {
  const updated = applyImageJob(original, { leiaId: 'another', steps: [
    { target: 'problems', entityId: 'shared', status: 'completed', image: 'problem?v=new' },
  ] });
  assert.equal(updated.spec.problem.spec.avatar, 'problem?v=new');
  assert.equal(updated.spec.problem.spec.description, original.spec.problem.spec.description);
  assert.equal(updated.metadata, original.metadata);
  assert.equal(updated.spec.persona, original.spec.persona);
  assert.equal(original.spec.problem.spec.avatar, 'problem?v=old');
});

test('results from another LEIA or failed targets cannot contaminate a view', () => {
  assert.equal(applyImageJob(original, { steps: [
    { target: 'leias', entityId: 'another', status: 'completed', image: 'wrong' },
    { target: 'infographic', entityId: 'leia', status: 'failed', image: 'wrong' },
  ] }), original);
});

test('an unchanged polling result keeps object identity and cannot reset viewers repeatedly', () => {
  assert.equal(applyImageJob(original, { steps: [
    { target: 'leias', entityId: 'leia', status: 'completed', image: 'leia?v=old' },
  ] }), original);
});

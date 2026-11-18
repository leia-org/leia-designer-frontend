import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { ActivityStagesEditor } from '../../src/components/ActivityStagesEditor';
import api from '../../src/lib/axios';
import type { ActivityStage, Experiment, LeiaConfig } from '../../src/models/Experiment';
import type { Leia } from '../../src/models/Leia';

test('saves an empty stage and only asks for an earlier source after a LEIA references it', async () => {
  const firstStage: ActivityStage = {
    id: 'initial-stage',
    previousStageId: null,
    orchestration: {
      mode: 'single', maxInternalTurns: 2, openingLeiaId: null, problemLeiaId: null, sharedTask: '',
    },
  };
  let experiment: Experiment = {
    id: 'activity', name: 'Interview activity', user: 'owner', isPublished: false,
    leias: [], stages: [firstStage], createdAt: '', updatedAt: '',
  };
  const patch = vi.spyOn(api, 'patch').mockImplementation(async (_url, body) => ({
    data: { ...experiment, stages: body.stages },
  }));
  const onSaved = vi.fn((data: Experiment) => { experiment = data; });
  const editor = () => <ActivityStagesEditor experiment={experiment} onSaved={onSaved} />;
  const { rerender } = render(editor());

  fireEvent.click(screen.getByRole('button', { name: 'Add stage' }));
  expect(screen.getByRole('img', { name: 'Stage 2' }).textContent).toBe('2');
  expect(screen.queryByRole('combobox', { name: /Source of previous stage outputs/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Save stages' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  const secondStage = experiment.stages![1];
  expect(secondStage.previousStageId).toBeNull();

  const assignLeia = (id: string, description: string): LeiaConfig => ({
    id, stageId: secondStage.id, configuration: { mode: 'standard', data: {} },
    leia: {
      id, metadata: { name: id },
      spec: { behaviour: { spec: { description } } },
    } as Leia,
  });
  experiment = { ...experiment, leias: [assignLeia('Interview', 'Ask an open question')] };
  rerender(editor());
  expect(screen.queryByRole('combobox', { name: /Source of previous stage outputs/ })).toBeNull();

  experiment = {
    ...experiment,
    leias: [...experiment.leias, assignLeia('Reflection', 'Reflect on {{previousStage.outputs.conversation}}')],
  };
  rerender(editor());
  fireEvent.mouseDown(screen.getByRole('combobox', { name: /Source of previous stage outputs/ }));
  fireEvent.click(await screen.findByRole('option', { name: 'Stage 1' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save stages' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(2));
  expect(patch).toHaveBeenLastCalledWith('/api/v1/experiments/activity/stages', {
    stages: [firstStage, { ...secondStage, previousStageId: firstStage.id }],
  });
  rerender(editor());
  expect(screen.getByRole('combobox', { name: /Source of previous stage outputs/ }).textContent).toBe('Stage 1');
});

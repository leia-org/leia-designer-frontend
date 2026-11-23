import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { ActivityStagesEditor } from '../../src/components/ActivityStagesEditor';
import api from '../../src/lib/axios';
import type { ActivityStage, Experiment, LeiaConfig } from '../../src/models/Experiment';
import type { Leia } from '../../src/models/Leia';

test('saves an empty stage and only asks for an earlier source after a LEIA references it', async () => {
  const firstStage: ActivityStage = {
    id: 'initial-stage',
    outputSources: { conversation: null, submitedSolution: null },
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
  expect(screen.queryByRole('combobox', { name: /Source of conversation output/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Save stages' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  const secondStage = experiment.stages![1];
  expect(secondStage.outputSources).toEqual({ conversation: null, submitedSolution: null });

  const assignLeia = (id: string, description: string, stageId = secondStage.id): LeiaConfig => ({
    id, stageId, configuration: { mode: 'standard', data: {} },
    leia: {
      id, metadata: { name: id },
      spec: { behaviour: { spec: { description } } },
    } as Leia,
  });
  experiment = { ...experiment, leias: [assignLeia('Interview', 'Ask an open question')] };
  rerender(editor());
  expect(screen.queryByRole('combobox', { name: /Source of conversation output/ })).toBeNull();

  experiment = {
    ...experiment,
    leias: [...experiment.leias, assignLeia('Reflection', 'Reflect on {{previousStage.outputs.conversation}}')],
  };
  rerender(editor());
  expect(screen.queryByRole('combobox', { name: /Source of submitted solution output/ })).toBeNull();
  fireEvent.mouseDown(screen.getByRole('combobox', { name: /Source of conversation output/ }));
  fireEvent.click(await screen.findByRole('option', { name: 'Stage 1' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save stages' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(2));
  expect(patch).toHaveBeenLastCalledWith('/api/v1/experiments/activity/stages', {
    stages: [firstStage, {
      ...secondStage,
      outputSources: { conversation: firstStage.id, submitedSolution: null },
    }],
  });
  rerender(editor());
  expect(screen.getByRole('combobox', { name: /Source of conversation output/ }).textContent).toBe('Stage 1');

  // Add a third stage that resolves submitted solution from Stage 1 and conversation from Stage 2.
  fireEvent.click(screen.getByRole('button', { name: 'Add stage' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save stages' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(3));
  const thirdStage = experiment.stages![2];
  experiment = {
    ...experiment,
    leias: [
      ...experiment.leias,
      assignLeia(
        'Evaluator',
        'Review {{previousStage.outputs.submitedSolution}} and {{previousStage.outputs.conversation}}',
        thirdStage.id,
      ),
    ],
  };
  rerender(editor());
  const conversationCombos = screen.getAllByRole('combobox', { name: /Source of conversation output/ });
  fireEvent.mouseDown(conversationCombos[1]);
  fireEvent.click(await screen.findByRole('option', { name: 'Stage 2' }));
  fireEvent.mouseDown(screen.getByRole('combobox', { name: /Source of submitted solution output/ }));
  fireEvent.click(await screen.findByRole('option', { name: 'Stage 1' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save stages' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(4));
  expect(patch).toHaveBeenLastCalledWith('/api/v1/experiments/activity/stages', {
    stages: [
      firstStage,
      experiment.stages![1],
      {
        ...thirdStage,
        outputSources: { conversation: secondStage.id, submitedSolution: firstStage.id },
      },
    ],
  });
});

test('disables earlier stages using transcription mode only for the conversation output selector', async () => {
  const stages: ActivityStage[] = [
    {
      id: 'stage-1',
      outputSources: { conversation: null, submitedSolution: null },
      orchestration: { mode: 'single', maxInternalTurns: 2, openingLeiaId: null, problemLeiaId: null, sharedTask: '' },
    },
    {
      id: 'stage-2',
      outputSources: { conversation: null, submitedSolution: null },
      orchestration: { mode: 'single', maxInternalTurns: 2, openingLeiaId: null, problemLeiaId: null, sharedTask: '' },
    },
  ];
  const experiment: Experiment = {
    id: 'activity-transcription',
    name: 'Transcription activity',
    user: 'owner',
    isPublished: false,
    stages,
    leias: [
      {
        id: 'l1',
        stageId: 'stage-1',
        configuration: { mode: 'transcription', data: {} },
        leia: { id: 'l1', metadata: { name: 'Read transcript' }, spec: { behaviour: { spec: { description: 'Read' } } } } as Leia,
      },
      {
        id: 'l2',
        stageId: 'stage-2',
        configuration: { mode: 'standard', data: {} },
        leia: {
          id: 'l2',
          metadata: { name: 'Review' },
          spec: {
            behaviour: {
              spec: {
                description: '{{previousStage.outputs.conversation}} {{previousStage.outputs.submitedSolution}}',
              },
            },
          },
        } as Leia,
      },
    ],
    createdAt: '',
    updatedAt: '',
  };

  render(<ActivityStagesEditor experiment={experiment} onSaved={vi.fn()} />);

  fireEvent.mouseDown(screen.getByRole('combobox', { name: /Source of conversation output/ }));
  const conversationStage1Option = await screen.findByRole('option', { name: /Stage 1 \(transcription mode\)/ });
  expect(conversationStage1Option.getAttribute('aria-disabled')).toBe('true');
  fireEvent.keyDown(conversationStage1Option, { key: 'Escape' });

  fireEvent.mouseDown(screen.getByRole('combobox', { name: /Source of submitted solution output/ }));
  const solutionStage1Option = await screen.findByRole('option', { name: 'Stage 1' });
  expect(solutionStage1Option.getAttribute('aria-disabled')).not.toBe('true');
});

test('warns when a MultiLEIA stage contains LEIAs with conversation dynamics or widgets', () => {
  const stage: ActivityStage = {
    id: 'stage-multi',
    outputSources: { conversation: null, submitedSolution: null },
    orchestration: { mode: 'multi', maxInternalTurns: 2, openingLeiaId: 'l1', problemLeiaId: 'l1', sharedTask: '' },
  };
  const experiment: Experiment = {
    id: 'activity-multi-warn',
    name: 'Multi warning activity',
    user: 'owner',
    isPublished: false,
    stages: [stage],
    leias: [
      {
        id: 'l1',
        stageId: stage.id,
        configuration: { mode: 'standard', data: {} },
        leia: {
          id: 'l1',
          metadata: { name: 'Actor 1' },
          spec: {
            behaviour: {
              spec: {
                description: 'A',
                conversationDynamics: { stoppingCondition: { enabled: true, config: { condition: 'Done' } } },
              },
            },
          },
        } as unknown as Leia,
      },
      {
        id: 'l2',
        stageId: stage.id,
        configuration: { mode: 'standard', data: {} },
        leia: {
          id: 'l2',
          metadata: { name: 'Actor 2' },
          spec: { behaviour: { spec: { description: 'B' } } },
        } as Leia,
      },
    ],
    createdAt: '',
    updatedAt: '',
  };

  render(<ActivityStagesEditor experiment={experiment} onSaved={vi.fn()} />);
  expect(
    screen.getByText(/Conversation dynamics and problem widgets are only active in single-LEIA stages/i),
  ).toBeTruthy();
});

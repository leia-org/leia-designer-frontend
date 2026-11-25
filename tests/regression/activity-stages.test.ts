import { describe, expect, test } from 'vitest';
import {
  getActivityReplicationBlocker,
  getDependentStagesForConversation,
  hasTranscriptionMessages,
  leiaHasPreviousStageReferences,
  leiaUsesPreviousStageOutputs,
  stageHasEmptyTranscription,
  stageHasTranscriptionMode,
} from '../../src/lib/activityStages';
import type { Experiment } from '../../src/models/Experiment';
import type { Leia } from '../../src/models/Leia';

const orchestration = {
  mode: 'single' as const,
  maxInternalTurns: 2,
  openingLeiaId: null,
  problemLeiaId: null,
  sharedTask: '',
};

const makeLeia = (
  id: string,
  stageId: string,
  description: string,
  mode = 'standard',
  data: Record<string, unknown> = {},
) => ({
  id,
  stageId,
  configuration: { mode, data },
  leia: {
    id,
    metadata: { name: id },
    spec: { behaviour: { spec: { description } } },
  } as Leia,
});

describe('activityStages transcription helpers', () => {
  test('returns dependent stage numbers only for stages referenced via conversation', () => {
    const experiment: Experiment = {
      id: 'exp-1',
      name: 'Three-stage activity',
      user: 'owner',
      isPublished: false,
      createdAt: '',
      updatedAt: '',
      stages: [
        { id: 's1', outputSources: { conversation: null, submitedSolution: null }, orchestration },
        { id: 's2', outputSources: { conversation: null, submitedSolution: null }, orchestration },
        { id: 's3', outputSources: { conversation: 's2', submitedSolution: 's1' }, orchestration },
      ],
      leias: [
        makeLeia('l1', 's1', 'Stage 1', 'transcription'),
        makeLeia('l2', 's2', 'Stage 2', 'standard'),
        makeLeia('l3', 's3', '{{previousStage.outputs.submitedSolution}} {{previousStage.outputs.conversation}}'),
      ],
    };

    expect(getDependentStagesForConversation(experiment, 's1')).toEqual([]);
    expect(getDependentStagesForConversation(experiment, 's2')).toEqual([3]);
    expect(stageHasTranscriptionMode(experiment, 's1')).toBe(true);
    expect(stageHasTranscriptionMode(experiment, 's2')).toBe(false);
    expect(leiaUsesPreviousStageOutputs(experiment.leias[0].leia)).toBe(false);
    expect(leiaUsesPreviousStageOutputs(experiment.leias[2].leia)).toBe(true);
  });

  test('blocks replication when any stage has no LEIAs or unresolved previousStage references', () => {
    const emptyStage: Experiment = {
      id: 'exp-empty-stage',
      name: 'Empty stage activity',
      user: 'owner',
      isPublished: false,
      createdAt: '',
      updatedAt: '',
      stages: [
        { id: 's1', outputSources: { conversation: null, submitedSolution: null, problem: null }, orchestration },
        { id: 's2', outputSources: { conversation: null, submitedSolution: null, problem: null }, orchestration },
      ],
      leias: [makeLeia('l1', 's1', 'Stage 1')],
    };
    expect(getActivityReplicationBlocker(emptyStage)).toBe('Stage 2 requires at least one LEIA');

    const unresolvedSolution: Experiment = {
      ...emptyStage,
      id: 'exp-unresolved',
      leias: [
        makeLeia('l1', 's1', 'Stage 1'),
        makeLeia('l2', 's2', 'Evaluate {{previousStage.outputs.submitedSolution}}'),
      ],
    };
    expect(getActivityReplicationBlocker(unresolvedSolution)).toBe(
      'Select an earlier stage for submitted solution in stage 2',
    );

    const unresolvedProblemInRubric: Experiment = {
      ...emptyStage,
      id: 'exp-unresolved-problem',
      stages: [
        { id: 's1', outputSources: { conversation: null, submitedSolution: null, problem: null }, orchestration },
        { id: 's2', outputSources: { conversation: 's1', submitedSolution: null, problem: null }, orchestration },
      ],
      leias: [
        makeLeia('l1', 's1', 'Stage 1'),
        {
          ...makeLeia('l2', 's2', 'Discuss {{previousStage.outputs.conversation}}'),
          leia: {
            id: 'l2',
            metadata: { name: 'l2' },
            spec: {
              behaviour: { spec: { description: 'Discuss {{previousStage.outputs.conversation}}' } },
              rubric: { spec: { evaluationPrompt: 'Compare {{previousStage.leia.problem.description}}' } },
            },
          } as unknown as Leia,
        },
      ],
    };
    expect(getActivityReplicationBlocker(unresolvedProblemInRubric)).toBe(
      'Select an earlier stage for problem in stage 2',
    );

    const resolved: Experiment = {
      ...unresolvedProblemInRubric,
      stages: [
        { id: 's1', outputSources: { conversation: null, submitedSolution: null, problem: null }, orchestration },
        { id: 's2', outputSources: { conversation: 's1', submitedSolution: null, problem: 's1' }, orchestration },
      ],
    };
    expect(getActivityReplicationBlocker(resolved)).toBeNull();

    const emptyLegacy: Experiment = {
      id: 'exp-legacy',
      name: 'Empty legacy',
      user: 'owner',
      isPublished: false,
      createdAt: '',
      updatedAt: '',
      leias: [],
    };
    expect(getActivityReplicationBlocker(emptyLegacy)).toBe('Add at least one LEIA before replicating');
  });

  test('blocks replication when a conversation-referenced transcription stage has no chat messages, and allows it when populated', () => {
    const baseStages = [
      { id: 's1', outputSources: { conversation: null, submitedSolution: null, problem: null }, orchestration },
      { id: 's2', outputSources: { conversation: 's1', submitedSolution: null, problem: null }, orchestration },
    ];
    const emptyTranscript: Experiment = {
      id: 'exp-empty-transcript',
      name: 'Empty transcript activity',
      user: 'owner',
      isPublished: false,
      createdAt: '',
      updatedAt: '',
      stages: baseStages,
      leias: [
        makeLeia('l1', 's1', 'Stage 1', 'transcription', { messages: [] }),
        makeLeia('l2', 's2', 'Review {{previousStage.outputs.conversation}}'),
      ],
    };
    expect(hasTranscriptionMessages(emptyTranscript.leias[0])).toBe(false);
    expect(stageHasEmptyTranscription(emptyTranscript, 's1')).toBe(true);
    expect(getActivityReplicationBlocker(emptyTranscript)).toBe(
      'Stage 1 requires non-empty transcription chat messages because stage 2 uses its conversation',
    );

    const linkOnlyTranscript: Experiment = {
      ...emptyTranscript,
      leias: [
        makeLeia('l1', 's1', 'Stage 1', 'transcription', { link: 'https://example.com/transcript' }),
        makeLeia('l2', 's2', 'Review {{previousStage.outputs.conversation}}'),
      ],
    };
    expect(getActivityReplicationBlocker(linkOnlyTranscript)).toBe(
      'Stage 1 requires non-empty transcription chat messages because stage 2 uses its conversation',
    );

    const populatedTranscript: Experiment = {
      ...emptyTranscript,
      leias: [
        makeLeia('l1', 's1', 'Stage 1', 'transcription', {
          messages: [{ text: 'Hello', timestamp: '2026-11-25T10:00:00Z', isLeia: false }],
        }),
        makeLeia('l2', 's2', 'Review {{previousStage.outputs.conversation}}'),
      ],
    };
    expect(hasTranscriptionMessages(populatedTranscript.leias[0])).toBe(true);
    expect(stageHasEmptyTranscription(populatedTranscript, 's1')).toBe(false);
    expect(getActivityReplicationBlocker(populatedTranscript)).toBeNull();
  });

  test('detects any previousStage reference in behaviour or rubric templates', () => {
    expect(
      leiaHasPreviousStageReferences({
        spec: { behaviour: { spec: { description: 'Review {{previousStage.outputs.conversation}}.' } } },
      }),
    ).toBe(true);
    expect(
      leiaHasPreviousStageReferences({
        spec: { behaviour: { spec: { description: 'Grade {{ previousStage.outputs.submitedSolution }}.' } } },
      }),
    ).toBe(true);
    expect(
      leiaHasPreviousStageReferences({
        spec: { behaviour: { spec: { description: 'Compare {{previousStage.leia.problem.description}}.' } } },
      }),
    ).toBe(true);
    expect(
      leiaHasPreviousStageReferences({
        spec: { behaviour: { spec: { description: 'Malformed {{previousStage.unknown}}.' } } },
      }),
    ).toBe(true);
    expect(
      leiaHasPreviousStageReferences({
        spec: {
          behaviour: { spec: { description: 'Standard behaviour.' } },
          rubric: { spec: { evaluationPrompt: 'Use {{previousStage.leia.problem.solution}}.' } },
        },
      }),
    ).toBe(true);
    expect(
      leiaHasPreviousStageReferences({
        spec: {
          behaviour: { spec: { description: 'Act as {{persona.fullName}} without previousStage placeholders.' } },
          rubric: { spec: { evaluationPrompt: 'Evaluate {{currentStage.outputs.conversation}}.' } },
        },
      }),
    ).toBe(false);
    expect(leiaHasPreviousStageReferences(null)).toBe(false);
    expect(leiaHasPreviousStageReferences('leia-id')).toBe(false);
  });
});

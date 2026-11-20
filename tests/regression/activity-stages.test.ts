import { describe, expect, test } from 'vitest';
import {
  getDependentStagesForConversation,
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

const makeLeia = (id: string, stageId: string, description: string, mode = 'standard') => ({
  id,
  stageId,
  configuration: { mode, data: {} },
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
  });
});

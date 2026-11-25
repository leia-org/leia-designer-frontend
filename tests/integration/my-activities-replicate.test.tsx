import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';
import api from '../../src/lib/axios';
import type { Experiment } from '../../src/models/Experiment';
import type { Leia } from '../../src/models/Leia';

vi.mock('../../src/context/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'owner', role: 'admin', email: 'owner@example.com' },
    logout: vi.fn(),
  }),
}));

import { MyActivities } from '../../src/screens/MyActivities';

const orchestration = {
  mode: 'single' as const,
  maxInternalTurns: 2,
  openingLeiaId: null,
  problemLeiaId: null,
  sharedTask: '',
};

const makeLeia = (id: string, stageId: string, description: string) => ({
  id,
  stageId,
  configuration: { mode: 'standard', data: {} },
  leia: {
    id,
    metadata: { name: id },
    spec: { behaviour: { spec: { description } } },
  } as Leia,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MyActivities Replicate button guard', () => {
  test('disables Replicate for activities with empty stages or unresolved stage outputs and enables it when valid', async () => {
    const activities: Experiment[] = [
      {
        id: 'exp-empty-stage',
        name: 'Activity with empty stage',
        user: { id: 'owner', email: 'owner@example.com', role: 'admin' },
        isPublished: false,
        createdAt: '2026-11-20T10:00:00Z',
        updatedAt: '2026-11-20T10:00:00Z',
        stages: [
          { id: 's1', outputSources: { conversation: null, submitedSolution: null, problem: null }, orchestration },
          { id: 's2', outputSources: { conversation: null, submitedSolution: null, problem: null }, orchestration },
        ],
        leias: [makeLeia('l1', 's1', 'Stage 1')],
      },
      {
        id: 'exp-unresolved',
        name: 'Activity with unresolved output',
        user: { id: 'owner', email: 'owner@example.com', role: 'admin' },
        isPublished: false,
        createdAt: '2026-11-20T10:00:00Z',
        updatedAt: '2026-11-20T10:00:00Z',
        stages: [
          { id: 's1', outputSources: { conversation: null, submitedSolution: null, problem: null }, orchestration },
          { id: 's2', outputSources: { conversation: null, submitedSolution: null, problem: null }, orchestration },
        ],
        leias: [
          makeLeia('l1', 's1', 'Stage 1'),
          makeLeia('l2', 's2', 'Review {{previousStage.outputs.conversation}}'),
        ],
      },
      {
        id: 'exp-valid',
        name: 'Valid staged activity',
        user: { id: 'owner', email: 'owner@example.com', role: 'admin' },
        isPublished: false,
        createdAt: '2026-11-20T10:00:00Z',
        updatedAt: '2026-11-20T10:00:00Z',
        stages: [
          { id: 's1', outputSources: { conversation: null, submitedSolution: null, problem: null }, orchestration },
          { id: 's2', outputSources: { conversation: 's1', submitedSolution: null, problem: null }, orchestration },
        ],
        leias: [
          makeLeia('l1', 's1', 'Stage 1'),
          makeLeia('l2', 's2', 'Review {{previousStage.outputs.conversation}}'),
        ],
      },
    ];

    vi.spyOn(api, 'get').mockResolvedValue({
      data: { experiments: activities, nextCursor: null },
    });

    render(
      <MemoryRouter>
        <MyActivities />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Valid staged activity')).toBeTruthy());

    const replicateButtons = screen.getAllByRole('button', { name: 'Replicate' }) as HTMLButtonElement[];
    expect(replicateButtons).toHaveLength(3);
    expect(replicateButtons[0].disabled).toBe(true);
    expect(replicateButtons[1].disabled).toBe(true);
    expect(replicateButtons[2].disabled).toBe(false);
  });
});

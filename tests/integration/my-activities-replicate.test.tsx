import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';
import api, { authApi } from '../../src/lib/axios';
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

    vi.spyOn(authApi, 'get').mockResolvedValue({ data: [] });
    vi.spyOn(api, 'get').mockImplementation(async (url) => {
      if (url === '/api/v1/provider') {
        return {
          data: {
            models: ['gpt-4.1-mini'],
            default: 'gpt-4.1-mini',
            apiKeyProviders: { openai: ['gpt-4.1-mini'] },
            providerProviderModuleMap: { openai: 'openai-responses' },
          },
        };
      }
      return {
        data: { experiments: activities, nextCursor: null },
      };
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

  test('Generate transcription initializes runner with resolved runnerConfiguration', async () => {
    const transcriptionActivity: Experiment = {
      id: 'exp-transcription',
      name: 'Transcription activity',
      user: { id: 'owner', email: 'owner@example.com', role: 'admin' },
      isPublished: false,
      createdAt: '2026-11-20T10:00:00Z',
      updatedAt: '2026-11-20T10:00:00Z',
      stages: [
        { id: 's1', outputSources: { conversation: null, submitedSolution: null, problem: null }, orchestration },
      ],
      leias: [
        {
          id: 'lc-1',
          stageId: 's1',
          configuration: { mode: 'transcription', data: {} },
          leia: {
            id: 'leia-1',
            metadata: { name: 'Interview LEIA' },
            spec: {
              persona: { metadata: { name: 'Client' }, spec: { fullName: 'Client' } },
              behaviour: { spec: { description: 'Act as a client' } },
              problem: { spec: { description: 'Gather requirements' } },
            },
          } as Leia,
        },
      ],
    };

    vi.spyOn(authApi, 'get').mockResolvedValue({
      data: [
        {
          id: '65f000000000000000000001',
          provider: 'openai',
          model: 'gpt-4.1-mini',
          description: 'Default OpenAI key',
          isDefault: true,
          isActive: true,
        },
      ],
    });
    vi.spyOn(api, 'get').mockImplementation(async (url) => {
      if (url === '/api/v1/provider') {
        return {
          data: {
            models: ['gpt-4.1-mini', 'gpt-4.1'],
            default: 'gpt-4.1',
            apiKeyProviders: { openai: ['gpt-4.1-mini', 'gpt-4.1'] },
            providerProviderModuleMap: { openai: 'openai-responses' },
          },
        };
      }
      return {
        data: { experiments: [transcriptionActivity], nextCursor: null },
      };
    });
    const postSpy = vi.spyOn(api, 'post').mockResolvedValue({
      data: { sessionId: 'sess-transcription-1' },
    });

    render(
      <MemoryRouter>
        <MyActivities />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Transcription activity')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Expand activity' }));
    const generateButton = await screen.findByRole('button', { name: 'Generate' });
    fireEvent.click(generateButton);

    await waitFor(() =>
      expect(postSpy).toHaveBeenCalledWith('/api/v1/runner/initialize', {
        spec: (transcriptionActivity.leias[0].leia as Leia).spec,
        runnerConfiguration: {
          modelName: 'gpt-4.1-mini',
          apiKeyId: '65f000000000000000000001',
        },
      }),
    );
  });
});

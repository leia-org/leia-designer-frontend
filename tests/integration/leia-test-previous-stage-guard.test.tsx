import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';
import api from '../../src/lib/axios';
import { PREVIOUS_STAGE_TEST_DISABLED_REASON } from '../../src/lib/activityStages';
import type { Behaviour, Leia, Persona, Problem } from '../../src/models/Leia';
import type { RubricSnapshot } from '../../src/models/Rubric';

const defaultApiKey = {
  id: '507f1f77bcf86cd799439011',
  description: 'OpenAI key',
  provider: 'openai',
  model: 'gpt-4.1-mini',
  isDefault: true,
  isActive: true,
};

vi.mock('../../src/context', () => ({
  useAuth: () => ({
    user: { id: 'owner', role: 'admin', email: 'owner@example.com' },
    logout: vi.fn(),
  }),
}));

vi.mock('../../src/context/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'owner', role: 'admin', email: 'owner@example.com' },
    logout: vi.fn(),
  }),
}));

vi.mock('../../src/context/ImageRegenerationContext', () => ({
  useImageRegeneration: () => ({
    jobs: {},
    enqueueJob: vi.fn(),
    refreshJobs: vi.fn(),
  }),
}));

vi.mock('../../src/hooks/useApiKeys', () => ({
  useApiKeys: () => ({
    apiKeys: [defaultApiKey],
    isLoading: false,
    error: null,
    getDefaultKey: () => defaultApiKey,
    refetch: vi.fn(),
  }),
}));

vi.mock('../../src/hooks/useProviders', () => ({
  useProviders: () => ({
    apiKeyProvidersMapped: { openai: ['gpt-4.1-mini'] },
    providerProviderModuleMap: { openai: 'openai-responses' },
    defaultModel: 'gpt-4.1-mini',
    isLoading: false,
    error: null,
  }),
}));

vi.mock('../../src/components/ProblemChatPanel', () => ({
  ProblemChatPanel: () => <div data-testid="mock-problem-chat-panel" />,
}));

import { LeiaSearch } from '../../src/screens/LeiaSearch';
import { CreateLeia } from '../../src/screens/CreateLeia';

const basePersona: Persona = {
  id: 'persona-1',
  apiVersion: 'v1',
  metadata: { name: 'ana', version: '1.0.0' },
  spec: {
    fullName: 'Ana Reviewer',
    firstName: 'Ana',
    description: 'Reviewer persona',
    personality: 'Constructive',
    subjectPronoum: 'she',
    objectPronoum: 'her',
    possesivePronoum: 'her',
    possesiveAdjective: 'her',
  },
  isPublished: true,
};

const baseProblem: Problem = {
  id: 'problem-1',
  apiVersion: 'v1',
  metadata: { name: 'review-problem', version: '1.0.0' },
  spec: {
    description: 'Review the solution carefully.',
    personaBackground: 'Senior engineer',
    details: 'Provide structured feedback.',
    solution: 'Reference solution',
    solutionFormat: 'text',
    process: ['other'],
  },
  isPublished: true,
};

const makeBehaviour = (id: string, description: string): Behaviour => ({
  id,
  apiVersion: 'v1',
  metadata: { name: id, version: '1.0.0' },
  spec: {
    description,
    role: 'Reviewer',
    process: ['other'],
  },
  isPublished: true,
});

const makeRubric = (evaluationPrompt?: string): RubricSnapshot => ({
  apiVersion: 'v1',
  metadata: { name: 'Stage rubric' },
  spec: {
    ...(evaluationPrompt ? { evaluationPrompt } : {}),
    sections: [
      {
        title: 'Quality',
        weight: 100,
        levels: ['Pass'],
        criteria: [
          {
            name: 'Accuracy',
            descriptors: [{ level: 'Pass', description: 'Accurate' }],
          },
        ],
      },
    ],
  },
});

const makeLeia = (
  id: string,
  name: string,
  behaviourDescription: string,
  rubricEvaluationPrompt?: string,
): Leia => ({
  id,
  apiVersion: 'v1',
  metadata: { name, version: '1.0.0', labels: [] },
  spec: {
    persona: basePersona,
    problem: baseProblem,
    behaviour: makeBehaviour(`beh-${id}`, behaviourDescription),
    ...(rubricEvaluationPrompt ? { rubric: makeRubric(rubricEvaluationPrompt) } : {}),
  },
  isPublished: true,
  user: { id: 'owner', email: 'owner@example.com', role: 'admin' },
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Designer Test LEIA previousStage guard', () => {
  test('LeiaSearch disables Test LEIA and settings for LEIAs referencing previousStage in behaviour or rubric', async () => {
    const leias: Leia[] = [
      makeLeia('leia-standard', 'Standard LEIA', 'Guide the student through {{problem.description}}.'),
      makeLeia('leia-prev-beh', 'Behaviour Previous Stage LEIA', 'Review {{previousStage.outputs.conversation}}.'),
      makeLeia(
        'leia-prev-rubric',
        'Rubric Previous Stage LEIA',
        'Guide the student normally.',
        'Compare against {{previousStage.leia.problem.description}}.',
      ),
    ];

    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/api/v1/leias') return { data: { leias, nextCursor: null } };
      if (url === '/api/v1/labels') return { data: [] };
      return { data: [] };
    });
    const postSpy = vi.spyOn(api, 'post').mockResolvedValue({ data: { sessionId: 'session-ok' } });

    render(
      <MemoryRouter initialEntries={['/leias']}>
        <Routes>
          <Route path="/leias" element={<LeiaSearch />} />
          <Route path="/chat/:sessionId" element={<div>Chat screen</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Standard LEIA')).toBeTruthy());

    const standardRow = screen.getByText('Standard LEIA').closest('li') as HTMLElement;
    const prevBehRow = screen.getByText('Behaviour Previous Stage LEIA').closest('li') as HTMLElement;
    const prevRubricRow = screen.getByText('Rubric Previous Stage LEIA').closest('li') as HTMLElement;

    const inspectRowTestControls = (row: HTMLElement, name: string) => {
      fireEvent.click(within(row).getByRole('button', { name: `Actions for ${name}` }));
      return {
        testButton: within(row).getByRole('button', { name: 'Test LEIA' }) as HTMLButtonElement,
        settingsButton: within(row).getByRole('button', {
          name: 'Choose Test LEIA settings',
        }) as HTMLButtonElement,
      };
    };

    const prevBehControls = inspectRowTestControls(prevBehRow, 'Behaviour Previous Stage LEIA');
    expect(prevBehControls.testButton.disabled).toBe(true);
    expect(prevBehControls.settingsButton.disabled).toBe(true);
    fireEvent.click(prevBehControls.testButton);
    expect(postSpy).not.toHaveBeenCalled();

    const prevRubricControls = inspectRowTestControls(prevRubricRow, 'Rubric Previous Stage LEIA');
    expect(prevRubricControls.testButton.disabled).toBe(true);
    expect(prevRubricControls.settingsButton.disabled).toBe(true);
    fireEvent.click(prevRubricControls.testButton);
    expect(postSpy).not.toHaveBeenCalled();

    const standardControls = inspectRowTestControls(standardRow, 'Standard LEIA');
    expect(standardControls.testButton.disabled).toBe(false);
    expect(standardControls.settingsButton.disabled).toBe(false);

    fireEvent.click(standardControls.testButton);
    await waitFor(() =>
      expect(postSpy).toHaveBeenCalledWith(
        '/api/v1/runner/initialize',
        expect.objectContaining({
          spec: leias[0].spec,
          runnerConfiguration: {
            modelName: 'gpt-4.1-mini',
            apiKeyId: defaultApiKey.id,
          },
        }),
      ),
    );
  });

  test('CreateLeia disables Test LEIA when preset behaviour or rubric references previousStage and enables it otherwise', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/api/v1/rubrics/schema') return { data: {} };
      return { data: [] };
    });
    const postSpy = vi.spyOn(api, 'post').mockImplementation(async (url: string) => {
      if (url === '/api/v1/leia-drafts') {
        return {
          data: {
            id: 'draft-1',
            title: 'Draft',
            state: {},
            createdAt: '2026-11-24T00:00:00Z',
            updatedAt: '2026-11-24T00:00:00Z',
          },
        };
      }
      return { data: { sessionId: 'session-ok' } };
    });

    const { unmount } = render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/create',
            state: {
              preset: {
                persona: basePersona,
                problem: baseProblem,
                behaviour: makeBehaviour('beh-prev', 'Discuss {{previousStage.outputs.submitedSolution}}.'),
              },
            },
          },
        ]}
      >
        <CreateLeia />
      </MemoryRouter>,
    );

    const disabledButton = (await screen.findByRole('button', { name: 'Test LEIA' })) as HTMLButtonElement;
    expect(disabledButton.disabled).toBe(true);
    expect(screen.getByText('Workbench only')).toBeTruthy();
    expect(screen.getByText(PREVIOUS_STAGE_TEST_DISABLED_REASON)).toBeTruthy();

    fireEvent.click(disabledButton);
    expect(postSpy).not.toHaveBeenCalledWith('/api/v1/runner/initialize', expect.anything());

    unmount();

    const { unmount: unmountRubric } = render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/create',
            state: {
              preset: {
                persona: basePersona,
                problem: baseProblem,
                behaviour: makeBehaviour('beh-clean', 'Guide the student normally.'),
                rubric: makeRubric('Grade using {{previousStage.outputs.conversation}}.'),
              },
            },
          },
        ]}
      >
        <CreateLeia />
      </MemoryRouter>,
    );

    const rubricDisabledButton = (await screen.findByRole('button', { name: 'Test LEIA' })) as HTMLButtonElement;
    expect(rubricDisabledButton.disabled).toBe(true);
    expect(screen.getByText('Workbench only')).toBeTruthy();

    unmountRubric();

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/create',
            state: {
              preset: {
                persona: basePersona,
                problem: baseProblem,
                behaviour: makeBehaviour('beh-normal', 'Guide the student normally.'),
                rubric: makeRubric('Grade using {{currentStage.outputs.conversation}}.'),
              },
            },
          },
        ]}
      >
        <CreateLeia />
      </MemoryRouter>,
    );

    const enabledButton = (await screen.findByRole('button', { name: 'Test LEIA' })) as HTMLButtonElement;
    await waitFor(() => expect(enabledButton.disabled).toBe(false));
    expect(screen.getByText('Ready to test')).toBeTruthy();
  });
});

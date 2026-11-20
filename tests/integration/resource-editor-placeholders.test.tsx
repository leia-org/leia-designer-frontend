import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { ResourceEditor } from '../../src/components/ResourceEditor';

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

test('shows the {{}} placeholders cheat sheet from the Behaviour Description info button', () => {
  render(
    <ResourceEditor
      resourceType="behaviour"
      onSave={vi.fn()}
      onCancel={vi.fn()}
    />,
  );

  const infoButton = screen.getByRole('button', { name: 'Available placeholders cheat sheet' });
  expect(infoButton).toBeTruthy();

  fireEvent.click(infoButton);

  const expectedTokens = [
    '{{persona.fullName}}',
    '{{persona.firstName}}',
    '{{persona.description}}',
    '{{persona.personality}}',
    '{{persona.subjectPronoum}}',
    '{{persona.objectPronoum}}',
    '{{persona.possesivePronoum}}',
    '{{persona.possesiveAdjective}}',
    '{{problem.description}}',
    '{{problem.details}}',
    '{{problem.personaBackground}}',
    '{{problem.solution}}',
    '{{problem.initialSolution}}',
    '{{problem.solutionFormat}}',
    '{{problem.evaluationPrompt}}',
    '{{problem.process}}',
    '{{behaviour.role}}',
    '{{behaviour.process}}',
    '{{behaviour.tooltip}}',
    '{{previousStage.outputs.conversation}}',
    '{{previousStage.outputs.submitedSolution}}',
  ];

  for (const token of expectedTokens) {
    expect(screen.getAllByText(token).length).toBeGreaterThan(0);
  }
});

test('does not show the behaviour placeholders cheat sheet button when editing a Persona', () => {
  render(
    <ResourceEditor
      resourceType="persona"
      onSave={vi.fn()}
      onCancel={vi.fn()}
    />,
  );

  expect(screen.queryByRole('button', { name: 'Available placeholders cheat sheet' })).toBeNull();
});

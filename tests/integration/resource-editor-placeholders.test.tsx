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

test('shows the {{}} placeholders hint in Behaviour Description and hides the old info button', () => {
  render(
    <ResourceEditor
      resourceType="behaviour"
      onSave={vi.fn()}
      onCancel={vi.fn()}
    />,
  );

  expect(screen.queryByRole('button', { name: 'Available placeholders cheat sheet' })).toBeNull();
  expect(screen.getByText(/Start typing/i)).toBeTruthy();
  expect(screen.getByText(/to insert dynamic placeholders/i)).toBeTruthy();
});

test('autocompletes {{}} placeholders step by step by dot segment', () => {
  render(
    <ResourceEditor
      resourceType="behaviour"
      onSave={vi.fn()}
      onCancel={vi.fn()}
    />,
  );

  const textarea = screen.getByPlaceholderText('Describe the behaviour...') as HTMLTextAreaElement;
  fireEvent.change(textarea, {
    target: { value: 'Act as {{', selectionStart: 9 },
  });

  expect(screen.getByRole('listbox', { name: 'Placeholder suggestions' })).toBeTruthy();
  expect(screen.getByRole('option', { name: /^persona\b/ })).toBeTruthy();
  expect(screen.getByRole('option', { name: /^problem\b/ })).toBeTruthy();
  expect(screen.getByRole('option', { name: /^behaviour\b/ })).toBeTruthy();
  expect(screen.getByRole('option', { name: /^previousStage\b/ })).toBeTruthy();
  expect(screen.queryByRole('option', { name: /fullName/ })).toBeNull();

  // Select first segment: persona
  fireEvent.click(screen.getByRole('option', { name: /^persona\b/ }));
  expect(textarea.value).toBe('Act as {{persona.');

  // Menu stays open for the second segment
  expect(screen.getByRole('option', { name: /fullName/ })).toBeTruthy();
  expect(screen.queryByRole('option', { name: /^problem\b/ })).toBeNull();

  fireEvent.click(screen.getByRole('option', { name: /fullName/ }));
  expect(textarea.value).toBe('Act as {{persona.fullName}}');
  expect(screen.queryByRole('listbox', { name: 'Placeholder suggestions' })).toBeNull();

  // Multi-level path: previousStage -> outputs -> conversation
  fireEvent.change(textarea, {
    target: { value: 'Act as {{persona.fullName}} {{prev', selectionStart: 34 },
  });
  fireEvent.keyDown(textarea, { key: 'Enter' });
  expect(textarea.value).toBe('Act as {{persona.fullName}} {{previousStage.');
  expect(screen.getByRole('option', { name: /^outputs\b/ })).toBeTruthy();

  fireEvent.keyDown(textarea, { key: 'Enter' });
  expect(textarea.value).toBe('Act as {{persona.fullName}} {{previousStage.outputs.');
  expect(screen.getByRole('option', { name: /conversation/ })).toBeTruthy();

  fireEvent.keyDown(textarea, { key: 'Enter' });
  expect(textarea.value).toBe('Act as {{persona.fullName}} {{previousStage.outputs.conversation}}');
  expect(screen.queryByRole('listbox', { name: 'Placeholder suggestions' })).toBeNull();
});

test('auto-sizes the Behaviour Description textarea to fit its text', () => {
  const originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'scrollHeight');
  Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', {
    configurable: true,
    get() {
      return 260;
    },
  });

  try {
    render(
      <ResourceEditor
        resourceType="behaviour"
        initialData={{
          metadata: { name: 'My behaviour', version: '1.0.0' },
          spec: { description: 'Line 1\nLine 2\nLine 3\nLine 4', role: 'Assistant', process: ['other'] },
        }}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const textarea = screen.getByPlaceholderText('Describe the behaviour...') as HTMLTextAreaElement;
    expect(textarea.style.height).toBe('260px');
  } finally {
    if (originalScrollHeight) {
      Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', originalScrollHeight);
    } else {
      delete (HTMLTextAreaElement.prototype as { scrollHeight?: number }).scrollHeight;
    }
  }
});

test('does not show the behaviour placeholders hint when editing a Persona', () => {
  render(
    <ResourceEditor
      resourceType="persona"
      onSave={vi.fn()}
      onCancel={vi.fn()}
    />,
  );

  expect(screen.queryByText(/to insert dynamic placeholders/i)).toBeNull();
});

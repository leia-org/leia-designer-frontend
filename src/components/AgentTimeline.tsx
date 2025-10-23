/**
 * Agent Timeline Component
 * Displays the wizard's progress with circular progress indicators and SVG icons
 * NO EMOJIS - Only SVG icons
 */

import React from 'react';
import type { WizardEvent } from '../hooks/useWizardSSE';

interface AgentTimelineProps {
  events: WizardEvent[];
}

interface TimelineStep {
  id: string;
  type: 'function' | 'message' | 'thinking' | 'complete' | 'error';
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'complete' | 'error';
  result?: any;
}

export const AgentTimeline: React.FC<AgentTimelineProps> = ({ events }) => {
  // Transform events into timeline steps
  const steps: TimelineStep[] = [];
  const functionCalls = new Map<string, { start: WizardEvent; complete?: WizardEvent }>();

  events.forEach((event) => {
    if (event.type === 'function_call_start') {
      const id = `${event.functionName}-${Date.now()}`;
      functionCalls.set(id, { start: event });
      steps.push({
        id,
        type: 'function',
        title: event.functionTitle || event.functionName || 'Processing',
        description: event.functionDescription,
        status: 'in_progress',
      });
    } else if (event.type === 'function_call_complete') {
      // Find the matching start event
      const matchingId = Array.from(functionCalls.entries()).find(
        ([_, value]) => value.start.functionName === event.functionName && !value.complete
      )?.[0];

      if (matchingId) {
        functionCalls.get(matchingId)!.complete = event;
        const stepIndex = steps.findIndex((s) => s.id === matchingId);
        if (stepIndex !== -1) {
          steps[stepIndex].status = 'complete';
          steps[stepIndex].result = event.result;
        }
      }
    } else if (event.type === 'message') {
      steps.push({
        id: `message-${Date.now()}`,
        type: 'message',
        title: 'Agent Response',
        description: event.content,
        status: 'complete',
      });
    } else if (event.type === 'thinking') {
      steps.push({
        id: `thinking-${Date.now()}`,
        type: 'thinking',
        title: event.message || 'Thinking...',
        status: 'in_progress',
      });
    } else if (event.type === 'complete') {
      steps.push({
        id: `complete-${Date.now()}`,
        type: 'complete',
        title: 'LEIA Complete',
        description: 'All components have been generated successfully',
        status: 'complete',
      });
    } else if (event.type === 'error') {
      steps.push({
        id: `error-${Date.now()}`,
        type: 'error',
        title: 'Error',
        description: event.message,
        status: 'error',
      });
    }
  });

  return (
    <div className="space-y-4 py-4">
      {steps.map((step, index) => (
        <TimelineStepComponent key={step.id} step={step} isLast={index === steps.length - 1} />
      ))}
    </div>
  );
};

interface TimelineStepComponentProps {
  step: TimelineStep;
  isLast: boolean;
}

const TimelineStepComponent: React.FC<TimelineStepComponentProps> = ({ step, isLast }) => {
  return (
    <div className="flex items-start gap-4">
      {/* Left side: Icon with progress indicator */}
      <div className="flex flex-col items-center">
        <div className="relative">
          {/* Circular progress background */}
          <div className="w-12 h-12 rounded-full border-4 border-gray-200 flex items-center justify-center">
            {/* Progress indicator for in_progress state */}
            {step.status === 'in_progress' && (
              <div className="absolute inset-0">
                <svg className="w-12 h-12 -rotate-90">
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    className="text-blue-500"
                    strokeDasharray="125.6"
                    strokeDashoffset="31.4"
                    style={{
                      animation: 'progress 2s ease-in-out infinite',
                    }}
                  />
                </svg>
              </div>
            )}

            {/* Status icon */}
            <div className="relative z-10">
              {step.status === 'complete' && <CheckIcon />}
              {step.status === 'in_progress' && <SpinnerIcon />}
              {step.status === 'error' && <ErrorIcon />}
              {step.status === 'pending' && <PendingIcon />}
            </div>
          </div>
        </div>

        {/* Connecting line */}
        {!isLast && <div className="w-0.5 h-8 bg-gray-300 my-2" />}
      </div>

      {/* Right side: Content */}
      <div className="flex-1 pb-4">
        <div className="font-medium text-gray-900">{step.title}</div>
        {step.description && (
          <div className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{step.description}</div>
        )}

        {/* Show result summary for completed functions */}
        {step.status === 'complete' && step.result && step.type === 'function' && (
          <ResultSummary result={step.result} />
        )}
      </div>
    </div>
  );
};

const ResultSummary: React.FC<{ result: any }> = ({ result }) => {
  if (!result.success) {
    return (
      <div className="mt-2 text-sm text-red-600 bg-red-50 rounded px-3 py-2">
        {result.error || 'Operation failed'}
      </div>
    );
  }

  // Show different summaries based on result type
  if (result.persona) {
    return (
      <div className="mt-2 text-sm text-green-700 bg-green-50 rounded px-3 py-2">
        Generated persona: {result.persona.spec?.firstName || result.persona.metadata?.name}
      </div>
    );
  }

  if (result.problem) {
    return (
      <div className="mt-2 text-sm text-green-700 bg-green-50 rounded px-3 py-2">
        Generated problem: {result.problem.metadata?.name}
      </div>
    );
  }

  if (result.behaviour) {
    return (
      <div className="mt-2 text-sm text-green-700 bg-green-50 rounded px-3 py-2">
        Generated behaviour: {result.behaviour.metadata?.name}
      </div>
    );
  }

  if (result.count !== undefined) {
    return (
      <div className="mt-2 text-sm text-blue-700 bg-blue-50 rounded px-3 py-2">
        Found {result.count} {result.count === 1 ? 'match' : 'matches'}
      </div>
    );
  }

  if (result.score !== undefined) {
    return (
      <div className="mt-2 text-sm text-blue-700 bg-blue-50 rounded px-3 py-2">
        Match score: {result.score}/100
      </div>
    );
  }

  return null;
};

// SVG Icons
const CheckIcon = () => (
  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const SpinnerIcon = () => (
  <svg
    className="w-6 h-6 text-blue-600 animate-spin"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

const ErrorIcon = () => (
  <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
);

const PendingIcon = () => (
  <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

// Add animation styles
const style = document.createElement('style');
style.textContent = `
  @keyframes progress {
    0% {
      stroke-dashoffset: 125.6;
    }
    50% {
      stroke-dashoffset: 31.4;
    }
    100% {
      stroke-dashoffset: 125.6;
    }
  }
`;
document.head.appendChild(style);

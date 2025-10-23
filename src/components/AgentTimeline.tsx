/**
 * Agent Timeline Component
 * Displays the wizard's progress with circular progress indicators and SVG icons
 * Function calls are grouped in collapsible sections like ChatGPT
 * NO EMOJIS - Only SVG icons
 */

import React, { useState } from 'react';
import type { WizardEvent } from '../hooks/useWizardSSE';
import { MarkdownRenderer } from './MarkdownRenderer';

interface AgentTimelineProps {
  events: WizardEvent[];
}

interface TimelineStep {
  id: string;
  type: 'function' | 'message' | 'thinking' | 'complete' | 'error' | 'function_group' | 'user_message';
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'complete' | 'error';
  result?: any;
  functions?: TimelineStep[]; // For grouped function calls
}

export const AgentTimeline: React.FC<AgentTimelineProps> = ({ events }) => {
  // Transform events into timeline steps with function grouping
  const steps: TimelineStep[] = [];
  const functionCalls = new Map<string, { start: WizardEvent; complete?: WizardEvent }>();
  let currentFunctionGroup: TimelineStep | null = null;

  events.forEach((event, index) => {
    // Skip technical events
    if (event.type === 'connected' || event.type === 'stream_end') {
      return;
    }

    if (event.type === 'user_message') {
      // Add user message as a step
      steps.push({
        id: `user-${index}`,
        type: 'user_message',
        title: 'You',
        description: event.content,
        status: 'complete',
      });
      return;
    }

    if (event.type === 'thinking') {
      // Start a new function group when thinking starts
      if (!currentFunctionGroup) {
        currentFunctionGroup = {
          id: `group-${index}`,
          type: 'function_group',
          title: 'Processing...',
          status: 'in_progress',
          functions: [],
        };
        steps.push(currentFunctionGroup);
      }
    } else if (event.type === 'function_call_start') {
      // Add function to current group
      if (!currentFunctionGroup) {
        currentFunctionGroup = {
          id: `group-${index}`,
          type: 'function_group',
          title: 'Processing...',
          status: 'in_progress',
          functions: [],
        };
        steps.push(currentFunctionGroup);
      }

      const id = `${event.functionName}-${index}`;
      functionCalls.set(id, { start: event });

      const functionStep: TimelineStep = {
        id,
        type: 'function',
        title: event.functionTitle || event.functionName || 'Processing',
        description: event.functionDescription,
        status: 'in_progress',
      };

      currentFunctionGroup.functions!.push(functionStep);
    } else if (event.type === 'function_call_complete') {
      // Find the matching start event and update it
      const matchingId = Array.from(functionCalls.entries()).find(
        ([_, value]) => value.start.functionName === event.functionName && !value.complete
      )?.[0];

      if (matchingId && currentFunctionGroup?.functions) {
        functionCalls.get(matchingId)!.complete = event;
        const functionStep = currentFunctionGroup.functions.find((f) => f.id === matchingId);
        if (functionStep) {
          functionStep.status = 'complete';
          functionStep.result = event.result;
        }
      }
    } else if (event.type === 'message') {
      // Complete current function group and start a new message step
      if (currentFunctionGroup) {
        currentFunctionGroup.status = 'complete';
        // Generate summary title
        const functionCount = currentFunctionGroup.functions?.length || 0;
        if (functionCount > 0) {
          currentFunctionGroup.title = `Completed ${functionCount} ${functionCount === 1 ? 'step' : 'steps'}`;
        }
        currentFunctionGroup = null;
      }

      steps.push({
        id: `message-${index}`,
        type: 'message',
        title: 'Wizard Response',
        description: event.content,
        status: 'complete',
      });
    } else if (event.type === 'complete') {
      if (currentFunctionGroup) {
        currentFunctionGroup.status = 'complete';
        currentFunctionGroup = null;
      }

      steps.push({
        id: `complete-${index}`,
        type: 'complete',
        title: 'LEIA Complete',
        description: 'All components have been generated successfully',
        status: 'complete',
      });
    } else if (event.type === 'error') {
      if (currentFunctionGroup) {
        currentFunctionGroup.status = 'error';
        currentFunctionGroup = null;
      }

      steps.push({
        id: `error-${index}`,
        type: 'error',
        title: 'Error',
        description: event.message,
        status: 'error',
      });
    }
  });

  return (
    <div className="space-y-2">
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
  const [isExpanded, setIsExpanded] = useState(false);
  const isMessage = step.type === 'message';
  const isUserMessage = step.type === 'user_message';
  const isFunctionGroup = step.type === 'function_group';

  // For user messages, render in a different style
  if (isUserMessage) {
    return (
      <div className="animate-fadeIn flex justify-end">
        <div className="bg-gray-900 text-white rounded-2xl px-4 py-3 max-w-2xl">
          <div className="text-sm leading-relaxed whitespace-pre-wrap">
            {step.description}
          </div>
        </div>
      </div>
    );
  }

  // For function groups, render collapsible section
  if (isFunctionGroup) {
    return (
      <div className="animate-fadeIn">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full text-left group hover:bg-gray-50 rounded-lg px-3 py-2 -mx-3 transition-colors duration-150"
        >
          <div className="flex items-center gap-3">
            {/* Minimal icon */}
            <div className={`
              w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all duration-200
              ${step.status === 'complete' ? 'bg-gray-900 text-white' : ''}
              ${step.status === 'in_progress' ? 'bg-gray-200' : ''}
              ${step.status === 'error' ? 'bg-red-100 text-red-600' : ''}
            `}>
              {step.status === 'complete' && (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {step.status === 'in_progress' && (
                <div className="flex gap-0.5">
                  <div className="w-1 h-1 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1s' }} />
                  <div className="w-1 h-1 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '150ms', animationDuration: '1s' }} />
                  <div className="w-1 h-1 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '300ms', animationDuration: '1s' }} />
                </div>
              )}
              {step.status === 'error' && (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>

            <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
              {step.title}
            </span>

            <svg
              className={`w-4 h-4 text-gray-400 ml-auto transition-transform duration-200 ${
                isExpanded ? 'rotate-180' : ''
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {/* Expanded function list */}
        {isExpanded && step.functions && step.functions.length > 0 && (
          <div className="mt-2 ml-8 space-y-2 pb-3">
            {step.functions.map((func) => (
              <div key={func.id} className="text-sm pl-3 border-l border-gray-200">
                <div className="flex items-start gap-2">
                  <div className={`
                    w-4 h-4 rounded flex items-center justify-center flex-shrink-0 mt-0.5
                    ${func.status === 'complete' ? 'bg-gray-100' : 'bg-gray-50'}
                  `}>
                    {func.status === 'complete' ? (
                      <svg className="w-2.5 h-2.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-700 font-medium">{func.title}</div>
                    {func.description && (
                      <div className="text-gray-500 text-xs mt-0.5 leading-relaxed">{func.description}</div>
                    )}
                    {func.status === 'complete' && func.result && (
                      <ResultSummary result={func.result} />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Regular step rendering (message, complete, error)
  return (
    <div className="animate-fadeIn">
      {isMessage ? (
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded bg-gray-900 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 mb-2">Assistant</div>
              <div className="text-sm text-gray-700 leading-relaxed">
                {step.description && <MarkdownRenderer content={step.description} />}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 px-3 py-2">
          <div className={`
            w-5 h-5 rounded flex items-center justify-center flex-shrink-0
            ${step.status === 'complete' ? 'bg-gray-900 text-white' : ''}
            ${step.status === 'error' ? 'bg-red-100 text-red-600' : ''}
          `}>
            {step.status === 'complete' && (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {step.status === 'error' && (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
          <div className="text-sm font-medium text-gray-700">{step.title}</div>
        </div>
      )}
    </div>
  );
};

const ResultSummary: React.FC<{ result: any }> = ({ result }) => {
  if (!result.success) {
    return (
      <div className="mt-2 text-xs text-red-600 bg-red-50 rounded px-2 py-1 border border-red-100">
        {result.error || 'Operation failed'}
      </div>
    );
  }

  // Show different summaries based on result type
  if (result.persona) {
    return (
      <div className="mt-2 text-xs text-gray-600">
        <span className="font-medium text-gray-900">{result.persona.spec?.firstName || result.persona.metadata?.name}</span>
      </div>
    );
  }

  if (result.problem) {
    return (
      <div className="mt-2 text-xs text-gray-600">
        <span className="font-medium text-gray-900">{result.problem.metadata?.name}</span>
      </div>
    );
  }

  if (result.behaviour) {
    return (
      <div className="mt-2 text-xs text-gray-600">
        <span className="font-medium text-gray-900">{result.behaviour.metadata?.name}</span>
      </div>
    );
  }

  if (result.count !== undefined) {
    return (
      <div className="mt-2 text-xs text-gray-500">
        {result.count} {result.count === 1 ? 'match' : 'matches'} found
      </div>
    );
  }

  if (result.score !== undefined) {
    return (
      <div className="mt-2 text-xs text-gray-500">
        Match score: <span className="font-medium text-gray-700">{result.score}%</span>
      </div>
    );
  }

  return null;
};

// SVG Icons with white colors for colored backgrounds
const MessageIcon = () => (
  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
    />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
);

const ThinkingDotsIcon = () => (
  <div className="flex items-center justify-center gap-1">
    <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1.4s' }} />
    <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '200ms', animationDuration: '1.4s' }} />
    <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '400ms', animationDuration: '1.4s' }} />
  </div>
);

const ErrorIcon = () => (
  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2.5}
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
);

const PendingIcon = () => (
  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-fadeIn {
    animation: fadeIn 0.4s ease-out forwards;
  }

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

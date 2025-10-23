/**
 * AI Wizard Screen
 * AI-powered LEIA creation with conversational interface
 */

import React, { useState } from 'react';
import { useWizardSSE } from '../hooks/useWizardSSE';
import { AgentTimeline } from '../components/AgentTimeline';
import { LeiaPreview } from '../components/LeiaPreview';

export const AIWizard: React.FC = () => {
  const { state, createSession, sendMessage, reset } = useWizardSSE();
  const [userInput, setUserInput] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim()) return;

    if (!state.sessionId) {
      // Create new session
      await createSession(userInput);
    } else {
      // Send refinement message
      await sendMessage(userInput);
    }

    setUserInput('');
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to start over? This will discard the current progress.')) {
      reset();
      setUserInput('');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header - Minimal */}
      <div className="flex-shrink-0 border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">LEIA Wizard</h1>
          {state.sessionId && (
            <button
              onClick={handleReset}
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              New chat
            </button>
          )}
        </div>
      </div>

      {/* Main Content - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-8">
          {/* Empty State */}
          {state.events.length === 0 && !state.sessionId && (
            <div className="text-center py-20">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Create a LEIA with AI</h2>
              <p className="text-gray-600 max-w-md mx-auto">
                Describe what you want to create and I'll help you build a complete learning experience
              </p>
            </div>
          )}

          {/* Timeline */}
          {state.events.length > 0 && (
            <div className="space-y-6">
              <AgentTimeline events={state.events} />
            </div>
          )}

          {/* Error */}
          {state.error && !state.error.includes('Connection error') && (
            <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg">
              <p className="text-sm text-red-800">{state.error}</p>
            </div>
          )}

          {/* LEIA Preview when complete */}
          {state.isComplete && state.leia && (
            <LeiaPreview leia={state.leia} />
          )}
        </div>
      </div>

      {/* Input Form - Fixed at bottom with gradient */}
      <div className="flex-shrink-0 relative">
        {/* Gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white via-white to-transparent pointer-events-none"></div>

        <div className="relative max-w-3xl mx-auto px-4 py-6">
          <form onSubmit={handleSubmit}>
            <div className="relative">
              <textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="Message LEIA Wizard..."
                rows={1}
                disabled={state.isConnected && !state.isComplete}
                className="w-full px-6 py-4 pr-14 bg-white border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed resize-none shadow-lg transition-shadow hover:shadow-xl"
                style={{ minHeight: '56px', maxHeight: '200px' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 200) + 'px';
                }}
              />
              <button
                type="submit"
                disabled={!userInput.trim() || (state.isConnected && !state.isComplete)}
                className="absolute right-3 bottom-4 w-10 h-10 flex items-center justify-center text-white bg-gray-900 rounded-full hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all disabled:hover:bg-gray-900 shadow-md"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

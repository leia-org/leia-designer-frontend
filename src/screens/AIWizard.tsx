/**
 * AI Wizard Screen
 * AI-powered LEIA creation with conversational interface
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWizardSSE } from '../hooks/useWizardSSE';
import { AgentTimeline } from '../components/AgentTimeline';

export const AIWizard: React.FC = () => {
  const navigate = useNavigate();
  const { state, createSession, sendMessage, saveLeia, reset } = useWizardSSE();
  const [userInput, setUserInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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

  const handleSave = async () => {
    if (!state.isComplete) return;

    setIsSaving(true);
    try {
      const result = await saveLeia();
      console.log('LEIA saved:', result);

      // Navigate to the LEIA details or catalog
      navigate('/leias');
    } catch (error: any) {
      console.error('Error saving LEIA:', error);
      alert(error.message || 'Failed to save LEIA');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to start over? This will discard the current progress.')) {
      reset();
      setUserInput('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">AI LEIA Wizard</h1>
              <p className="mt-1 text-sm text-gray-600">
                Describe what you want to create, and I'll help you build a complete LEIA
              </p>
            </div>
            {state.sessionId && (
              <button
                onClick={handleReset}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Start Over
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Timeline */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Agent Progress</h2>

              {state.events.length === 0 && !state.sessionId && (
                <div className="text-center py-12">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No activity yet</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Describe what you want to create to get started
                  </p>
                </div>
              )}

              {state.events.length > 0 && <AgentTimeline events={state.events} />}

              {state.error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex">
                    <svg
                      className="h-5 w-5 text-red-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">Error</h3>
                      <p className="mt-1 text-sm text-red-700">{state.error}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: LEIA Preview */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6 sticky top-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">LEIA Components</h2>

              {/* Persona */}
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Persona</h3>
                {state.leia?.persona ? (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                    <div className="text-sm font-medium text-green-900">
                      {state.leia.persona.spec?.firstName || state.leia.persona.metadata?.name}
                    </div>
                    <div className="text-xs text-green-700 mt-1">
                      {state.leia.persona.spec?.description}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-gray-100 border border-gray-200 rounded-md text-sm text-gray-500">
                    Not generated yet
                  </div>
                )}
              </div>

              {/* Problem */}
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Problem</h3>
                {state.leia?.problem ? (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                    <div className="text-sm font-medium text-green-900">
                      {state.leia.problem.metadata?.name}
                    </div>
                    <div className="text-xs text-green-700 mt-1 line-clamp-2">
                      {state.leia.problem.spec?.description}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-gray-100 border border-gray-200 rounded-md text-sm text-gray-500">
                    Not generated yet
                  </div>
                )}
              </div>

              {/* Behaviour */}
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Behaviour</h3>
                {state.leia?.behaviour ? (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                    <div className="text-sm font-medium text-green-900">
                      {state.leia.behaviour.metadata?.name}
                    </div>
                    <div className="text-xs text-green-700 mt-1 line-clamp-2">
                      {state.leia.behaviour.spec?.description}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-gray-100 border border-gray-200 rounded-md text-sm text-gray-500">
                    Not generated yet
                  </div>
                )}
              </div>

              {/* Save Button */}
              {state.isComplete && (
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full mt-4 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Saving...' : 'Save LEIA'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Input Form (Fixed at bottom) */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <form onSubmit={handleSubmit} className="flex gap-4">
              <textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder={
                  state.sessionId
                    ? 'Send a message to refine the LEIA...'
                    : 'Describe the LEIA you want to create (e.g., "Create a socratic teacher for teaching Python to beginners")...'
                }
                rows={2}
                disabled={state.isConnected && !state.isComplete}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />
              <button
                type="submit"
                disabled={!userInput.trim() || (state.isConnected && !state.isComplete)}
                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {state.sessionId ? 'Send' : 'Start'}
              </button>
            </form>
            <p className="mt-2 text-xs text-gray-500 text-center">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </div>

        {/* Bottom padding to prevent content being hidden by fixed input */}
        <div className="h-32"></div>
      </div>
    </div>
  );
};

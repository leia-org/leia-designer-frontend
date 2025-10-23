/**
 * LEIA Preview Component
 * Shows the generated LEIA components in a clean, organized view
 */

import React, { useState } from 'react';

interface LeiaPreviewProps {
  leia: {
    persona: any;
    problem: any;
    behaviour: any;
  };
}

type ComponentType = 'persona' | 'problem' | 'behaviour';

export const LeiaPreview: React.FC<LeiaPreviewProps> = ({ leia }) => {
  const [selectedComponent, setSelectedComponent] = useState<ComponentType>('persona');

  const components = {
    persona: {
      title: 'Persona',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      data: leia.persona,
    },
    problem: {
      title: 'Problem',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
      data: leia.problem,
    },
    behaviour: {
      title: 'Behaviour',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      data: leia.behaviour,
    },
  };

  const currentComponent = components[selectedComponent];

  return (
    <div className="mt-6 border border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">Generated LEIA</h3>
        <p className="text-xs text-gray-600 mt-0.5">
          {leia.persona?.metadata?.name || 'Untitled LEIA'}
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 bg-white">
        <div className="flex">
          {(Object.keys(components) as ComponentType[]).map((key) => (
            <button
              key={key}
              onClick={() => setSelectedComponent(key)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                selectedComponent === key
                  ? 'text-gray-900 border-b-2 border-gray-900'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {components[key].icon}
              {components[key].title}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 bg-white max-h-96 overflow-y-auto">
        {currentComponent.data ? (
          <div className="space-y-4">
            {/* Metadata */}
            {currentComponent.data.metadata && (
              <div>
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                  Metadata
                </h4>
                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  {Object.entries(currentComponent.data.metadata).map(([key, value]) => (
                    <div key={key} className="flex text-sm">
                      <span className="font-medium text-gray-700 min-w-24">{key}:</span>
                      <span className="text-gray-900 ml-2">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Spec */}
            {currentComponent.data.spec && (
              <div>
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                  Specification
                </h4>
                <div className="bg-gray-50 rounded-lg p-3">
                  <pre className="text-xs text-gray-900 whitespace-pre-wrap font-mono">
                    {JSON.stringify(currentComponent.data.spec, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Raw Data (fallback) */}
            {!currentComponent.data.metadata && !currentComponent.data.spec && (
              <div>
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                  Data
                </h4>
                <div className="bg-gray-50 rounded-lg p-3">
                  <pre className="text-xs text-gray-900 whitespace-pre-wrap font-mono">
                    {JSON.stringify(currentComponent.data, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 text-sm">
            No data available for {currentComponent.title}
          </div>
        )}
      </div>
    </div>
  );
};

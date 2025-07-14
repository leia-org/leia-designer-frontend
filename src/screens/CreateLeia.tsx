import React, { useState } from 'react';
import { Editor } from '@monaco-editor/react';
import { LeiaCard } from '../components/LeiaCard';
import { CreateSidebar } from '../components/CreateSidebar';
import { SelectionColumn } from '../components/shared/SelectionColumn';

interface LeiaItem {
  kind: string;
  apiVersion: string;
  metadata: {
    name: string;
    version: string;
  };
  spec: {
    description?: string;
    fullName?: string;
    [key: string]: any;
  };
}

interface LeiaConfig {
  persona: LeiaItem | null;
  problem: LeiaItem | null;
  behaviour: LeiaItem | null;
}

// Datos de ejemplo
const samplePersonas: LeiaItem[] = [
  {
    kind: 'persona',
    apiVersion: 'v1',
    metadata: {
      name: 'john-experienced',
      version: '1.0.0'
    },
    spec: {
      fullName: 'John Smith',
      description: 'A seasoned individual in his mid-50s. He is straightforward, practical, and clear in his approach.'
    }
  },
  {
    kind: 'persona',
    apiVersion: 'v1',
    metadata: {
      name: 'sarah-developer',
      version: '1.0.0'
    },
    spec: {
      fullName: 'Sarah Johnson',
      description: 'A senior software developer with 8 years of experience in web development. She is detail-oriented, innovative, and passionate about clean code.'
    }
  },
  {
    kind: 'persona',
    apiVersion: 'v1',
    metadata: {
      name: 'mike-manager',
      version: '1.0.0'
    },
    spec: {
      fullName: 'Mike Rodriguez',
      description: 'A project manager with 10 years of experience leading technical teams. He focuses on deadlines and business value.'
    }
  }
];

const sampleProblems: LeiaItem[] = [
  {
    kind: 'problem',
    apiVersion: 'v1',
    metadata: {
      name: 'tickets',
      version: '1.0.0'
    },
    spec: {
      description: 'You have been hired to gather the requirements for an online ticket platform.'
    }
  },
  {
    kind: 'problem',
    apiVersion: 'v1',
    metadata: {
      name: 'e-commerce-platform',
      version: '1.0.0'
    },
    spec: {
      description: 'Design and implement a modern e-commerce platform with focus on user experience'
    }
  },
  {
    kind: 'problem',
    apiVersion: 'v1',
    metadata: {
      name: 'mobile-app',
      version: '1.0.0'
    },
    spec: {
      description: 'Create a mobile application for task management with real-time synchronization'
    }
  }
];

const sampleBehaviours: LeiaItem[] = [
  {
    kind: 'behaviour',
    apiVersion: 'v1',
    metadata: {
      name: 'customer-information-requirements-interview',
      version: '1.0.0'
    },
    spec: {
      description: 'Requirements elicitation interview simulation for gathering customer information.'
    }
  },
  {
    kind: 'behaviour',
    apiVersion: 'v1',
    metadata: {
      name: 'technical-requirements-gathering',
      version: '1.0.0'
    },
    spec: {
      description: 'Technical requirements gathering session for a new software project'
    }
  },
  {
    kind: 'behaviour',
    apiVersion: 'v1',
    metadata: {
      name: 'user-story-workshop',
      version: '1.0.0'
    },
    spec: {
      description: 'Interactive workshop for creating and refining user stories with stakeholders'
    }
  }
];

const exampleTemplates = {
  persona: {
    kind: 'persona',
    apiVersion: 'v1',
    metadata: {
      name: 'new-persona',
      version: '1.0.0'
    },
    spec: {
      fullName: 'New Persona',
      description: 'A new persona template for creating custom personas.',
      traits: [
        'Detail-oriented',
        'Problem solver',
        'Team player'
      ],
      background: 'Custom background information',
      expertise: 'Custom expertise areas'
    }
  },
  problem: {
    kind: 'problem',
    apiVersion: 'v1',
    metadata: {
      name: 'new-problem',
      version: '1.0.0'
    },
    spec: {
      description: 'A new problem template for creating custom problems',
      context: 'Custom problem context',
      objectives: [
        'Custom objective 1',
        'Custom objective 2'
      ],
      constraints: [
        'Custom constraint 1',
        'Custom constraint 2'
      ]
    }
  },
  behaviour: {
    kind: 'behaviour',
    apiVersion: 'v1',
    metadata: {
      name: 'new-behaviour',
      version: '1.0.0'
    },
    spec: {
      description: 'A new behaviour template for creating custom behaviours',
      approach: 'Custom approach description',
      topics: [
        'Custom topic 1',
        'Custom topic 2'
      ],
      expectedOutcomes: [
        'Custom outcome 1',
        'Custom outcome 2'
      ]
    }
  }
} as const;

export const CreateLeia: React.FC = () => {
  const [leiaConfig, setLeiaConfig] = useState<LeiaConfig>({
    persona: null,
    problem: null,
    behaviour: null
  });

  const [createSidebar, setCreateSidebar] = useState<{
    isOpen: boolean;
    type: keyof LeiaConfig | null;
    yaml: string;
  }>({
    isOpen: false,
    type: null,
    yaml: ''
  });

  const generateLeiaYaml = () => {
    if (!leiaConfig.persona || !leiaConfig.problem || !leiaConfig.behaviour) return '';
    
    return `kind: leia
apiVersion: v1
metadata:
  name: "${leiaConfig.problem.metadata.name}"
  version: "1.0.0"
spec:
  persona:
    name: "${leiaConfig.persona.metadata.name}"
    version: "${leiaConfig.persona.metadata.version}"
  problem:
    name: "${leiaConfig.problem.metadata.name}"
    version: "${leiaConfig.problem.metadata.version}"
  behaviour:
    name: "${leiaConfig.behaviour.metadata.name}"
    version: "${leiaConfig.behaviour.metadata.version}"`;
  };

  const generateItemYaml = (item: LeiaItem | null) => {
    if (!item) return '';
    return `kind: ${item.kind}
apiVersion: ${item.apiVersion}
metadata:
  name: "${item.metadata.name}"
  version: "${item.metadata.version}"
spec:
  ${Object.entries(item.spec)
    .map(([key, value]) => `${key}: "${value}"`)
    .join('\n  ')}`;
  };

  const handleSelect = (type: keyof LeiaConfig, item: LeiaItem) => {
    setLeiaConfig(prev => ({
      ...prev,
      [type]: item
    }));
  };

  const handleCreateNew = (type: keyof LeiaConfig) => {
    const template = exampleTemplates[type];
    setCreateSidebar({
      isOpen: true,
      type,
      yaml: generateItemYaml(template)
    });
  };

  const handleSaveNewItem = (yamlString: string) => {
    try {
      const newItem = JSON.parse(yamlString) as LeiaItem;
      if (createSidebar.type) {
        handleSelect(createSidebar.type, newItem);
      }
    } catch (error) {
      console.error('Invalid YAML:', error);
    }
  };

  const handleTestLeia = () => {
    localStorage.setItem('leiaConfig', JSON.stringify(leiaConfig));
    window.location.href = '/chat';
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Crear LEIA
              </h1>
              <p className="mt-2 text-gray-600">
                Configura tu LEIA seleccionando una Persona, un Problema y un Comportamiento
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`h-3 w-3 rounded-full ${leiaConfig.persona ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className={`text-sm ${leiaConfig.persona ? 'text-green-600 font-medium' : 'text-gray-600'}`}>
                  {leiaConfig.persona ? '✓ Persona' : 'Persona'}
                </span>
              </div>
              <div className={`h-px w-8 ${leiaConfig.persona ? 'bg-green-300' : 'bg-gray-300'}`} />
              <div className="flex items-center space-x-2">
                <div className={`h-3 w-3 rounded-full ${leiaConfig.problem ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className={`text-sm ${leiaConfig.problem ? 'text-green-600 font-medium' : 'text-gray-600'}`}>
                  {leiaConfig.problem ? '✓ Problema' : 'Problema'}
                </span>
              </div>
              <div className={`h-px w-8 ${leiaConfig.problem ? 'bg-green-300' : 'bg-gray-300'}`} />
              <div className="flex items-center space-x-2">
                <div className={`h-3 w-3 rounded-full ${leiaConfig.behaviour ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className={`text-sm ${leiaConfig.behaviour ? 'text-green-600 font-medium' : 'text-gray-600'}`}>
                  {leiaConfig.behaviour ? '✓ Comportamiento' : 'Comportamiento'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - 3 Columns */}
      <div className="flex flex-1 h-[calc(100vh-136px)]">
        {/* Columna 1: Behaviour */}
        <div className="w-1/3">
          <div className={`h-full ${leiaConfig.behaviour ? 'ring-2 ring-green-500 ring-opacity-50' : ''}`}>
            <SelectionColumn
              title="Comportamiento"
              items={sampleBehaviours}
              selectedItem={leiaConfig.behaviour}
              onSelect={(item) => handleSelect('behaviour', item)}
              onCreateNew={() => handleCreateNew('behaviour')}
              placeholder="Buscar comportamientos..."
            />
          </div>
        </div>

        {/* Columna 2: Problem */}
        <div className="w-1/3">
          <div className={`h-full ${leiaConfig.problem ? 'ring-2 ring-green-500 ring-opacity-50' : ''}`}>
            <SelectionColumn
              title="Problema"
              items={sampleProblems}
              selectedItem={leiaConfig.problem}
              onSelect={(item) => handleSelect('problem', item)}
              onCreateNew={() => handleCreateNew('problem')}
              placeholder="Buscar problemas..."
            />
          </div>
        </div>

        {/* Columna 3: Persona */}
        <div className="w-1/3">
          <div className={`h-full ${leiaConfig.persona ? 'ring-2 ring-green-500 ring-opacity-50' : ''}`}>
            <SelectionColumn
              title="Persona"
              items={samplePersonas}
              selectedItem={leiaConfig.persona}
              onSelect={(item) => handleSelect('persona', item)}
              onCreateNew={() => handleCreateNew('persona')}
              placeholder="Buscar personas..."
            />
          </div>
        </div>
      </div>

      {/* Preview Panel - Fixed at bottom */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="container mx-auto">
                      <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Vista Previa de LEIA</h2>
              {leiaConfig.persona && leiaConfig.problem && leiaConfig.behaviour ? (
                <button
                  onClick={handleTestLeia}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Probar LEIA
                </button>
              ) : (
                <div className="text-sm text-gray-500 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  Faltan {3 - [leiaConfig.persona, leiaConfig.problem, leiaConfig.behaviour].filter(Boolean).length} elementos para probar LEIA
                </div>
              )}
            </div>
          <div className="grid grid-cols-3 gap-6">
            <div className="p-4 rounded-lg bg-gray-50 border">
              <h4 className="font-medium text-gray-900 mb-2">Comportamiento</h4>
              <p className="text-sm text-gray-600">
                {leiaConfig.behaviour?.spec.fullName || leiaConfig.behaviour?.metadata.name || 'No seleccionado'}
              </p>
              {leiaConfig.behaviour && (
                <p className="text-xs text-gray-500 mt-1">{leiaConfig.behaviour.spec.description}</p>
              )}
            </div>
            <div className="p-4 rounded-lg bg-gray-50 border">
              <h4 className="font-medium text-gray-900 mb-2">Problema</h4>
              <p className="text-sm text-gray-600">
                {leiaConfig.problem?.metadata.name || 'No seleccionado'}
              </p>
              {leiaConfig.problem && (
                <p className="text-xs text-gray-500 mt-1">{leiaConfig.problem.spec.description}</p>
              )}
            </div>
            <div className="p-4 rounded-lg bg-gray-50 border">
              <h4 className="font-medium text-gray-900 mb-2">Persona</h4>
              <p className="text-sm text-gray-600">
                {leiaConfig.persona?.spec.fullName || leiaConfig.persona?.metadata.name || 'No seleccionado'}
              </p>
              {leiaConfig.persona && (
                <p className="text-xs text-gray-500 mt-1">{leiaConfig.persona.spec.description}</p>
              )}
            </div>
          </div>
          
          {/* YAML Preview */}
          <div className="mt-6">
            <h3 className="text-md font-semibold mb-2">YAML Generado</h3>
            <div className="h-48 border rounded-lg overflow-hidden">
              <Editor
                height="100%"
                language="yaml"
                theme="vs-dark"
                value={generateLeiaYaml()}
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 12,
                  lineNumbers: 'on',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <CreateSidebar
        isOpen={createSidebar.isOpen}
        onClose={() => setCreateSidebar({ isOpen: false, type: null, yaml: '' })}
        title={`Crear Nuevo ${createSidebar.type ? createSidebar.type.charAt(0).toUpperCase() + createSidebar.type.slice(1) : ''}`}
        yaml={createSidebar.yaml}
        onSave={handleSaveNewItem}
      />
    </div>
  );
}; 
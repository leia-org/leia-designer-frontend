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

type WizardStep = 1 | 2 | 3;

export const CreateLeia: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [leiaConfig, setLeiaConfig] = useState<LeiaConfig>({
    persona: null,
    problem: null,
    behaviour: null
  });

  const [editingItem, setEditingItem] = useState<{
    type: keyof LeiaConfig | null;
    item: LeiaItem | null;
  }>({
    type: null,
    item: null
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

  const [customizations, setCustomizations] = useState<{
    persona: { name: string; description: string };
    problem: { name: string; description: string };
    behaviour: { name: string; description: string };
  }>({
    persona: { name: '', description: '' },
    problem: { name: '', description: '' },
    behaviour: { name: '', description: '' }
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

  const handleEditItem = (type: keyof LeiaConfig) => {
    const item = leiaConfig[type];
    if (item) {
      setEditingItem({ type, item });
      
      // Generate YAML for the specific item being edited
      const itemYaml = `kind: ${item.kind}
apiVersion: ${item.apiVersion}
metadata:
  name: "${item.metadata.name}"
  version: "${item.metadata.version}"
spec:
  ${Object.entries(item.spec)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}:\n    ${value.map(v => `- "${v}"`).join('\n    ')}`;
      } else if (typeof value === 'string') {
        return `${key}: "${value}"`;
      } else {
        return `${key}: ${JSON.stringify(value)}`;
      }
    })
    .join('\n  ')}`;
      
      setCreateSidebar({
        isOpen: true,
        type,
        yaml: itemYaml
      });
    }
  };

  const handleTestLeia = () => {
    localStorage.setItem('leiaConfig', JSON.stringify(leiaConfig));
    window.location.href = '/chat';
  };

  const handleNextStep = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1 as WizardStep);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1 as WizardStep);
    }
  };

  const isStep1Complete = leiaConfig.persona && leiaConfig.problem && leiaConfig.behaviour;
  const isStep2Complete = true; // Siempre se puede avanzar del paso 2
  const isStep3Complete = Object.values(customizations).some(c => c.name || c.description);

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center space-x-8 mb-8">
      <div className="flex items-center space-x-2">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
          currentStep >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
        }`}>
          1
        </div>
        <span className={`text-sm font-medium ${currentStep >= 1 ? 'text-blue-600' : 'text-gray-600'}`}>
          Selection
        </span>
      </div>
      <div className={`h-px w-12 ${currentStep >= 2 ? 'bg-blue-300' : 'bg-gray-300'}`} />
      <div className="flex items-center space-x-2">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
          currentStep >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
        }`}>
          2
        </div>
        <span className={`text-sm font-medium ${currentStep >= 2 ? 'text-blue-600' : 'text-gray-600'}`}>
          Edit
        </span>
      </div>
      <div className={`h-px w-12 ${currentStep >= 3 ? 'bg-blue-300' : 'bg-gray-300'}`} />
      <div className="flex items-center space-x-2">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
          currentStep >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
        }`}>
          3
        </div>
        <span className={`text-sm font-medium ${currentStep >= 3 ? 'text-blue-600' : 'text-gray-600'}`}>
          Customize
        </span>
      </div>
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Step 1: Select Components</h2>
        <p className="text-gray-600">Choose a persona, problem, and behavior for your LEIA</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Columna 1: Behaviour */}
        <div className={`h-full ${leiaConfig.behaviour ? 'ring-2 ring-green-500 ring-opacity-50' : ''}`}>
          <SelectionColumn
            title="Behavior"
            items={sampleBehaviours}
            selectedItem={leiaConfig.behaviour}
            onSelect={(item) => handleSelect('behaviour', item)}
            onCreateNew={() => handleCreateNew('behaviour')}
            placeholder="Search behaviors..."
          />
        </div>

        {/* Columna 2: Problem */}
        <div className={`h-full ${leiaConfig.problem ? 'ring-2 ring-green-500 ring-opacity-50' : ''}`}>
          <SelectionColumn
            title="Problem"
            items={sampleProblems}
            selectedItem={leiaConfig.problem}
            onSelect={(item) => handleSelect('problem', item)}
            onCreateNew={() => handleCreateNew('problem')}
            placeholder="Search problems..."
          />
        </div>

        {/* Columna 3: Persona */}
        <div className={`h-full ${leiaConfig.persona ? 'ring-2 ring-green-500 ring-opacity-50' : ''}`}>
          <SelectionColumn
            title="Persona"
            items={samplePersonas}
            selectedItem={leiaConfig.persona}
            onSelect={(item) => handleSelect('persona', item)}
            onCreateNew={() => handleCreateNew('persona')}
            placeholder="Search personas..."
          />
        </div>
      </div>

      {/* Vista previa */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">LEIA Preview</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-2">Behavior</h4>
            <p className="text-sm text-gray-600">
              {leiaConfig.behaviour?.spec.fullName || leiaConfig.behaviour?.metadata.name || 'Not selected'}
            </p>
            {leiaConfig.behaviour && (
              <p className="text-xs text-gray-500 mt-1">{leiaConfig.behaviour.spec.description}</p>
            )}
          </div>
          <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-2">Problem</h4>
            <p className="text-sm text-gray-600">
              {leiaConfig.problem?.metadata.name || 'Not selected'}
            </p>
            {leiaConfig.problem && (
              <p className="text-xs text-gray-500 mt-1">{leiaConfig.problem.spec.description}</p>
            )}
          </div>
          <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-2">Persona</h4>
            <p className="text-sm text-gray-600">
              {leiaConfig.persona?.spec.fullName || leiaConfig.persona?.metadata.name || 'Not selected'}
            </p>
            {leiaConfig.persona && (
              <p className="text-xs text-gray-500 mt-1">{leiaConfig.persona.spec.description}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Step 2: Edit and Customize</h2>
        <p className="text-gray-600">Modify any of the components and see changes in real-time</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Columna 1: Behaviour */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Behavior</h3>
            {leiaConfig.behaviour ? (
              <div className="space-y-3">
                <div className="p-3 bg-gray-50 rounded border border-gray-200">
                  <p className="text-sm font-medium">{leiaConfig.behaviour.spec.fullName || leiaConfig.behaviour.metadata.name}</p>
                  <p className="text-xs text-gray-600 mt-1">{leiaConfig.behaviour.spec.description}</p>
                </div>
                <button
                  onClick={() => handleEditItem('behaviour')}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  Edit Behavior
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Not selected</p>
            )}
          </div>
        </div>

        {/* Columna 2: Problem */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Problem</h3>
            {leiaConfig.problem ? (
              <div className="space-y-3">
                <div className="p-3 bg-gray-50 rounded border border-gray-200">
                  <p className="text-sm font-medium">{leiaConfig.problem.metadata.name}</p>
                  <p className="text-xs text-gray-600 mt-1">{leiaConfig.problem.spec.description}</p>
                </div>
                <button
                  onClick={() => handleEditItem('problem')}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  Edit Problem
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Not selected</p>
            )}
          </div>
        </div>

        {/* Columna 3: Persona */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Persona</h3>
            {leiaConfig.persona ? (
              <div className="space-y-3">
                <div className="p-3 bg-gray-50 rounded border border-gray-200">
                  <p className="text-sm font-medium">{leiaConfig.persona.spec.fullName || leiaConfig.persona.metadata.name}</p>
                  <p className="text-xs text-gray-600 mt-1">{leiaConfig.persona.spec.description}</p>
                </div>
                <button
                  onClick={() => handleEditItem('persona')}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  Edit Persona
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Not selected</p>
            )}
          </div>
        </div>
      </div>

      {/* Vista previa en tiempo real */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Real-time Preview</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-2">Behavior</h4>
            <p className="text-sm text-gray-600">
              {leiaConfig.behaviour?.spec.fullName || leiaConfig.behaviour?.metadata.name || 'Not selected'}
            </p>
            {leiaConfig.behaviour && (
              <p className="text-xs text-gray-500 mt-1">{leiaConfig.behaviour.spec.description}</p>
            )}
          </div>
          <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-2">Problem</h4>
            <p className="text-sm text-gray-600">
              {leiaConfig.problem?.metadata.name || 'Not selected'}
            </p>
            {leiaConfig.problem && (
              <p className="text-xs text-gray-500 mt-1">{leiaConfig.problem.spec.description}</p>
            )}
          </div>
          <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-2">Persona</h4>
            <p className="text-sm text-gray-600">
              {leiaConfig.persona?.spec.fullName || leiaConfig.persona?.metadata.name || 'Not selected'}
            </p>
            {leiaConfig.persona && (
              <p className="text-xs text-gray-500 mt-1">{leiaConfig.persona.spec.description}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Step 3: Customize Names and Descriptions</h2>
        <p className="text-gray-600">Edit names and specifications to create your personalized version</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Comportamiento */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Behavior</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Custom Name</label>
              <input
                type="text"
                value={customizations.behaviour.name}
                onChange={(e) => setCustomizations(prev => ({
                  ...prev,
                  behaviour: { ...prev.behaviour, name: e.target.value }
                }))}
                placeholder={leiaConfig.behaviour?.metadata.name || "Behavior name"}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Custom Description</label>
              <textarea
                value={customizations.behaviour.description}
                onChange={(e) => setCustomizations(prev => ({
                  ...prev,
                  behaviour: { ...prev.behaviour, description: e.target.value }
                }))}
                placeholder={leiaConfig.behaviour?.spec.description || "Behavior description"}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Problema */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Problem</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Custom Name</label>
              <input
                type="text"
                value={customizations.problem.name}
                onChange={(e) => setCustomizations(prev => ({
                  ...prev,
                  problem: { ...prev.problem, name: e.target.value }
                }))}
                placeholder={leiaConfig.problem?.metadata.name || "Problem name"}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Custom Description</label>
              <textarea
                value={customizations.problem.description}
                onChange={(e) => setCustomizations(prev => ({
                  ...prev,
                  problem: { ...prev.problem, description: e.target.value }
                }))}
                placeholder={leiaConfig.problem?.spec.description || "Problem description"}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Persona */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Persona</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Custom Name</label>
              <input
                type="text"
                value={customizations.persona.name}
                onChange={(e) => setCustomizations(prev => ({
                  ...prev,
                  persona: { ...prev.persona, name: e.target.value }
                }))}
                placeholder={leiaConfig.persona?.spec.fullName || leiaConfig.persona?.metadata.name || "Persona name"}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Custom Description</label>
              <textarea
                value={customizations.persona.description}
                onChange={(e) => setCustomizations(prev => ({
                  ...prev,
                  persona: { ...prev.persona, description: e.target.value }
                }))}
                placeholder={leiaConfig.persona?.spec.description || "Persona description"}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Vista final */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Final LEIA Preview</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-2">Behavior</h4>
            <p className="text-sm text-gray-600">
              {customizations.behaviour.name || leiaConfig.behaviour?.spec.fullName || leiaConfig.behaviour?.metadata.name || 'Not selected'}
            </p>
            {(customizations.behaviour.description || leiaConfig.behaviour?.spec.description) && (
              <p className="text-xs text-gray-500 mt-1">
                {customizations.behaviour.description || leiaConfig.behaviour?.spec.description}
              </p>
            )}
          </div>
          <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-2">Problem</h4>
            <p className="text-sm text-gray-600">
              {customizations.problem.name || leiaConfig.problem?.metadata.name || 'Not selected'}
            </p>
            {(customizations.problem.description || leiaConfig.problem?.spec.description) && (
              <p className="text-xs text-gray-500 mt-1">
                {customizations.problem.description || leiaConfig.problem?.spec.description}
              </p>
            )}
          </div>
          <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-2">Persona</h4>
            <p className="text-sm text-gray-600">
              {customizations.persona.name || leiaConfig.persona?.spec.fullName || leiaConfig.persona?.metadata.name || 'Not selected'}
            </p>
            {(customizations.persona.description || leiaConfig.persona?.spec.description) && (
              <p className="text-xs text-gray-500 mt-1">
                {customizations.persona.description || leiaConfig.persona?.spec.description}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Create LEIA
              </h1>
              <p className="mt-2 text-gray-600">
                Create your own LEIA and test it!
              </p>
            </div>
            <div className="flex items-center space-x-4">
              {currentStep === 3 && isStep3Complete && (
                <button
                  onClick={handleTestLeia}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Test LEIA
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 container mx-auto px-6 py-8">
        {renderStepIndicator()}
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center mt-8">
          <button
            onClick={handlePrevStep}
            disabled={currentStep === 1}
            className={`px-6 py-2 rounded-lg transition-colors ${
              currentStep === 1
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-gray-600 text-white hover:bg-gray-700'
            }`}
          >
            Previous
          </button>

          <div className="flex items-center space-x-4">
            {currentStep === 1 && (
              <div className="text-sm text-gray-500">
                {isStep1Complete ? '✓ All elements selected' : 'Missing elements to select'}
              </div>
            )}
            {currentStep === 2 && (
              <div className="text-sm text-gray-500">
                ✓ You can edit components
              </div>
            )}
            {currentStep === 3 && (
              <div className="text-sm text-gray-500">
                {isStep3Complete ? '✓ Customization complete' : 'Customize names and descriptions'}
              </div>
            )}
          </div>

          <button
            onClick={handleNextStep}
            disabled={
              (currentStep === 1 && !isStep1Complete) ||
              (currentStep === 2 && !isStep2Complete) ||
              currentStep === 3
            }
            className={`px-6 py-2 rounded-lg transition-colors ${
              (currentStep === 1 && !isStep1Complete) ||
              (currentStep === 2 && !isStep2Complete) ||
              currentStep === 3
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {currentStep === 3 ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>

      <CreateSidebar
        isOpen={createSidebar.isOpen}
        onClose={() => setCreateSidebar({ isOpen: false, type: null, yaml: '' })}
        title={`Create New ${createSidebar.type ? createSidebar.type.charAt(0).toUpperCase() + createSidebar.type.slice(1) : ''}`}
        yaml={createSidebar.yaml}
        onSave={handleSaveNewItem}
      />
    </div>
  );
}; 
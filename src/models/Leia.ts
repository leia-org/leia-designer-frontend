import type { User } from "./User";

export interface Label {
  _id: string,
  name: string,
  color: string,
  secundaryColor: string,
  user: string,
  isGlobal: boolean,
}

export interface Persona {
  id: string,
  apiVersion: string,
  metadata: {
    name: string,
    version: string
  },
  spec: {
    avatar?: string,
    fullName: string,
    firstName: string,
    description: string,
    personality: string,
    subjectPronoum: string,
    objectPronoum: string,
    possesivePronoum: string,
    possesiveAdjective: string
  },
  isPublished: boolean,
  createdAt: string,
  updatedAt: string,
  edited?: boolean,
  user: User
}

export interface Behaviour {
  id: string,
  apiVersion: string,
  metadata: {
    name: string,
    version: string
  },
  spec: {
    description: string,
    role: string,
    process: [
      string
    ],
    tooltip?: string
  },
  isPublished: boolean,
  createdAt: string,
  updatedAt: string,
  edited?: boolean,
  user: User
}

export type WidgetSlot = "left" | "right" | "main";

// Per-tool usage guidance authored by the instructor. The tool's schema and
// base description live in code (the widget catalog); here we only reference
// it by name, optionally disable it, and add activity-specific guidance.
export interface ProblemWidgetTool {
  name: string,
  enabled?: boolean,
  usage?: string
}

export interface ProblemWidget {
  widgetType: string,
  slot?: WidgetSlot,
  params?: Record<string, unknown>,
  tools?: ProblemWidgetTool[]
}

export interface ProblemSpec {
  avatar?: string,
  description: string,
  personaBackground: string,
  details: string,
  solution: string,
  initialSolution: string,
  solutionFormat: string,
  process: [
    string
  ],
  evaluationPrompt?: string,
  extends: object,
  overrides: object,
  constrainedTo: object,
  widgets?: ProblemWidget[]
}

export interface Problem {
  id: string,
  apiVersion: string,
  metadata: {
    name: string,
    version: string
  },
  spec: ProblemSpec,
  isPublished: boolean,
  createdAt: string,
  updatedAt: string,
  edited?: boolean,
  user: User
}

export interface Leia {
  id: string,
  apiVersion: string,
  metadata: {
    labels: Label[];
    name: string,
    version: string,
    label?: Label | null
  },
  spec: {
    avatar?: string,
    infographic?: string,
    infographicSolution?: string,
    persona: {
      id: string,
      apiVersion: string,
      metadata: {
        name: string,
        version: string
      },
      spec: {
        avatar?: string,
        fullName: string,
        firstName: string,
        description: string,
        personality: string,
        subjectPronoum: string,
        objectPronoum: string,
        possesivePronoum: string,
        possesiveAdjective: string
      },
      createdAt: string,
      updatedAt: string,
      user: User
    },
    problem: {
      id: string,
      apiVersion: string,
      metadata: {
        name: string,
        version: string
      },
      spec: {
        avatar?: string,
        description: string,
        personaBackground: string,
        details: string,
        solution: string,
        initialSolution: string,
        solutionFormat: string,
        evaluationPrompt?: string,
        process: [
          string
        ],
        extends: object,
        overrides: object,
        constrainedTo: object,
        widgets?: ProblemWidget[]
      },
      createdAt: string,
      updatedAt: string,
      user: User
    },
    behaviour: {
      id: string,
      apiVersion: string,
      metadata: {
        name: string,
        version: string
      },
      spec: {
        description: string,
        role: string,
        process: [
          string
        ],
        tooltip?: string
      },
      createdAt: string,
      updatedAt: string,
      user: User
    }
  },
  isPublished: boolean,
  createdAt: string,
  updatedAt: string,
  user: User
}

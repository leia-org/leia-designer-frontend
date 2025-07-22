export interface Persona {
  id: string,
  apiVersion: string,
  metadata: {
    name: string,
    version: string
  },
  spec: {
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
  updatedAt: string
}

export interface Behavior {
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
    ]
  },
  createdAt: string,
  updatedAt: string
}

export interface Problem {
  id: string,
  apiVersion: string,
  metadata: {
    name: string,
    version: string
  },
  spec: {
    description: string,
    personaBackground: string,
    details: string,
    solution: string,
    solutionFormat: string,
    process: [
      string
    ],
    extends: object,
    overrides: object,
    constrainedTo: object
  },
  createdAt: string,
  updatedAt: string
}

export interface Leia {
  id: string,
  apiVersion: string,
  metadata: {
    name: string,
    version: string
  },
  spec: {
    persona: {
      id: string,
      apiVersion: string,
      metadata: {
        name: string,
        version: string
      },
      spec: {
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
      updatedAt: string
    },
    problem: {
      id: string,
      apiVersion: string,
      metadata: {
        name: string,
        version: string
      },
      spec: {
        description: string,
        personaBackground: string,
        details: string,
        solution: string,
        solutionFormat: string,
        process: [
          string
        ],
        extends: object,
        overrides: object,
        constrainedTo: object
      },
      createdAt: string,
      updatedAt: string
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
        ]
      },
      createdAt: string,
      updatedAt: string
    }
  },
  createdAt: string,
  updatedAt: string
}
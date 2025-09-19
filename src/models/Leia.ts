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
  updatedAt: string,
  edited?: boolean,
  userId: string
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
    ]
  },
  createdAt: string,
  updatedAt: string,
  edited?: boolean,
  userId: string
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
  updatedAt: string,
  edited?: boolean,
  userId: string
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
      updatedAt: string,
      userId: string
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
      updatedAt: string,
      userId: string
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
      updatedAt: string,
      userId: string
    }
  },
  createdAt: string,
  updatedAt: string,
  userId: string
}
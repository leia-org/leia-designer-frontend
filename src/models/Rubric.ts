export interface RubricDefinition {
  apiVersion: "v1";
  metadata: {
    name: string;
  };
  spec: {
    markdown: string;
  };
}

export interface Rubric extends RubricDefinition {
  _id: string;
  createdAt: string;
  updatedAt: string;
}

export interface RubricSnapshot extends RubricDefinition {
  _id?: string;
}

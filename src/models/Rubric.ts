export interface Rubric {
  _id: string;
  apiVersion: "v1";
  metadata: {
    name: string;
  };
  spec: {
    markdown: string;
  };
  createdAt: string;
  updatedAt: string;
}

export type RubricSnapshot = Pick<Rubric, "_id" | "apiVersion" | "metadata" | "spec">;

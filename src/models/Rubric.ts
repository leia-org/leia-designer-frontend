export interface RubricDescriptor { level: string; description: string }
export interface RubricCriterion { name: string; descriptors: RubricDescriptor[] }
export interface RubricSection {
  title: string;
  weight: number;
  levels: string[];
  criteria: RubricCriterion[];
}
export interface RubricSpec { sections: RubricSection[] }
export interface RubricDefinition {
  apiVersion: "v1";
  metadata: { name: string };
  spec: RubricSpec;
}
export interface Rubric extends RubricDefinition { _id: string; createdAt: string; updatedAt: string }
export interface RubricSnapshot extends RubricDefinition { _id?: string }

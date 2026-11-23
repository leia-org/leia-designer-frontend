import type { Leia } from "./Leia";
import type { User } from "./User";

export interface Experiment {
  id: string;
  name: string;
  isPublished: boolean;
  leias: LeiaConfig[];
  stages: ActivityStage[];
  user: User | string;
  createdAt: string;
  updatedAt: string;
}

export type StageOutput = "conversation" | "submitedSolution";

export interface StageOutputSources {
  conversation?: string | null;
  submitedSolution?: string | null;
}

export interface ActivityStage {
  id: string;
  outputSources?: StageOutputSources;
  orchestration: ActivityOrchestration;
}

export interface ActivityOrchestration {
  mode: "single" | "multi";
  maxInternalTurns: number;
  openingLeiaId: string | null;
  problemLeiaId: string | null;
  sharedTask: string;
}

export interface LeiaConfig {
  id: string;
  stageId: string;
  leia: Leia | string;
  configuration: {
    mode: string;
    data: Record<string, unknown>;
  };
}

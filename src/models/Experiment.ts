import type { Leia } from "./Leia";
import type { User } from "./User";

export interface Experiment {
  id: string;
  name: string;
  isPublished: boolean;
  leias: LeiaConfig[];
  orchestration?: ActivityOrchestration;
  stages?: ActivityStage[];
  user: User | string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityStage {
  id: string;
  previousStageId: string | null;
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
  stageId?: string;
  leia: Leia | string;
  configuration: {
    mode: string;
    data: Record<string, unknown>;
  };
}

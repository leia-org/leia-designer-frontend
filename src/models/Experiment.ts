import type { Leia } from "./Leia";
import type { User } from "./User";

export interface Experiment {
  id: string;
  name: string;
  isPublished: boolean;
  leias: LeiaConfig[];
  user: User | string;
  createdAt: string;
  updatedAt: string;
}

interface LeiaConfig {
  leia: Leia | string;
  configuration: {
    mode: string;
    data: Record<string, unknown>;
  };
}
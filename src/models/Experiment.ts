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

export interface LeiaConfig {
  id: string;
  leia: Leia | string;
  configuration: {
    mode: string;
    audioMode?: 'realtime' | null;
    realtimeConfig?: {
      model?: string;
      voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' | 'marin';
      instructions?: string;
      turnDetection?: {
        type?: 'server_vad' | 'none';
        threshold?: number;
        prefix_padding_ms?: number;
        silence_duration_ms?: number;
      };
    };
    data: Record<string, unknown>;
  };
}
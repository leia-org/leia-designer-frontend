import type { Behaviour } from "../models/Leia";

export declare const CORE_BEHAVIOUR_REFERENCES: string[];
export declare function templateReferences(description?: string): string[];
export declare function missingBehaviourReferences(description?: string, previousDescription?: string): string[];
export declare function behaviourCandidates(saved: Behaviour[], remembered: Iterable<Behaviour>): Behaviour[];

export declare function behaviourPage(candidates: Behaviour[], offset?: number): {
  items: { id: string; name?: string; role?: string; description?: string; process?: string[]; isDraft: boolean }[];
  total: number;
  nextOffset: number | null;
};

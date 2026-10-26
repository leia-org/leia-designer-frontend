import type { Behaviour } from "../models/Leia";

export declare const CORE_BEHAVIOUR_REFERENCES: string[];
export declare function templateReferences(description?: string): string[];
export declare function missingBehaviourReferences(description?: string, previousDescription?: string): string[];
export declare function behaviourCandidates(saved: Behaviour[], remembered: Iterable<Behaviour>): Behaviour[];

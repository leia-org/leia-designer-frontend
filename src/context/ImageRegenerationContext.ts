import { createContext, useContext } from 'react';
import type { Leia } from '../models/Leia';
import type { ImageJob, RegenerationTarget } from '../lib/imageRegeneration';

interface ImageContext {
  jobs: Record<string, ImageJob>;
  leias: Record<string, Leia>;
  starting: ReadonlySet<string>;
  refresh: (id: string) => Promise<void>;
  start: (leia: Leia, target: RegenerationTarget, apiKeyId: string) => Promise<void>;
}
export const ImageRegenerationContext = createContext<ImageContext | null>(null);

export function useImageRegeneration() {
  const context = useContext(ImageRegenerationContext);
  if (!context) throw new Error('ImageRegenerationProvider is required');
  return context;
}

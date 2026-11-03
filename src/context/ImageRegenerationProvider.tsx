import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'react-toastify';
import api from '../lib/axios';
import type { Leia } from '../models/Leia';
import { applyImageJob } from '../lib/imageRegeneration';
import type { ImageJob, RegenerationTarget } from '../lib/imageRegeneration';
import { useAuth } from './useAuth';
import { ImageRegenerationContext } from './ImageRegenerationContext';

export function ImageRegenerationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Record<string, ImageJob>>({});
  const [leias, setLeias] = useState<Record<string, Leia>>({});
  const [starting, setStarting] = useState<Set<string>>(new Set());
  const startingRef = useRef(new Set<string>());
  const jobsRef = useRef<Record<string, ImageJob>>({});
  const session = useRef(0);
  const names = useRef<Record<string, string>>({});

  useEffect(() => {
    session.current += 1;
    jobsRef.current = {};
    names.current = {};
    startingRef.current.clear();
    setJobs({}); setLeias({}); setStarting(new Set());
  }, [user?.id]);

  const receive = useCallback((job: ImageJob | null) => {
    if (!job) return;
    const previous = jobsRef.current[job.leiaId];
    if (previous && (previous.id > job.id || (previous.id === job.id && previous.updatedAt > job.updatedAt))) return;
    if (JSON.stringify(previous) === JSON.stringify(job)) return;
    jobsRef.current = { ...jobsRef.current, [job.leiaId]: job };
    setJobs(jobsRef.current);
    setLeias(current => Object.fromEntries(Object.entries(current).map(([id, leia]) => [id, applyImageJob(leia, job)])));
    if (previous?.id === job.id && previous.active && !job.active) {
      const completed = job.steps.filter(step => step.status === 'completed').length;
      const name = names.current[job.leiaId] || 'LEIA';
      if (job.status === 'completed') toast.success(`${name}: images regenerated successfully`);
      else toast.warning(`${name}: ${completed} of ${job.steps.length} images regenerated. ${job.error || ''}`);
    }
  }, []);


  const refresh = useCallback(async (id: string) => {
    const currentSession = session.current;
    const [entity, latest] = await Promise.all([
      api.get<Leia>(`/api/v1/leias/${id}`),
      api.get<ImageJob | null>(`/api/v1/images/leias/${id}/regenerations/latest`),
    ]);
    if (currentSession !== session.current) return;
    names.current[id] = entity.data.metadata.name;
    receive(latest.data);
    const latestJob = jobsRef.current[id];
    setLeias(current => ({ ...current, [id]: latestJob?.active ? applyImageJob(entity.data, latestJob) : entity.data }));
  }, [receive]);

  const activeIds = Object.values(jobs).filter(job => job.active).map(job => job.leiaId).sort().join(',');
  useEffect(() => {
    if (!activeIds) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const currentSession = session.current;
    const poll = async () => {
      await Promise.all(activeIds.split(',').map(async id => {
        try {
          const response = await api.get<ImageJob | null>(`/api/v1/images/leias/${id}/regenerations/latest`);
          if (cancelled || currentSession !== session.current) return;
          receive(response.data);
          if (response.data && !response.data.active) await refresh(id);
        } catch {
          // A transient network failure does not mean the server job stopped.
          // Continue polling; the current job keeps the generation controls locked.
        }
      }));
      if (!cancelled) timer = setTimeout(() => { void poll(); }, 1000);
    };
    void poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [activeIds, receive, refresh]);

  const start = useCallback(async (leia: Leia, target: RegenerationTarget, apiKeyId: string) => {
    if (startingRef.current.has(leia.id) || jobsRef.current[leia.id]?.active) return;
    const currentSession = session.current;
    startingRef.current.add(leia.id); setStarting(new Set(startingRef.current));
    names.current[leia.id] = leia.metadata.name;
    setLeias(current => ({ ...current, [leia.id]: current[leia.id] || leia }));
    try {
      const response = await api.post<ImageJob>(`/api/v1/images/leias/${leia.id}/regenerations`, { target, apiKeyId });
      if (currentSession === session.current) receive(response.data);
    } finally {
      if (currentSession === session.current) {
        startingRef.current.delete(leia.id); setStarting(new Set(startingRef.current));
      }
    }
  }, [receive]);

  const value = useMemo(() => ({ jobs, leias, starting, refresh, start }), [jobs, leias, starting, refresh, start]);
  return <ImageRegenerationContext.Provider value={value}>{children}</ImageRegenerationContext.Provider>;
}


import { useCallback, useEffect, useRef, useState } from "react";
import api from "../lib/axios";

interface TestSessionState {
  messages: { id: string; text: string; isLeia: boolean; timestamp: string }[];
  conversationDynamics: {
    canFinish: boolean;
    leiaSpeaksFirst: { enabled: boolean; completed: boolean };
    stoppingCondition: { enabled: boolean; satisfied: boolean };
  };
}

export function useTestConversationDynamics(sessionId?: string) {
  const [state, setState] = useState<TestSessionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const refresh = useCallback(async () => {
    if (!sessionId) return;
    const version = ++requestVersion.current;
    try {
      const response = await api.get<TestSessionState>(`/api/v1/runner/${sessionId}`);
      if (version === requestVersion.current) {
        setState(response.data);
        setError(null);
      }
      return response.data;
    } catch {
      if (version === requestVersion.current) {
        setError("Could not load the test conversation. Retry or start a new test.");
      }
    }
  }, [sessionId]);

  useEffect(() => {
    setState(null);
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      const result = await refresh();
      if (!cancelled && (!result || !result.conversationDynamics.canFinish ||
          (result.conversationDynamics.leiaSpeaksFirst.enabled && !result.conversationDynamics.leiaSpeaksFirst.completed))) {
        timer = setTimeout(load, 3000);
      }
    };
    void load();
    return () => { cancelled = true; ++requestVersion.current; clearTimeout(timer); };
  }, [refresh]);

  const opening = state?.conversationDynamics.leiaSpeaksFirst;
  return { state, error, refresh,
    ready: !!state && !error && (!opening?.enabled || opening.completed),
    canFinish: !!state?.conversationDynamics.canFinish && !error };
}

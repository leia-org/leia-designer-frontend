/**
 * Hook for connecting to Wizard SSE stream
 * Manages real-time updates from the LEIA wizard agent
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export interface WizardEvent {
  type: 'connected' | 'thinking' | 'function_call_start' | 'function_call_complete' | 'message' | 'complete' | 'error' | 'stream_end';
  functionName?: string;
  functionTitle?: string;
  functionDescription?: string;
  args?: any;
  result?: any;
  content?: string;
  message?: string;
  leia?: {
    persona: any;
    problem: any;
    behaviour: any;
  };
  sessionId?: string;
}

export interface WizardState {
  sessionId: string | null;
  events: WizardEvent[];
  isConnected: boolean;
  isComplete: boolean;
  error: string | null;
  leia: {
    persona: any;
    problem: any;
    behaviour: any;
  } | null;
}

export interface UseWizardSSEReturn {
  state: WizardState;
  createSession: (userPrompt: string) => Promise<void>;
  sendMessage: (message: string) => Promise<void>;
  saveLeia: () => Promise<any>;
  reset: () => void;
}

export function useWizardSSE(): UseWizardSSEReturn {
  const [state, setState] = useState<WizardState>({
    sessionId: null,
    events: [],
    isConnected: false,
    isComplete: false,
    error: null,
    leia: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Close existing SSE connection
   */
  const closeConnection = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  /**
   * Connect to SSE stream for a session
   */
  const connectToStream = useCallback((sessionId: string) => {
    closeConnection();

    const token = localStorage.getItem('token');
    if (!token) {
      setState((prev) => ({
        ...prev,
        error: 'No authentication token found',
      }));
      return;
    }

    // Pass token as query parameter for EventSource compatibility
    const url = `${API_BASE_URL}/api/v1/wizard/sessions/${sessionId}/stream?token=${encodeURIComponent(token)}`;

    // Create EventSource with authorization via query param
    const eventSource = new EventSource(url, {
      withCredentials: true,
    });

    eventSource.onmessage = (event) => {
      try {
        const data: WizardEvent = JSON.parse(event.data);

        setState((prev) => {
          const newEvents = [...prev.events, data];

          // Update state based on event type
          let updates: Partial<WizardState> = { events: newEvents };

          if (data.type === 'connected') {
            updates.isConnected = true;
          } else if (data.type === 'complete') {
            updates.isComplete = true;
            updates.leia = data.leia || null;
          } else if (data.type === 'error') {
            updates.error = data.message || 'Unknown error';
          } else if (data.type === 'stream_end') {
            updates.isConnected = false;
          }

          return { ...prev, ...updates };
        });
      } catch (error) {
        console.error('Error parsing SSE event:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      setState((prev) => ({
        ...prev,
        isConnected: false,
        error: 'Connection error',
      }));
      closeConnection();
    };

    eventSourceRef.current = eventSource;
  }, [closeConnection]);

  /**
   * Create a new wizard session
   */
  const createSession = useCallback(async (userPrompt: string) => {
    try {
      setState((prev) => ({
        ...prev,
        events: [],
        isComplete: false,
        error: null,
        leia: null,
      }));

      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE_URL}/api/v1/wizard/sessions`,
        { userPrompt },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const { sessionId } = response.data;

      setState((prev) => ({ ...prev, sessionId }));

      // Connect to SSE stream
      connectToStream(sessionId);
    } catch (error: any) {
      console.error('Error creating wizard session:', error);
      setState((prev) => ({
        ...prev,
        error: error.response?.data?.message || error.message || 'Failed to create session',
      }));
    }
  }, [connectToStream]);

  /**
   * Send a message to the wizard (refinement/feedback)
   */
  const sendMessage = useCallback(async (message: string) => {
    if (!state.sessionId) {
      throw new Error('No active session');
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_BASE_URL}/api/v1/wizard/sessions/${state.sessionId}/message`,
        { message },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Reconnect to stream to get new updates
      connectToStream(state.sessionId);
    } catch (error: any) {
      console.error('Error sending message:', error);
      setState((prev) => ({
        ...prev,
        error: error.response?.data?.message || error.message || 'Failed to send message',
      }));
    }
  }, [state.sessionId, connectToStream]);

  /**
   * Save the generated LEIA to database
   */
  const saveLeia = useCallback(async () => {
    if (!state.sessionId) {
      throw new Error('No active session');
    }

    if (!state.isComplete) {
      throw new Error('LEIA is not complete yet');
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE_URL}/api/v1/wizard/sessions/${state.sessionId}/save`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Error saving LEIA:', error);
      throw new Error(error.response?.data?.message || error.message || 'Failed to save LEIA');
    }
  }, [state.sessionId, state.isComplete]);

  /**
   * Reset wizard state
   */
  const reset = useCallback(() => {
    closeConnection();
    setState({
      sessionId: null,
      events: [],
      isConnected: false,
      isComplete: false,
      error: null,
      leia: null,
    });
  }, [closeConnection]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      closeConnection();
    };
  }, [closeConnection]);

  return {
    state,
    createSession,
    sendMessage,
    saveLeia,
    reset,
  };
}

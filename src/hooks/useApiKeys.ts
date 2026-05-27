import { useCallback, useEffect, useState } from 'react';
import { authApi } from '../lib/axios';
import type { ApiKey } from '../models/ApiKeys';

export const useApiKeys = () => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApiKeys = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authApi.get('/api/v1/apikeys');
      setApiKeys(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load API keys';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApiKeys();
  }, [fetchApiKeys]);

  const getDefaultKey = useCallback((): ApiKey | null => {
    return apiKeys.find((key) => key.isDefault) || null;
  }, [apiKeys]);

  return {
    apiKeys,
    isLoading,
    error,
    refetch: fetchApiKeys,
    getDefaultKey,
  };
};

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { authApi } from '../lib/axios';
import type { ApiKey, ApiKeyFormData } from '../models/ApiKeys';

interface ApiKeyFormError extends Error {
  validationErrors?: Record<string, string>;
}

const getApiErrorData = (err: unknown) => {
  return axios.isAxiosError(err) ? err.response?.data : undefined;
};

export const useApiKeys = () => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});

  const fetchApiKeys = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authApi.get('/api/v1/apikeys');
      setApiKeys(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      const data = getApiErrorData(err);
      const message = data?.message || (err instanceof Error ? err.message : 'Failed to load API keys');
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApiKeys();
  }, [fetchApiKeys]);

  const saveKey = async (url: string, method: string, payload: ApiKeyFormData) => {
    try {
      const response = await authApi.request<ApiKey>({ url, method, data: payload });
      const savedKey = response.data;
      setApiKeys((prev) => (
        method === 'POST'
          ? [...prev, savedKey]
          : prev.map((key) => (key.id === savedKey.id ? savedKey : key))
      ));
    } catch (err) {
      const data = getApiErrorData(err);
      const error: ApiKeyFormError = new Error(data?.message || (err instanceof Error ? err.message : 'Failed to save API Key'));
      if (data?.validationErrors) {
        error.validationErrors = data.validationErrors;
      }
      throw error;
    }
  };

  const deleteKey = async (url: string, id: string) => {
    try {
      await authApi.delete(url);
      setApiKeys((prev) => prev.filter((key) => key.id !== id));
    } catch (err) {
      const data = getApiErrorData(err);
      throw new Error(data?.message || (err instanceof Error ? err.message : 'Error deleting key'));
    }
  };

  const toggleDefault = useCallback(async (key: ApiKey) => {
    const prevSnapshot = apiKeys;
    setSavingIds((current) => ({ ...current, [key.id]: true }));
    setApiKeys((current) => current.map((apiKey) => {
      if (apiKey.id === key.id) return { ...apiKey, isDefault: !apiKey.isDefault };
      if (!key.isDefault) return { ...apiKey, isDefault: false };
      return apiKey;
    }));

    try {
      const response = await authApi.put(`/api/v1/apikeys/manage-default/${key.id}`);
      const data = response.data;
      const updatedKey: ApiKey = data.updatedKey || data;
      const previousDefaultId: string | null = data.previousDefaultId ?? null;

      setApiKeys((current) => current.map((apiKey) => {
        if (apiKey.id === updatedKey.id) return { ...apiKey, ...updatedKey };
        if (previousDefaultId && apiKey.id === previousDefaultId) return { ...apiKey, isDefault: false };
        if (!previousDefaultId && updatedKey.isDefault && apiKey.id !== updatedKey.id) {
          return { ...apiKey, isDefault: false };
        }
        return apiKey;
      }));
      return updatedKey;
    } catch (err) {
      setApiKeys(prevSnapshot);
      const data = getApiErrorData(err);
      throw new Error(data?.message || (err instanceof Error ? err.message : 'Failed to toggle default'));
    } finally {
      setSavingIds((current) => {
        const copy = { ...current };
        delete copy[key.id];
        return copy;
      });
    }
  }, [apiKeys]);

  const getDefaultKey = useCallback((): ApiKey | null => {
    return apiKeys.find((key) => key.isDefault) || null;
  }, [apiKeys]);

  return {
    apiKeys,
    setApiKeys,
    isLoading,
    error,
    refetch: fetchApiKeys,
    toggleDefault,
    savingIds,
    deleteKey,
    saveKey,
    getDefaultKey,
  };
};

import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../lib/axios';

interface ProvidersData {
  models: string[];
  default: string;
  apiKeyProviders: Record<string, string[]>;
  providerProviderModuleMap: Record<string, string>;
}

const emptyProviders: ProvidersData = {
  models: [],
  default: '',
  apiKeyProviders: {},
  providerProviderModuleMap: {},
};

export const useProviders = () => {
  const [providersData, setProvidersData] = useState<ProvidersData>(emptyProviders);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProviders = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get('/api/v1/provider');
      setProvidersData(response.data as ProvidersData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load providers';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const apiKeysProviderSet = useMemo(() => {
    if (!providersData?.apiKeyProviders) return [];
    return Object.keys(providersData.apiKeyProviders);
  }, [providersData]);

  return {
    models: providersData?.models || [],
    defaultModel: providersData?.default || '',
    apiKeyProvidersMapped: providersData?.apiKeyProviders || {},
    apiKeysProviderSet,
    providerProviderModuleMap: providersData?.providerProviderModuleMap || {},
    isLoading,
    error,
    refetch: fetchProviders,
  };
};

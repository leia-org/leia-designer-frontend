export interface ApiKey {
  id: string;
  description: string;
  provider: string;
  /** Default model to use with this key (chosen once at key creation). */
  model?: string;
  baseUrl: string;
  keyValue: string;
  managementUrl?: string;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  isSystemApiKey?: boolean;
}

export interface ApiKeyFormData {
  description: string | undefined;
  provider: string | undefined;
  model?: string | undefined;
  baseUrl: string | undefined;
  keyValue: string | undefined;
  managementUrl?: string | undefined;
  isActive: boolean | undefined;
  isDefault?: boolean | undefined;
  isSystemApiKey?: boolean | undefined;
}

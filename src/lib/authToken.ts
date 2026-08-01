let currentToken: string | null = null;

export const getAuthToken = (): string | null => currentToken;

export const setAuthToken = (token: string | null): void => {
  currentToken = token;
};

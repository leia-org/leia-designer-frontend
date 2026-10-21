import axios from 'axios';
import type { AxiosResponse, AxiosError } from 'axios';
import { getAuthToken, setAuthToken } from './authToken';

const api = axios.create({
  baseURL: import.meta.env.VITE_APP_BACKEND,
});
export const authApi = axios.create({
  baseURL: import.meta.env.VITE_AUTH_SERVICE_BACKEND,
  withCredentials: true,
});

const logout = (): void => {
  setAuthToken(null);
  void fetch(
    `${import.meta.env.VITE_AUTH_SERVICE_BACKEND}/api/v1/users/logout`,
    { method: 'POST', credentials: 'include' },
  ).catch((error) => console.error('Error closing Auth session:', error));
  window.location.href = '/login';
};

const forbidden = (): void => {
  window.location.href = '/forbidden';
};

api.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error: AxiosError) => {
    if (error.response) {
      const status = error.response.status;

      switch (status) {
        case 401:
          logout();
          break;
        case 403:
          forbidden();
          break;
        default:
          break;
      }
    }

    return Promise.reject(error);
  }
);

authApi.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

authApi.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error: AxiosError) => {
    if (error.response) {
      const status = error.response.status;

      switch (status) {
        case 401:
          logout();
          break;
        case 403:
          forbidden();
          break;
        default:
          break;
      }
    }

    return Promise.reject(error);
  }
);
export default api;

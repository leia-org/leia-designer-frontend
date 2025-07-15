import axios from 'axios';
import type { AxiosResponse, AxiosError } from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_APP_BACKEND,
});

const getToken = (): string | null => {
  return localStorage.getItem('token');
};

const logout = (): void => {
  localStorage.removeItem('token');
  window.location.href = '/login';
};

const forbidden = (): void => {
  window.location.href = '/forbidden';
};

api.interceptors.request.use(
  (config) => {
    const token = getToken();
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

export default api;

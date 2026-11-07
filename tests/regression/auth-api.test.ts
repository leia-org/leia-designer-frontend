import { beforeEach, describe, expect, test, vi } from 'vitest';
import { AxiosError } from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

let api: AxiosInstance, authApi: AxiosInstance;
let setAuthToken: (token: string | null) => void;
let getAuthToken: () => string | null;
let requests: InternalAxiosRequestConfig[];

beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv('VITE_APP_BACKEND', 'https://designer.example');
  vi.stubEnv('VITE_AUTH_SERVICE_BACKEND', 'https://auth.example');
  vi.stubGlobal('window', { location: { href: '/activities' } });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  ({ default: api, authApi } = await import('../../src/lib/axios'));
  ({ setAuthToken, getAuthToken } = await import('../../src/lib/authToken'));
  requests = [];
  for (const client of [api, authApi]) {
    client.defaults.adapter = async (config) => {
      requests.push(config);
      return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config };
    };
  }
});

describe.each(['designer', 'auth'])('%s API authentication regressions', (name) => {
  const client = () => name === 'auth' ? authApi : api;
  const failWith = (status: number) => {
    client().defaults.adapter = async (config) => {
      throw new AxiosError('Request failed', undefined, config, undefined, {
        data: { message: 'Rejected' }, status, statusText: 'Rejected', headers: {}, config,
      });
    };
  };

  test('reads the current in-memory token on every request, including after rotation and logout', async () => {
    setAuthToken('first-token');
    await client().get('/resource');
    setAuthToken('rotated-token');
    await client().get('/resource');
    setAuthToken(null);
    await client().get('/resource');
    expect(requests.map((r) => r.headers.Authorization)).toEqual(['Bearer first-token', 'Bearer rotated-token', undefined]);
    expect(requests.every((r) => r.baseURL === (name === 'auth' ? 'https://auth.example' : 'https://designer.example'))).toBe(true);
    if (name === 'auth') expect(requests.every((r) => r.withCredentials)).toBe(true);
  });

  test('401 clears credentials, closes the central session and redirects to login while rejecting the request', async () => {
    setAuthToken('expired-token');
    failWith(401);
    await expect(client().get('/resource')).rejects.toMatchObject({ response: { status: 401 } });
    expect(getAuthToken()).toBeNull();
    expect(fetch).toHaveBeenCalledExactlyOnceWith('https://auth.example/api/v1/users/logout', { method: 'POST', credentials: 'include' });
    expect(window.location.href).toBe('/login');
  });

  test('403 sends the user to the forbidden page without destroying a valid session', async () => {
    setAuthToken('valid-token');
    failWith(403);
    await expect(client().get('/resource')).rejects.toMatchObject({ response: { status: 403 } });
    expect(window.location.href).toBe('/forbidden');
    expect(getAuthToken()).toBe('valid-token');
    expect(fetch).not.toHaveBeenCalled();
  });

  test.each([400, 404, 500])('%s errors propagate without logging the user out', async (status) => {
    setAuthToken('valid-token');
    failWith(status);
    await expect(client().get('/resource')).rejects.toMatchObject({ response: { status } });
    expect(getAuthToken()).toBe('valid-token');
    expect(window.location.href).toBe('/activities');
    expect(fetch).not.toHaveBeenCalled();
  });

  test('network failures preserve the session and the original error', async () => {
    setAuthToken('valid-token');
    const error = new Error('Offline');
    client().defaults.adapter = async () => { throw error; };
    await expect(client().get('/resource')).rejects.toBe(error);
    expect(getAuthToken()).toBe('valid-token');
    expect(fetch).not.toHaveBeenCalled();
  });
});

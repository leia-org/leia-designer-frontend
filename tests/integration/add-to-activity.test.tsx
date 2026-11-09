import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { AddLeiaToAnActivity } from '../../src/components/AddLeiaToAnActivity';
import api from '../../src/lib/axios';
import { setAuthToken } from '../../src/lib/authToken';
import type { Leia } from '../../src/models/Leia';

let server: Server;
let activities: { id: string; name: string }[];
let attachments: { activityId: string; leia: string }[];
let failAttachment = false;
const requests: { method: string; path: string; authorization?: string }[] = [];
const leia = { id: 'leia-114', metadata: { name: 'Router assistant' } } as Leia;
const originalBaseUrl = api.defaults.baseURL;

beforeAll(async () => {
  const app = express(); app.use(express.json());
  app.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.set('Access-Control-Allow-Credentials', 'true');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    requests.push({ method: req.method, path: req.path, authorization: req.headers.authorization });
    if (req.headers.authorization !== 'Bearer integration-access') return res.sendStatus(401);
    next();
  });
  app.get('/api/v1/experiments/user/me', (req, res) => {
    expect(req.query.visibility).toBe('private');
    expect(req.query.populated).toBe('true');
    res.json({ experiments: activities, nextCursor: null });
  });
  app.post('/api/v1/experiments', (req, res) => {
    if (activities.some((activity) => activity.name === req.body.name)) return res.status(409).json({ message: 'Activity already exists' });
    const activity = { id: `activity-${activities.length}`, name: req.body.name };
    activities.push(activity); res.status(201).json(activity);
  });
  app.post('/api/v1/experiments/:id/leias', (req, res) => {
    if (failAttachment) return res.status(503).json({ message: 'Temporarily unavailable' });
    attachments.push({ activityId: req.params.id, leia: req.body.leia });
    res.json({ id: req.params.id });
  });
  await new Promise<void>((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  api.defaults.baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  api.defaults.baseURL = originalBaseUrl; setAuthToken(null);
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
beforeEach(() => {
  activities = [{ id: 'existing', name: 'Existing activity' }];
  attachments = []; requests.length = 0; failAttachment = false; setAuthToken('integration-access');
});

test('selecting a loaded activity sends the chosen LEIA and closes only after the HTTP request succeeds', async () => {
  const onClose = vi.fn(), onSuccess = vi.fn();
  render(<AddLeiaToAnActivity isOpen selectedLeia={leia} onClose={onClose} onSuccess={onSuccess} />);
  const input = await screen.findByRole('combobox');
  await waitFor(() => expect(requests.some((req) => req.method === 'GET')).toBe(true));
  fireEvent.mouseDown(input);
  fireEvent.click(await screen.findByRole('option', { name: 'Existing activity' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add to Activity' }));
  await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
  expect(onClose).toHaveBeenCalledOnce();
  expect(attachments).toEqual([{ activityId: 'existing', leia: 'leia-114' }]);
  expect(requests.every((req) => req.authorization === 'Bearer integration-access')).toBe(true);
});

test('a new activity is created once and a failed attachment can be retried without duplicating it', async () => {
  const onClose = vi.fn(), onSuccess = vi.fn();
  failAttachment = true;
  render(<AddLeiaToAnActivity isOpen selectedLeia={leia} onClose={onClose} onSuccess={onSuccess} />);
  const input = await screen.findByRole('combobox');
  fireEvent.change(input, { target: { value: '  New interview  ' } });
  await screen.findByText(/New activity.*New interview.*created on confirm/);
  fireEvent.click(screen.getByRole('button', { name: 'Add to Activity' }));
  await screen.findByText('Could not add LEIA to activity');
  expect(onClose).not.toHaveBeenCalled();
  expect(onSuccess).not.toHaveBeenCalled();
  expect(activities.map((activity) => activity.name)).toEqual(['Existing activity', 'New interview']);
  failAttachment = false;
  fireEvent.click(screen.getByRole('button', { name: 'Add to Activity' }));
  await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
  expect(requests.filter((req) => req.method === 'POST' && req.path === '/api/v1/experiments')).toHaveLength(1);
  expect(attachments).toEqual([{ activityId: 'activity-1', leia: 'leia-114' }]);
});

test('cancel and missing selection cannot create or attach an activity', async () => {
  const onClose = vi.fn();
  render(<AddLeiaToAnActivity isOpen selectedLeia={leia} onClose={onClose} />);
  expect((screen.getByRole('button', { name: 'Add to Activity' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onClose).toHaveBeenCalledOnce();
  expect(requests.filter((req) => req.method === 'POST')).toHaveLength(0);
});

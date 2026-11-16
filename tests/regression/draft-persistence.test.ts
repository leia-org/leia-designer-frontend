import { beforeEach, expect, test, vi } from 'vitest';

beforeEach(() => vi.resetModules());

test('draft listing accepts legacy MongoDB ids and preserves the complete editor state', async () => {
  const { default: api } = await import('../../src/lib/axios');
  const { listLeiaDrafts } = await import('../../src/lib/leiaDrafts');
  const state = { problem: { id: 'problem' }, behaviour: null, persona: { id: 'persona' }, step: 2 };
  api.defaults.adapter = async (config) => ({ data: [{ _id: 'legacy-id', title: 'Draft', state }, { id: 'public-id', _id: 'mongo-id', state }], status: 200, statusText: 'OK', headers: {}, config });
  const drafts = await listLeiaDrafts();
  expect(drafts.map((d) => d.id)).toEqual(['legacy-id', 'public-id']);
  expect(drafts[0].state).toEqual(state);
});

test('saving and updating a draft round-trips nested state without losing explicit null selections', async () => {
  const { default: api } = await import('../../src/lib/axios');
  const { createLeiaDraft, updateLeiaDraft, deleteLeiaDraft } = await import('../../src/lib/leiaDrafts');
  const requests: { method?: string; url?: string }[] = [];
  api.defaults.adapter = async (config) => {
    requests.push({ method: config.method, url: config.url });
    return { data: { _id: 'saved-id', ...(config.data ? JSON.parse(config.data) : {}) }, status: 200, statusText: 'OK', headers: {}, config };
  };
  const payload = { title: 'Router interview', state: { problem: { id: 'router' }, behaviour: null, conversation: ['Keep this context'] } };
  expect(await createLeiaDraft(payload)).toMatchObject({ id: 'saved-id', ...payload });
  const updated = { ...payload, state: { ...payload.state, conversation: [...payload.state.conversation, 'New message'] } };
  expect(await updateLeiaDraft('saved-id', updated)).toMatchObject({ id: 'saved-id', ...updated });
  await deleteLeiaDraft('saved-id');
  expect(requests).toEqual([
    { method: 'post', url: '/api/v1/leia-drafts' },
    { method: 'put', url: '/api/v1/leia-drafts/saved-id' },
    { method: 'delete', url: '/api/v1/leia-drafts/saved-id' },
  ]);
  expect(payload.state.conversation).toEqual(['Keep this context']);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePreviewName, findPullRequests } from '../scripts/cloudflare-preview.mjs';

const repo = 'leia-org/leia-designer-frontend';
const pr = (number, branch = 'feature/example', overrides = {}) => ({
  number, state: 'open', base: { ref: 'develop' },
  head: { ref: branch, repo: { full_name: repo } }, ...overrides,
});

test('develop always updates the stable pre hostname', () => {
  assert.equal(resolvePreviewName('develop', [pr(123, 'develop')]), 'pre');
});

test('an open PR to develop gets its own numbered hostname', () => {
  assert.equal(resolvePreviewName('feature/example', [pr(123)]), 'pre-123');
});

test('unrelated, closed and production PRs do not select a preview', () => {
  const name = resolvePreviewName('feature/example', [
    pr(1, 'other'), pr(2, 'feature/example', { state: 'closed' }),
    pr(3, 'feature/example', { base: { ref: 'main' } }),
    pr(4, 'feature/example', { head: { ref: 'feature/example', repo: { full_name: 'other/repo' } } }),
  ]);
  assert.match(name, /^branch-feature-example-[a-f0-9]{8}$/);
});

test('branch previews have stable, collision-resistant DNS names', () => {
  const first = resolvePreviewName('feature/a_b', []);
  assert.equal(first, resolvePreviewName('feature/a_b', []));
  assert.notEqual(first, resolvePreviewName('feature/a-b', []));
  const long = resolvePreviewName('feature/' + 'A'.repeat(200), []);
  assert.ok(long.length <= 63);
  assert.match(long, /^[a-z0-9][a-z0-9-]*[a-z0-9]$/);
});

test('production and detached checkouts cannot deploy a preview', () => {
  for (const branch of ['', undefined, 'HEAD', 'main']) {
    assert.throws(() => resolvePreviewName(branch, []), /non-production branch/);
  }
});

test('ambiguous PR mapping stops instead of overwriting an arbitrary preview', () => {
  assert.throws(() => resolvePreviewName('feature/example', [pr(1), pr(2)]), /More than one/);
});

test('GitHub lookup filters exact branches including forks without credentials', async () => {
  const result = await findPullRequests('feature/a&b', async (url, options) => {
    assert.equal(url.hostname, 'api.github.com');
    assert.equal(url.searchParams.has('head'), false);
    assert.equal(url.searchParams.get('page'), '1');
    assert.equal(url.searchParams.get('base'), 'develop');
    assert.equal(options.headers.Authorization, undefined);
    return { ok: true, json: async () => [pr(123, 'feature/a&b'), pr(456, 'other')] };
  });
  assert.equal(result[0].number, 123);
});

test('GitHub failures stop deployment and never select a misleading PR number', async () => {
  await assert.rejects(findPullRequests('feature/example', async () => ({ ok: false, status: 403 })), /HTTP 403/);
  await assert.rejects(findPullRequests('feature/example', async () => ({ ok: true, json: async () => ({}) })), /Unexpected/);
});


test('fork PRs require the exact checked out head commit', () => {
  const sha = 'a'.repeat(40);
  const fork = pr(101, 'feature/example', {
    head: { ref: 'feature/example', sha, repo: { full_name: 'contributor/fork' } },
  });
  assert.equal(resolvePreviewName('feature/example', [fork], repo, sha), 'pre-101');
  for (const head of [undefined, 'invalid', 'b'.repeat(40)]) {
    assert.match(resolvePreviewName('feature/example', [fork], repo, head), /^branch-/);
  }
});

test('GitHub lookup searches subsequent pages for older open PRs', async () => {
  const seen = [];
  const result = await findPullRequests('old-branch', async (url) => {
    const page = url.searchParams.get('page');
    seen.push(page);
    return { ok: true, json: async () => page === '1'
      ? Array.from({ length: 100 }, (_, i) => pr(i + 1, 'other'))
      : [pr(101, 'old-branch')] };
  });
  assert.deepEqual(seen, ['1', '2']);
  assert.equal(result[0].number, 101);
});

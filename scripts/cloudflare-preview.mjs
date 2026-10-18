import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repository = 'leia-org/leia-designer-frontend';
const hostname = 'designer.leia.ovh';

export function resolvePreviewName(branch, pullRequests, expectedRepository = repository) {
  if (!branch || branch === 'HEAD' || branch === 'main') {
    throw new Error('A named non-production branch is required. Production uses wrangler deploy.');
  }
  if (branch === 'develop') return 'pre';

  const matches = pullRequests.filter((pr) =>
    pr.state === 'open' && pr.base?.ref === 'develop' &&
    pr.head?.ref === branch && pr.head?.repo?.full_name === expectedRepository &&
    Number.isSafeInteger(pr.number) && pr.number > 0
  );
  if (matches.length > 1) throw new Error('More than one open PR matches this branch.');
  if (matches.length === 1) return `pre-${matches[0].number}`;

  const slug = branch.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 43) || 'unnamed';
  const hash = createHash('sha256').update(branch).digest('hex').slice(0, 8);
  return `branch-${slug}-${hash}`;
}

export async function findPullRequests(branch, fetcher = fetch) {
  const owner = repository.split('/')[0];
  const url = new URL(`https://api.github.com/repos/${repository}/pulls`);
  url.search = new URLSearchParams({ state: 'open', base: 'develop', head: `${owner}:${branch}`, per_page: '100' });
  const response = await fetcher(url, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'LEIA-Cloudflare-Previews' },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new Error(`Cannot resolve the PR number from GitHub (HTTP ${response.status}). No preview was deployed.`);
  }
  const result = await response.json();
  if (!Array.isArray(result)) throw new Error('Unexpected GitHub pull request response.');
  return result;
}

async function main() {
  const branch = process.env.WORKERS_CI_BRANCH || process.env.GITHUB_HEAD_REF ||
    spawnSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).stdout?.trim();
  // Reject main before making a network request or starting Wrangler.
  resolvePreviewName(branch, []);
  const pullRequests = branch === 'develop' ? [] : await findPullRequests(branch);
  const name = resolvePreviewName(branch, pullRequests);
  const config = fileURLToPath(new URL('../wrangler.workers.jsonc', import.meta.url));
  const args = ['preview', '--config', config, '--name', name];

  console.log(`Preview ${name}: https://${name}.${hostname}`);
  if (process.argv.includes('--dry-run')) {
    console.log(JSON.stringify({ branch, name, args }));
    return;
  }
  const wrangler = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
  const result = spawnSync(process.execPath, [wrangler, ...args], { stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

/**
 * PUBLISHES THE GAME TO GITHUB PAGES
 * ===================================
 * Builds the site and force-pushes it to the `gh-pages` branch, which is the
 * branch GitHub Pages serves. The source code stays on `main`.
 *
 *   npm run build && npm run deploy
 *
 * Authentication is whatever git already has: a `gh` credential helper, an SSH
 * remote, or a GH_TOKEN exported in the environment. Nothing is stored here.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const BRANCH = 'gh-pages';

const run = (command, args, options = {}) =>
  execFileSync(command, args, { stdio: 'inherit', cwd: ROOT, ...options });

const remoteUrl = run('git', ['remote', 'get-url', 'origin'], { stdio: ['ignore', 'pipe', 'inherit'] })
  .toString()
  .trim();

if (!remoteUrl) {
  console.error('No git remote named "origin". Add one before deploying.');
  process.exit(1);
}

console.log('> building');
run('npm', ['run', 'build']);

if (!existsSync(DIST)) {
  console.error('No dist/ directory after the build.');
  process.exit(1);
}

const staging = mkdtempSync(join(tmpdir(), 'bwar-pages-'));

try {
  cpSync(DIST, staging, { recursive: true });

  // A throwaway repo, so the deployment never touches the working tree and
  // never leaks a build artefact into the source history.
  run('git', ['init', '-b', BRANCH], { cwd: staging });
  run('git', ['add', '-A'], { cwd: staging });
  run('git', ['commit', '-m', 'Deploy: build output for GitHub Pages'], {
    cwd: staging,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME ?? 'RGSTUDIO-GAME',
      GIT_AUTHOR_EMAIL: process.env.GIT_AUTHOR_EMAIL ?? 'RGSTUDIO-GAME@users.noreply.github.com',
      GIT_COMMITTER_NAME: process.env.GIT_COMMITTER_NAME ?? 'RGSTUDIO-GAME',
      GIT_COMMITTER_EMAIL: process.env.GIT_COMMITTER_EMAIL ?? 'RGSTUDIO-GAME@users.noreply.github.com',
    },
  });
  run('git', ['remote', 'add', 'origin', remoteUrl], { cwd: staging });
  run('git', ['push', '--force', 'origin', BRANCH], { cwd: staging });

  console.log(`\nPushed dist/ to ${BRANCH}.`);
  console.log('If Pages is not live yet, enable it once:');
  console.log('  Settings -> Pages -> Deploy from a branch -> gh-pages / (root)');
} finally {
  rmSync(staging, { recursive: true, force: true });
}

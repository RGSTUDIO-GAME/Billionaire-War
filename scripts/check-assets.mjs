/**
 * Reports which registered assets are present on disk and which ones will
 * fall back at runtime. Missing files are NOT an error - that is exactly what
 * the asset fallback chain is for - but you want to know about them.
 *
 * Run with: npm run assets:check
 */
import { build } from 'esbuild';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = mkdtempSync(join(tmpdir(), 'bwar-assets-'));
const outFile = join(outDir, 'manifest.mjs');

try {
  await build({
    entryPoints: [join(ROOT, 'src/assets/manifest.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    outfile: outFile,
    logLevel: 'warning',
  });

  const { ASSET_ENTRIES } = await import(pathToFileURL(outFile).href);

  const present = [];
  const missing = [];
  const inlineOnly = [];

  for (const entry of ASSET_ENTRIES) {
    if (!entry.file) {
      inlineOnly.push(`${entry.category}/${entry.id}`);
      continue;
    }
    const rel = `${entry.category}/${entry.file}`;
    (existsSync(join(ROOT, 'public/assets', entry.category, entry.file)) ? present : missing).push(rel);
  }

  const placeholders = inlineOnly;

  console.log(`Registered assets : ${ASSET_ENTRIES.length}`);
  console.log(`  on disk         : ${present.length}`);
  console.log(`  using fallback  : ${missing.length}`);
  console.log(`  inline only     : ${placeholders.length} (no file by design)`);

  if (missing.length > 0) {
    console.log('\nMissing files (runtime falls back automatically):');
    for (const rel of missing) console.log(`  - ${rel}`);
  }
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

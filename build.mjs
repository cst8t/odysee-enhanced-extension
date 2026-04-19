import { mkdir, cp, rm } from 'node:fs/promises';
import { build } from 'esbuild';

const rootDir = new URL('.', import.meta.url);
const distDir = new URL('./dist/', rootDir);
const isReviewBuild = process.argv.includes('--review');

await rm(distDir, { recursive: true, force: true });
await mkdir(new URL('./src/', distDir), { recursive: true });

await build({
  entryPoints: [new URL('./src/content-script.js', rootDir).pathname],
  bundle: true,
  format: 'iife',
  outfile: new URL('./src/content-script.js', distDir).pathname,
  target: ['firefox109', 'chrome120'],
  minify: !isReviewBuild,
  loader: {
    '.svg': 'text',
  },
  legalComments: 'none',
});

await Promise.all([
  cp(new URL('./src/content.css', rootDir), new URL('./src/content.css', distDir)),
  cp(new URL('./manifest.json', rootDir), new URL('./manifest.json', distDir)),
  cp(new URL('./icons/', rootDir), new URL('./icons/', distDir), { recursive: true }),
]);

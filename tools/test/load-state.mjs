// Bundles the app's state layer so that Node can import it. The storage
// library is native, so an in-memory stand-in takes its place.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const probeModules = path.join(repoRoot, 'tools', 'probe', 'node_modules');

export async function loadState() {
  const esbuild = await import(
    pathToFileURL(path.join(probeModules, 'esbuild', 'lib', 'main.js')).href
  );
  const outfile = path.join(probeModules, '.cache', 'state.mjs');

  await esbuild.build({
    stdin: {
      contents: `
        export { default as reducer } from './src/redux/reducer.js';
        export * as actions from './src/redux/actions.js';
        export { default as StateJsonConvert } from './src/modules/state-json-convert.js';
      `,
      resolveDir: repoRoot,
    },
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile,
    logLevel: 'error',
    nodePaths: [probeModules],
    alias: {
      '@react-native-async-storage/async-storage': path.join(
        repoRoot,
        'tools',
        'probe',
        'async-storage.js'
      ),
    },
  });

  return import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);
}

import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';

const root = resolve('.');
const sourceRoots = ['src', 'server', 'api', 'tests', 'scripts', 'config', 'google-apps-script'];
const sourceExtensions = new Set(['.js', '.jsx', '.mjs', '.gs', '.json', '.toml', '.sql']);
const emojiPattern = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const serverOnlyNames = ['GOOGLE_APPS_SCRIPT_URL', 'GOOGLE_APPS_SCRIPT_SHARED_SECRET', 'STAFF_SESSION_SECRET', 'AUDIT_HASH_SECRET', 'RATE_LIMIT_SECRET'];

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesIn(path));
    else if (sourceExtensions.has(extname(entry.name))) files.push(path);
  }
  return files;
}

const files = [];
for (const sourceRoot of sourceRoots) files.push(...await filesIn(resolve(sourceRoot)));

const failures = [];
for (const file of files) {
  const contents = await readFile(file, 'utf8');
  const display = relative(root, file);
  if (emojiPattern.test(contents)) failures.push(`${display}: emoji characters are not allowed`);

  if (display.startsWith('src/')) {
    for (const name of serverOnlyNames) {
      if (contents.includes(name)) failures.push(`${display}: server-only environment name ${name} appears in browser source`);
    }
    if (/VITE_[A-Z0-9_]*(?:SECRET|PASSWORD|SERVICE_ROLE|TOKEN|API_KEY)/.test(contents)) {
      failures.push(`${display}: a VITE variable appears to contain a server-only secret`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Lint passed for ${files.length} isolated Red Egg source files.`);
}

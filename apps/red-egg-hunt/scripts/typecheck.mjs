import { readFile, readdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const roots = ['server', 'api', 'scripts', 'tests', 'google-apps-script'];
const checkedExtensions = new Set(['.js', '.mjs']);

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesIn(path));
    else if (checkedExtensions.has(extname(entry.name))) files.push(path);
  }
  return files;
}

const files = [];
for (const root of roots) files.push(...await filesIn(resolve(root)));

const failures = files.filter((file) => {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || `${file} failed\n`);
    return true;
  }
  return false;
});

const appsScriptFiles = [];
for (const root of ['google-apps-script']) {
  const entries = await readdir(resolve(root), { withFileTypes: true });
  for (const entry of entries) if (entry.isFile() && extname(entry.name) === '.gs') appsScriptFiles.push(join(resolve(root), entry.name));
}
for (const file of appsScriptFiles) {
  const source = await readFile(file, 'utf8');
  const result = spawnSync(process.execPath, ['--check', '--input-type=commonjs'], { input: source, encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || `${file} failed\n`);
    failures.push(file);
  }
}

if (failures.length > 0) process.exitCode = 1;
else console.log(`JavaScript syntax/type boundary check passed for ${files.length} server-side files and ${appsScriptFiles.length} Apps Script file(s). JSX is validated by the Vite build.`);

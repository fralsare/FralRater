// Builds a Windows "portable" release: an unpacked, no-install folder of
// FralRater that users can unzip and run FralRater.exe from, no installer
// needed. Produces dist/FralRater-portable-<version>-win-x64.zip.
'use strict';

const { execFileSync } = require('node:child_process');
const { createWriteStream, existsSync } = require('node:fs');
const { rm } = require('node:fs/promises');
const path = require('node:path');
const archiver = require('archiver');

(async () => {
  await buildPortable();
})().catch((err) => {
  console.error('[portable] Failed:', err);
  process.exit(1);
});

async function buildPortable() {

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const unpacked = path.join(dist, 'win-unpacked');
const pkg = require(path.join(root, 'package.json'));
const outZip = path.join(dist, `FralRater-portable-${pkg.version}-win-x64.zip`);

// 1) Build the unpacked Windows app (cross-builds fine from Linux/Windows).
// Run the local electron-builder CLI via the current Node binary — avoids
// npx/.cmd spawn quirks on Windows (EINVAL on npx.cmd).
console.log('[portable] Building unpacked win-x64 ...');
const ebCli = require.resolve('electron-builder/cli.js');
execFileSync(process.execPath, [
  ebCli,
  '--win',
  '--x64',
  '--dir',
  '--publish',
  'never',
], { cwd: root, stdio: 'inherit' });

if (!existsSync(unpacked)) {
  throw new Error('win-unpacked was not produced');
}

// 2) Zip it into a portable archive.
console.log(`[portable] Zipping -> ${path.relative(root, outZip)}`);
await rm(outZip, { force: true });
const output = createWriteStream(outZip);
const archive = archiver('zip', { zlib: { level: 9 } });
output.on('close', () => {
  console.log(`[portable] Done: ${archive.pointer()} bytes`);
});
archive.on('error', (err) => {
  console.error('[portable] Zip error:', err);
  process.exit(1);
});
archive.pipe(output);
archive.directory(unpacked, 'FralRater');
await new Promise((resolve) => {
  output.on('close', resolve);
  archive.finalize();
});
}

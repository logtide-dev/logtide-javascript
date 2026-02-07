#!/usr/bin/env node

/**
 * Unified version bump script.
 *
 * Usage:
 *   node scripts/version.mjs <version>
 *
 * Example:
 *   node scripts/version.mjs 0.6.0
 *
 * This will update the version in all package.json files across the monorepo
 * and replace workspace:* dependencies with the exact version for publishing.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const version = process.argv[2];

if (!version) {
  console.error('Usage: node scripts/version.mjs <version>');
  console.error('Example: node scripts/version.mjs 0.6.0');
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  console.error(`Invalid version: ${version}`);
  console.error('Expected format: X.Y.Z or X.Y.Z-beta.1');
  process.exit(1);
}

function updatePackageJson(filePath) {
  const pkg = JSON.parse(readFileSync(filePath, 'utf8'));
  const oldVersion = pkg.version;
  pkg.version = version;
  writeFileSync(filePath, JSON.stringify(pkg, null, 2) + '\n');
  return oldVersion;
}

// Update root
const rootPkgPath = join(ROOT, 'package.json');
const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf8'));
rootPkg.version = version;
writeFileSync(rootPkgPath, JSON.stringify(rootPkg, null, 2) + '\n');
console.log(`  root: ${version}`);

// Update all packages
const packagesDir = join(ROOT, 'packages');
const packages = readdirSync(packagesDir).filter((d) => {
  const full = join(packagesDir, d);
  return statSync(full).isDirectory() && statSync(join(full, 'package.json')).isFile();
});

for (const pkgDir of packages) {
  const pkgPath = join(packagesDir, pkgDir, 'package.json');
  const oldVersion = updatePackageJson(pkgPath);
  console.log(`  @logtide/${pkgDir}: ${oldVersion} -> ${version}`);
}

console.log(`\nAll packages updated to ${version}`);
console.log('\nNext steps:');
console.log(`  git add -A && git commit -m "chore: bump version to ${version}"`);
console.log(`  git tag v${version}`);
console.log(`  git push origin main --tags`);

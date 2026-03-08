/**
 * Source Maps Upload Command
 *
 * Recursively finds .map files in a directory and uploads them to LogTide.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { uploadSourceMap, type UploadResult } from '../../utils/http.js';

export interface UploadOptions {
  release: string;
  apiKey: string;
  apiUrl: string;
  concurrency: number;
}

/**
 * Find all .map files recursively in a directory.
 */
async function findMapFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true, recursive: true });
  const mapFiles: string[] = [];

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.map')) {
      // entry.parentPath available in Node 20.12+, fallback to entry.path
      const parentDir = (entry as any).parentPath || (entry as any).path || dir;
      mapFiles.push(path.join(parentDir, entry.name));
    }
  }

  return mapFiles;
}

/**
 * Process uploads in batches of `concurrency`.
 */
async function uploadBatch(
  files: string[],
  options: UploadOptions,
): Promise<UploadResult[]> {
  const results: UploadResult[] = [];
  const pending = [...files];

  while (pending.length > 0) {
    const batch = pending.splice(0, options.concurrency);

    const batchResults = await Promise.all(
      batch.map(async (filePath) => {
        const content = await fs.readFile(filePath);
        const fileName = path.basename(filePath);

        return uploadSourceMap({
          apiUrl: options.apiUrl,
          apiKey: options.apiKey,
          release: options.release,
          fileName,
          content,
        });
      }),
    );

    results.push(...batchResults);
  }

  return results;
}

export async function uploadSourcemaps(
  directory: string,
  options: UploadOptions,
): Promise<void> {
  // Validate inputs
  if (!options.apiKey) {
    console.error('Error: --api-key is required (or set LOGTIDE_API_KEY env var)');
    process.exit(1);
    return;
  }

  // Resolve directory
  const resolvedDir = path.resolve(directory);

  try {
    await fs.access(resolvedDir);
  } catch {
    console.error(`Error: directory not found: ${resolvedDir}`);
    process.exit(1);
    return;
  }

  // Find .map files
  console.log(`Scanning ${resolvedDir} for source maps...`);
  const mapFiles = await findMapFiles(resolvedDir);

  if (mapFiles.length === 0) {
    console.log('No .map files found.');
    return;
  }

  console.log(`Found ${mapFiles.length} source map(s). Uploading to ${options.apiUrl}...`);
  console.log(`Release: ${options.release}\n`);

  // Upload
  const results = await uploadBatch(mapFiles, options);

  // Report
  const succeeded = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  for (const result of results) {
    if (result.success) {
      console.log(`  ✓ ${result.fileName}`);
    } else {
      console.error(`  ✗ ${result.fileName} — ${result.error}`);
    }
  }

  console.log(`\n${succeeded.length}/${results.length} uploaded successfully.`);

  if (failed.length > 0) {
    process.exit(1);
  }
}

import { Command } from 'commander';
import { uploadSourcemaps } from './commands/sourcemaps/upload.js';

const program = new Command()
  .name('logtide')
  .description('LogTide CLI')
  .version('0.1.0');

const sourcemaps = program
  .command('sourcemaps')
  .description('Manage source maps');

sourcemaps
  .command('upload <directory>')
  .description('Upload source map files to LogTide')
  .requiredOption('--release <version>', 'Release version (e.g., 1.2.3)')
  .option('--api-key <key>', 'LogTide API key (or set LOGTIDE_API_KEY)', process.env.LOGTIDE_API_KEY)
  .option('--api-url <url>', 'LogTide API URL (or set LOGTIDE_API_URL)', process.env.LOGTIDE_API_URL ?? 'https://api.logtide.dev')
  .option('--concurrency <n>', 'Parallel uploads', '5')
  .action(async (directory: string, opts: any) => {
    await uploadSourcemaps(directory, {
      release: opts.release,
      apiKey: opts.apiKey,
      apiUrl: opts.apiUrl,
      concurrency: parseInt(opts.concurrency, 10),
    });
  });

program.parseAsync(process.argv);

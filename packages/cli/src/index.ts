import { Command } from 'commander';
import { uploadSourcemaps } from './commands/sourcemaps/upload.js';

/**
 * Normalize camelCase flag aliases to their canonical kebab-case form, so that
 * documented invocations using `--apiKey` / `--apiUrl` work alongside the
 * canonical `--api-key` / `--api-url`.
 */
export function normalizeArgv(argv: string[]): string[] {
  const aliases: Record<string, string> = {
    '--apiKey': '--api-key',
    '--apiUrl': '--api-url',
  };
  return argv.map((arg) => {
    const eq = arg.indexOf('=');
    if (eq !== -1) {
      const flag = arg.slice(0, eq);
      return (aliases[flag] ?? flag) + arg.slice(eq);
    }
    return aliases[arg] ?? arg;
  });
}

/** Build the `logtide` CLI program. */
export function buildProgram(): Command {
  const program = new Command()
    .name('logtide')
    .description('LogTide CLI')
    .version('0.1.0');

  const sourcemaps = program
    .command('sourcemaps')
    .description('Manage source maps');

  sourcemaps
    .command('upload [directory]')
    .description('Upload source map files to LogTide')
    .option('--path <directory>', 'Directory containing source maps (alternative to the positional argument)')
    .requiredOption('--release <version>', 'Release version (e.g., 1.2.3)')
    .option('--api-key <key>', 'LogTide API key (or set LOGTIDE_API_KEY)', process.env.LOGTIDE_API_KEY)
    .option('--api-url <url>', 'LogTide API URL (or set LOGTIDE_API_URL)', process.env.LOGTIDE_API_URL ?? 'https://api.logtide.dev')
    .option('--concurrency <n>', 'Parallel uploads', '5')
    .action(async (
      directory: string | undefined,
      opts: { path?: string; release: string; apiKey?: string; apiUrl: string; concurrency: string },
    ) => {
      const dir = directory ?? opts.path;
      if (!dir) {
        console.error('Error: provide a source maps directory (positional argument or --path <directory>)');
        process.exit(1);
        return;
      }
      await uploadSourcemaps(dir, {
        release: opts.release,
        apiKey: opts.apiKey ?? '',
        apiUrl: opts.apiUrl,
        concurrency: parseInt(opts.concurrency, 10),
      });
    });

  return program;
}

// Auto-run when executed as the CLI binary (skipped under the test runner).
if (!process.env.VITEST) {
  buildProgram().parseAsync(normalizeArgv(process.argv));
}

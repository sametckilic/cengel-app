import { validateWorkerEnvironment } from './config';
import { runWorker } from './run-worker';

async function main(): Promise<void> {
  const environment = validateWorkerEnvironment(process.env);
  const summary = await runWorker(environment);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});

/**
 * Minimal interactive prompts over stdin/stdout. Used only when the CLI needs
 * input it wasn't given on the command line (e.g. pasting a token at login,
 * confirming a write tool).
 */

import { createInterface } from 'node:readline';

export function isInteractive(): boolean {
  return process.stdin.isTTY === true && process.stdout.isTTY === true;
}

export async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    return await new Promise<string>((resolve) => rl.question(question, resolve));
  } finally {
    rl.close();
  }
}

/** Read a line without echoing it back (best-effort, for secrets). */
export async function promptSecret(question: string): Promise<string> {
  process.stderr.write(question);
  const stdin = process.stdin;
  const wasRaw = stdin.isRaw ?? false;
  if (stdin.isTTY) stdin.setRawMode(true);

  return await new Promise<string>((resolve) => {
    let value = '';
    const cleanup = () => {
      stdin.removeListener('data', onData);
      if (stdin.isTTY) stdin.setRawMode(wasRaw);
      stdin.pause();
    };
    const onData = (chunk: Buffer) => {
      for (const code of chunk) {
        if (code === 0x0a || code === 0x0d) {
          // Enter (LF / CR)
          cleanup();
          process.stderr.write('\n');
          resolve(value);
          return;
        } else if (code === 0x03) {
          // Ctrl-C
          cleanup();
          process.stderr.write('\n');
          process.exit(130);
        } else if (code === 0x7f || code === 0x08) {
          // Backspace / Delete
          value = value.slice(0, -1);
        } else if (code >= 0x20) {
          value += String.fromCharCode(code);
        }
      }
    };
    stdin.resume();
    stdin.on('data', onData);
  });
}

export async function confirm(question: string, defaultYes = false): Promise<boolean> {
  const suffix = defaultYes ? ' [Y/n] ' : ' [y/N] ';
  const answer = (await prompt(question + suffix)).trim().toLowerCase();
  if (answer === '') return defaultYes;
  return answer === 'y' || answer === 'yes';
}

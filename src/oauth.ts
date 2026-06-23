/**
 * Browser login via a localhost loopback handoff.
 *
 * Flow:
 *   1. Start an HTTP server on a random 127.0.0.1 port.
 *   2. Open the web app's `/cli-auth?port=…&state=…` page.
 *   3. The user signs in with the normal Google flow; the page then redirects
 *      the browser to `http://127.0.0.1:<port>/callback#<tokens>` where the
 *      hash carries the Supabase session (access/refresh tokens + the public
 *      supabase URL & anon key the CLI needs to self-refresh).
 *   4. The loopback page posts the hash back to `/store`; we resolve it here.
 *
 * Tokens travel in the URL *fragment* (never sent to a server) and are then
 * posted same-origin to the loopback, keeping them out of any logs. The random
 * `state` is echoed back and verified to bind the response to this request.
 */

import { createServer, type Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { AddressInfo } from 'node:net';
import { CliError, ExitCode } from './errors.js';
import type { OAuthCredential } from './config.js';
import { info, c } from './output.js';

const LOOPBACK_HOST = '127.0.0.1';
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

export function buildAuthUrl(appUrl: string, port: number, state: string): string {
  const base = appUrl.replace(/\/+$/, '');
  const u = new URL(`${base}/cli-auth`);
  u.searchParams.set('port', String(port));
  u.searchParams.set('state', state);
  return u.toString();
}

/** Validate and shape the handoff payload posted back by the loopback page. */
export function parseHandoff(
  data: Record<string, unknown>,
  expectedState: string,
): OAuthCredential {
  if (typeof data.state !== 'string' || data.state !== expectedState) {
    throw new CliError('Login response failed state validation (possible CSRF).', ExitCode.AUTH);
  }
  const accessToken = str(data.access_token);
  const refreshToken = str(data.refresh_token);
  const supabaseUrl = str(data.supabase_url);
  const anonKey = str(data.anon_key);
  if (!accessToken || !refreshToken || !supabaseUrl || !anonKey) {
    throw new CliError('Login response was missing required fields.', ExitCode.AUTH);
  }
  const expiresAt = Number(data.expires_at);
  return {
    type: 'oauth',
    accessToken,
    refreshToken,
    supabaseUrl,
    anonKey,
    expiresAt: Number.isFinite(expiresAt)
      ? expiresAt
      : Math.floor(Date.now() / 1000) + 3600,
  };
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

const SUCCESS_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>datavessel CLI</title>
<style>body{font-family:system-ui,sans-serif;max-width:32rem;margin:18vh auto;text-align:center;color:#111}
.muted{color:#666}</style></head><body>
<h2 id="msg">Finishing sign-in…</h2><p class="muted" id="sub">One moment.</p>
<script>
(async () => {
  const params = new URLSearchParams(location.hash.slice(1));
  const payload = Object.fromEntries(params.entries());
  try {
    const r = await fetch('/store', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    if (!r.ok) throw new Error(await r.text());
    document.getElementById('msg').textContent = 'You are signed in ✓';
    document.getElementById('sub').textContent = 'You can close this tab and return to the terminal.';
  } catch (e) {
    document.getElementById('msg').textContent = 'Sign-in failed';
    document.getElementById('sub').textContent = String(e);
  }
})();
</script></body></html>`;

function readBody(stream: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve) => {
    let d = '';
    stream.on('data', (c2) => (d += c2));
    stream.on('end', () => resolve(d));
  });
}

function openBrowser(url: string): void {
  const platform = process.platform;
  const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
    child.on('error', () => {
      /* fall back to printed URL */
    });
    child.unref();
  } catch {
    /* ignore; URL is printed regardless */
  }
}

export interface BrowserLoginOptions {
  appUrl: string;
  timeoutMs?: number;
  open?: boolean;
}

/** Run the full browser handoff and resolve with the captured OAuth session. */
export function loginViaBrowser(opts: BrowserLoginOptions): Promise<OAuthCredential> {
  const state = randomUUID();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return new Promise<OAuthCredential>((resolve, reject) => {
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      server.close();
      fn();
    };

    const server: Server = createServer(async (req, res) => {
      const url = req.url ?? '/';
      if (req.method === 'GET' && url.startsWith('/callback')) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(SUCCESS_HTML);
        return;
      }
      if (req.method === 'POST' && url.startsWith('/store')) {
        try {
          const body = await readBody(req);
          const data = JSON.parse(body || '{}') as Record<string, unknown>;
          const credential = parseHandoff(data, state);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end('{"ok":true}');
          finish(() => resolve(credential));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false }));
          finish(() => reject(err));
        }
        return;
      }
      res.writeHead(404);
      res.end();
    });

    const timer = setTimeout(() => {
      finish(() =>
        reject(new CliError('Timed out waiting for browser sign-in.', ExitCode.AUTH)),
      );
    }, timeoutMs);

    server.on('error', (err) =>
      finish(() => reject(new CliError(`Could not start local login server: ${err.message}`))),
    );

    server.listen(0, LOOPBACK_HOST, () => {
      const { port } = server.address() as AddressInfo;
      const authUrl = buildAuthUrl(opts.appUrl, port, state);
      info(`Opening your browser to sign in…`);
      info(`If it doesn't open, visit:\n  ${c.cyan(authUrl)}\n`);
      if (opts.open !== false) openBrowser(authUrl);
    });
  });
}

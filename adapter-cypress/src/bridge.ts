import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';

export type BridgeCommand = {
  id: string;
  op: string;
  [key: string]: unknown;
};

export type BridgeResult = {
  id: string;
  ok: boolean;
  value?: unknown;
  error?: string;
};

type Pending = {
  cmd: BridgeCommand;
  resolve: (result: BridgeResult) => void;
  reject: (err: Error) => void;
};

/**
 * Local HTTP command bridge between NATL (Node) and a Cypress long-running spec.
 * Cypress `cy.task` polls `/poll`; results post to `/result`.
 */
export class CommandBridge {
  private server: Server | null = null;
  private port = 0;
  private queue: Pending[] = [];
  private waiters: Array<(cmd: BridgeCommand | null) => void> = [];
  private results = new Map<string, (r: BridgeResult) => void>();
  private closed = false;
  private readyResolve: (() => void) | null = null;
  private readyPromise: Promise<void>;

  constructor() {
    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve;
    });
  }

  get address(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  async start(): Promise<string> {
    this.server = createServer((req, res) => {
      void this.handle(req, res);
    });
    await new Promise<void>((resolve, reject) => {
      this.server!.listen(0, '127.0.0.1', () => resolve());
      this.server!.on('error', reject);
    });
    const addr = this.server.address();
    if (!addr || typeof addr === 'string') {
      throw new Error('CommandBridge: failed to bind local port');
    }
    this.port = addr.port;
    return this.address;
  }

  /** Resolves when Cypress has started polling (session alive). */
  whenReady(timeoutMs = 120_000): Promise<void> {
    return Promise.race([
      this.readyPromise,
      new Promise<void>((_, reject) => {
        setTimeout(
          () =>
            reject(
              new Error(
                `Cypress adapter: timed out waiting for Cypress session (${timeoutMs}ms). ` +
                  `Install peer: npm install cypress && npx cypress install`,
              ),
            ),
          timeoutMs,
        );
      }),
    ]);
  }

  async call(op: string, payload: Record<string, unknown> = {}, timeoutMs = 60_000): Promise<unknown> {
    if (this.closed) throw new Error('Cypress adapter: bridge is closed');
    const id = randomUUID();
    const cmd: BridgeCommand = { id, op, ...payload };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.results.delete(id);
        reject(new Error(`Cypress adapter: command "${op}" timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      const pending: Pending = {
        cmd,
        resolve: (result) => {
          clearTimeout(timer);
          if (result.ok) resolve(result.value);
          else reject(new Error(result.error ?? `Cypress command "${op}" failed`));
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      };

      this.results.set(id, pending.resolve);
      const waiter = this.waiters.shift();
      if (waiter) waiter(cmd);
      else this.queue.push(pending);
    });
  }

  async close(): Promise<void> {
    if (this.closed) return;
    try {
      await this.call('end', {}, 15_000);
    } catch {
      // session may already be gone
    }
    this.closed = true;
    for (const w of this.waiters) w(null);
    this.waiters = [];
    for (const p of this.queue) {
      p.reject(new Error('Cypress adapter: bridge closed'));
    }
    this.queue = [];
  }

  async shutdown(): Promise<void> {
    await this.close();
    await new Promise<void>((resolve) => {
      this.server?.close(() => resolve());
      if (!this.server) resolve();
    });
    this.server = null;
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const url = new URL(req.url ?? '/', `http://127.0.0.1:${this.port}`);
      if (req.method === 'GET' && url.pathname === '/health') {
        this.json(res, 200, { ok: true });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/poll') {
        if (this.readyResolve) {
          this.readyResolve();
          this.readyResolve = null;
        }
        const waitMs = Number(url.searchParams.get('wait') ?? 120000);
        const cmd = await this.nextCommand(waitMs);
        this.json(res, 200, cmd);
        return;
      }
      if (req.method === 'POST' && url.pathname === '/result') {
        const body = await readJson(req);
        const id = String(body.id ?? '');
        const resolve = this.results.get(id);
        if (resolve) {
          this.results.delete(id);
          resolve({
            id,
            ok: Boolean(body.ok),
            value: body.value,
            error: body.error != null ? String(body.error) : undefined,
          });
        }
        this.json(res, 200, { ok: true });
        return;
      }
      this.json(res, 404, { error: 'not found' });
    } catch (err) {
      this.json(res, 500, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private nextCommand(waitMs: number): Promise<BridgeCommand | null> {
    if (this.closed) return Promise.resolve(null);
    const queued = this.queue.shift();
    if (queued) return Promise.resolve(queued.cmd);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.indexOf(onCmd);
        if (idx >= 0) this.waiters.splice(idx, 1);
        resolve(null);
      }, waitMs);
      const onCmd = (cmd: BridgeCommand | null) => {
        clearTimeout(timer);
        resolve(cmd);
      };
      this.waiters.push(onCmd);
    });
  }

  private json(res: ServerResponse, status: number, body: unknown): void {
    const data = JSON.stringify(body);
    res.writeHead(status, {
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(data),
    });
    res.end(data);
  }
}

function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8') || '{}';
        resolve(JSON.parse(raw) as Record<string, unknown>);
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

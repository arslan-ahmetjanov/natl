export interface ApiRequest {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
}

export interface ApiResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  ok: boolean;
}

export async function httpRequest(req: ApiRequest): Promise<ApiResponse> {
  const controller = new AbortController();
  const timer =
    req.timeout !== undefined
      ? setTimeout(() => controller.abort(), req.timeout)
      : undefined;

  try {
    const headers: Record<string, string> = { ...(req.headers ?? {}) };
    let body: string | undefined;
    if (req.body !== undefined && req.body !== null) {
      if (typeof req.body === 'string') {
        body = req.body;
      } else {
        body = JSON.stringify(req.body);
        if (!headers['Content-Type'] && !headers['content-type']) {
          headers['Content-Type'] = 'application/json';
        }
      }
    }

    const res = await fetch(req.url, {
      method: req.method.toUpperCase(),
      headers,
      body: ['GET', 'HEAD'].includes(req.method.toUpperCase()) ? undefined : body,
      signal: controller.signal,
    });

    const text = await res.text();
    let parsed: unknown = text;
    const ct = res.headers.get('content-type') ?? '';
    if (ct.includes('application/json') && text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    const headerObj: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      headerObj[k] = v;
    });

    return {
      status: res.status,
      headers: headerObj,
      body: parsed,
      ok: res.ok,
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

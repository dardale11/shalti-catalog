const TOKEN_KEY = { shop: 'shalti.shopToken', admin: 'shalti.adminToken' } as const;
type Role = keyof typeof TOKEN_KEY;

export const getToken = (role: Role) => localStorage.getItem(TOKEN_KEY[role]);
export const clearToken = (role: Role) => localStorage.removeItem(TOKEN_KEY[role]);

export class AuthError extends Error {}

export async function login(role: Role, secret: string) {
  const r = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, secret }),
  });
  if (!r.ok) throw new AuthError('wrong code');
  const { token } = await r.json();
  localStorage.setItem(TOKEN_KEY[role], token);
}

async function request<T>(role: Role, method: string, url: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${getToken(role) ?? ''}` };
  let payload: BodyInit | undefined;
  if (body instanceof Blob) {
    headers['Content-Type'] = body.type;
    payload = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const r = await fetch(url, { method, headers, body: payload });
  if (r.status === 401) {
    clearToken(role);
    throw new AuthError('unauthorized');
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || r.statusText);
  return data as T;
}

export const shopGet = <T>(url: string) => request<T>('shop', 'GET', url);

export const admin = {
  get: <T>(url: string) => request<T>('admin', 'GET', `/api/admin${url}`),
  post: <T>(url: string, body?: unknown) => request<T>('admin', 'POST', `/api/admin${url}`, body),
  put: <T>(url: string, body: unknown) => request<T>('admin', 'PUT', `/api/admin${url}`, body),
  del: (url: string) => request<{ ok: true }>('admin', 'DELETE', `/api/admin${url}`),
};

export const eventsUrl = () => `/api/events?t=${encodeURIComponent(getToken('shop') ?? getToken('admin') ?? '')}`;

import AsyncStorage from '@react-native-async-storage/async-storage';

export const BASE_URL = 'https://proxyapp-backend-518q.onrender.com/';

// export const BASE_URL = 'http://192.168.1.2:3001/';

export class ApiError extends Error {
  status: number;
  body: any;
  constructor(message: string, status: number, body: any) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler) {
  onUnauthorized = handler;
}

async function authHeaders(isFormData: boolean): Promise<Record<string, string>> {
  const token = await AsyncStorage.getItem('token');
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!isFormData) headers['Content-Type'] = 'application/json';
  return headers;
}

function buildUrl(path: string, params?: Record<string, any>) {
  let url = BASE_URL + path;
  if (params) {
    const query = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    if (query) url += `?${query}`;
  }
  return url;
}

async function handleResponse(res: Response) {
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (res.status === 401) {
    await AsyncStorage.removeMany(['token', 'userDetail']);
    onUnauthorized?.();
  }
  if (!res.ok) {
    throw new ApiError(body?.message || `Request failed with status ${res.status}`, res.status, body);
  }
  return body;
}

async function doFetch(url: string, init: RequestInit) {
  try {
    return await fetch(url, init);
  } catch {
    throw new ApiError(`Cannot reach the server at ${BASE_URL}`, 0, null);
  }
}

async function send(method: 'POST' | 'PUT' | 'DELETE', path: string, data?: any) {
  const isFormData = data instanceof FormData;
  const headers = await authHeaders(isFormData);
  const res = await doFetch(BASE_URL + path, {
    method,
    headers,
    body: data === undefined ? undefined : isFormData ? data : JSON.stringify(data),
  });
  return handleResponse(res);
}

export const apiClient = {
  async get(path: string, params?: Record<string, any>) {
    const headers = await authHeaders(false);
    const res = await doFetch(buildUrl(path, params), { method: 'GET', headers });
    return handleResponse(res);
  },
  post: (path: string, data?: any) => send('POST', path, data),
  put: (path: string, data?: any) => send('PUT', path, data),
  delete: (path: string, data?: any) => send('DELETE', path, data),
};

import { QueryCache, QueryClient, QueryFunction, MutationCache } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

const API_BASE = ".";

export class ApiError extends Error {
  status: number;
  retryAfterSeconds?: number;

  constructor(message: string, status: number, retryAfterSeconds?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

let _csrfToken: string | null = null;

function captureCsrfToken(res: Response): void {
  const token = res.headers.get("X-CSRF-Token");
  if (token) _csrfToken = token;
}

async function getCsrfToken(): Promise<string | null> {
  if (_csrfToken) return _csrfToken;
  const res = await fetch(`${API_BASE}/api/events?limit=1`);
  captureCsrfToken(res);
  return _csrfToken;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    let retryAfterSeconds: number | undefined;
    const headerVal = res.headers.get("Retry-After") ?? res.headers.get("retry-after");
    if (headerVal) {
      retryAfterSeconds = Number.parseInt(headerVal, 10);
      if (Number.isNaN(retryAfterSeconds) || retryAfterSeconds < 0) retryAfterSeconds = undefined;
    }
    if (retryAfterSeconds === undefined) {
      try {
        const body = JSON.parse(text);
        if (typeof body.retryAfter === "number") retryAfterSeconds = body.retryAfter;
      } catch {
        /* non-JSON body — leave retryAfterSeconds unset */
      }
    }
    throw new ApiError(`${res.status}: ${text}`, res.status, retryAfterSeconds);
  }
}

const lastErrorToastAt = { query: 0, mutation: 0 };
const ERROR_TOAST_THROTTLE_MS = 5000;

function handleErrorToast(error: unknown, kind: "query" | "mutation"): void {
  if (error instanceof ApiError) {
    const now = Date.now();
    if (now - lastErrorToastAt[kind] < ERROR_TOAST_THROTTLE_MS) return;
    if (error.status === 429) {
      const wait = error.retryAfterSeconds ? ` Retry in ${error.retryAfterSeconds}s.` : "";
      toast({
        variant: "destructive",
        title: "Rate limited",
        description: `Too many requests.${wait}`,
      });
      lastErrorToastAt[kind] = now;
    } else {
      toast({
        variant: "destructive",
        title: "Something went wrong",
        description: "Unable to load data. Please try again.",
      });
      lastErrorToastAt[kind] = now;
    }
  }
}

export async function apiRequest(method: string, url: string, data?: unknown | undefined): Promise<Response> {
  const headers: Record<string, string> = {};

  if (data) {
    headers["Content-Type"] = "application/json";
  }

  if (method !== "GET") {
    const csrfToken = await getCsrfToken();
    if (csrfToken) {
      headers["X-CSRF-Token"] = csrfToken;
    }
  }

  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  captureCsrfToken(res);
  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: { on401: UnauthorizedBehavior }) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const path = queryKey.join("/").replace(/\/\/+/g, "/");
    const res = await fetch(`${API_BASE}${path}`);

    captureCsrfToken(res);

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => handleErrorToast(error, "query"),
  }),
  mutationCache: new MutationCache({
    onError: (error) => handleErrorToast(error, "mutation"),
  }),
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

/** Exported for testing only */
export function __resetCsrfToken(): void {
  _csrfToken = null;
}

export function __setCsrfToken(token: string | null): void {
  _csrfToken = token;
}
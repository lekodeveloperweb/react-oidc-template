import { OIDC_CONFIG } from "@/settings/oidc-config";

const MAX_RETRIES = 3;
const TIMEOUT_MS = 30000;

interface ApiError extends Error {
  status: number;
  endpoint: string;
}

// Retrieve the access token from oidc-client-ts storage
const getAuthToken = () => {
  const oidcStorage = localStorage.getItem(
    `oidc.user:${OIDC_CONFIG.authority}:${OIDC_CONFIG.client_id}`,
  );
  if (oidcStorage) {
    return JSON.parse(oidcStorage).access_token;
  }
  return null;
};

// Custom fetch wrapper for Orval
export const customFetch = async <T>(
  url: string,
  options: RequestInit,
): Promise<T> => {
  // Read the environment object dynamically so the values are resolved at
  // runtime (and remain mockable in tests) rather than being statically
  // inlined into literals by Vite at transform time.
  const env = import.meta.env;
  const baseUrl = env.VITE_API_URL || "http://localhost:8081";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      // Only prepend baseUrl if URL doesn't already have a protocol
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = baseUrl + url;
      }

      const token = getAuthToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      // Merge existing headers from options
      if (options.headers) {
        if (options.headers instanceof Headers) {
          options.headers.forEach((value, key) => {
            headers[key] = value;
          });
        } else if (Array.isArray(options.headers)) {
          options.headers.forEach(([key, value]) => {
            headers[key] = value;
          });
        } else {
          Object.assign(headers, options.headers);
        }
      }
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(errorText || `HTTP ${response.status}`);
        (error as ApiError).status = response.status;
        (error as ApiError).endpoint = url;

        // Retry on 5xx errors or network errors (except 404 which is permanent)
        if (response.status >= 500 || response.status === 0) {
          if (attempt < MAX_RETRIES) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
        }

        throw error;
      }

      if (response.status === 204) {
        return {} as T;
      }

      const text = await response.text();
      return text ? JSON.parse(text) : ({} as T);
    } catch (error) {
      const err = error as Error;
      const apiError = err as ApiError;

      if (apiError.status === 404 && attempt === MAX_RETRIES) {
        throw error;
      }

      if (attempt === MAX_RETRIES) {
        throw error;
      }

      const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error("Max retries exceeded");
};

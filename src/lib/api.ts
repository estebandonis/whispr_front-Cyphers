import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_SERVER_URL,
  withCredentials: true,
});

// Request interceptor is no longer needed since cookies are automatically sent
// api.interceptors.request.use((config) => {
//   return config;
// });

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  config: any;
}> = [];

const createError = (error: unknown): Error => {
  if (error instanceof Error) {
    return error;
  }
  if (typeof error === "object" && error !== null) {
    return new Error(JSON.stringify(error));
  }
  return new Error(String(error));
};

const processQueue = (error: unknown) => {
  for (const prom of failedQueue) {
    if (error) {
      prom.reject(createError(error));
    } else {
      api(prom.config).then(prom.resolve).catch(prom.reject);
    }
  }
  failedQueue = [];
};

/**
 * Check if error is 401 and request hasn't been retried
 */
const isUnauthorizedRetryable = (error: any, originalRequest: any): boolean => {
  return (
    error.response &&
    error.response.status === 401 &&
    !originalRequest._retry
  );
};

/**
 * Check if endpoint should skip token refresh
 */
const shouldSkipRefresh = (url: string | undefined): boolean => {
  return url?.includes("/auth/") || url?.includes("/user/me") || false;
};

/**
 * Handle token refresh failure
 */
const handleRefreshFailure = (refreshError: unknown): never => {
  console.error("Error refreshing token:", refreshError);
  processQueue(refreshError);
  if ((globalThis as typeof window).location.pathname !== "/") {
    (globalThis as typeof window).location.href = "/";
  }
  throw createError(refreshError);
};

/**
 * Attempt to refresh token and retry request
 */
const refreshTokenAndRetry = async (originalRequest: any) => {
  originalRequest._retry = true;
  isRefreshing = true;

  try {
    await api.post("/auth/refresh-token");
    processQueue(null);
    return api(originalRequest);
  } catch (refreshError: unknown) {
    handleRefreshFailure(refreshError);
  } finally {
    isRefreshing = false;
  }
};

// Simplified response interceptor for cookie-based auth
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (isUnauthorizedRetryable(error, originalRequest)) {
      if (shouldSkipRefresh(originalRequest.url)) {
        throw createError(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject, config: originalRequest });
        });
      }

      return refreshTokenAndRetry(originalRequest);
    }

    throw createError(error);
  }
);

export default api;

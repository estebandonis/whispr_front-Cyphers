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

const processQueue = (error: unknown) => {
  for (const prom of failedQueue) {
    if (error) {
      prom.reject(error instanceof Error ? error : new Error(String(error)));
    } else {
      api(prom.config).then(prom.resolve).catch(prom.reject);
    }
  }
  failedQueue = [];
};

// Simplified response interceptor for cookie-based auth
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check if the error is due to token expiration (e.g., 401 Unauthorized)
    // and the request hasn't already been retried.
    if (
      error.response &&
      error.response.status === 401 &&
      !originalRequest._retry
    ) {
      // Don't try to refresh for auth-related endpoints or user check endpoints
      if (
        originalRequest.url?.includes("/auth/") ||
        originalRequest.url?.includes("/user/me")
      ) {
        throw error instanceof Error ? error : new Error(String(error));
      }

      if (isRefreshing) {
        // If currently refreshing, queue the original request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject, config: originalRequest });
        });
      }

      originalRequest._retry = true; // Mark the request as retried
      isRefreshing = true;

      try {
        // Try to refresh the token using cookies
        // The refresh token is automatically sent via cookies
        await api.post("/auth/refresh-token");

        processQueue(null); // Process queued requests
        return api(originalRequest); // Retry the original request
      } catch (refreshError: unknown) {
        console.error("Error refreshing token:", refreshError);

        // If refresh fails, redirect to login
        processQueue(refreshError); // Reject queued requests

        // Only redirect if we're not already on the login page
        if ((globalThis as typeof window).location.pathname !== "/") {
          (globalThis as typeof window).location.href = "/";
        }

        throw refreshError instanceof Error
          ? refreshError
          : new Error(String(refreshError));
      } finally {
        isRefreshing = false;
      }
    }

    // For other errors or if it's a retry that failed again, reject the promise
    throw error instanceof Error ? error : new Error(String(error));
  }
);

export default api;

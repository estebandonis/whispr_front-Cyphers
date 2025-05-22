import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_SERVER_URL,
});

api.interceptors.request.use((config) => {
  const access_token = localStorage.getItem("access_token");
  if (access_token) {
    config.headers.Authorization = `Bearer ${access_token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  config: any;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.config.headers["Authorization"] = `Bearer ${token}`;
      api(prom.config).then(prom.resolve).catch(prom.reject);
    }
  });
  failedQueue = [];
};

interface AxiosErrorLike {
  response?: {
    data?: unknown;
  };
  message?: string;
}

// Add response interceptor to handle token expiration and refresh
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
      if (isRefreshing) {
        // If currently refreshing, queue the original request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject, config: originalRequest });
        });
      }

      originalRequest._retry = true; // Mark the request as retried
      isRefreshing = true;

      const refreshToken = localStorage.getItem("refresh_token"); // Assumed key for refresh token
      const userId = localStorage.getItem("userId"); // Get userId from localStorage

      if (!refreshToken || !userId) {
        console.log("No refresh token or userId available. Clearing tokens.");
        localStorage.removeItem("access_token"); // Changed from jwt-token
        localStorage.removeItem("refresh_token"); // Ensure refresh token is also cleared
        if (!userId) {
          console.error(
            "userId not found in localStorage. Cannot refresh token."
          );
        }
        // Potentially redirect to login page or dispatch a logout action
        isRefreshing = false;
        processQueue(error, null); // Reject queued requests
        return Promise.reject(error);
      }

      try {
        // Use a direct axios.post call for the refresh token request
        // to avoid circular dependency with the interceptor.
        // Updated endpoint and request body
        const refreshResponse = await axios.post(
          `${import.meta.env.VITE_SERVER_URL}/auth/refresh-token`, // Changed endpoint
          { userId: userId, refresh_token: refreshToken } // Changed body
        );

        // Assumed response structure: { access_token: "new-access-token", refresh_token: "new-refresh-token" }
        const newAccessToken = refreshResponse.data.access_token; // Changed from accessToken
        const newRefreshToken = refreshResponse.data.refresh_token; // Changed from refreshToken

        localStorage.setItem("access_token", newAccessToken); // Changed from jwt-token
        localStorage.setItem("refresh_token", newRefreshToken);

        // Update the default Authorization header for new requests
        if (api.defaults.headers.common) {
          api.defaults.headers.common[
            "Authorization"
          ] = `Bearer ${newAccessToken}`;
        }
        // Update the Authorization header for the original request
        originalRequest.headers["Authorization"] = `Bearer ${newAccessToken}`;

        processQueue(null, newAccessToken); // Process queued requests with the new token
        return api(originalRequest); // Retry the original request with the new token
      } catch (refreshError: unknown) {
        const err = refreshError as AxiosErrorLike;
        console.error(
          "Error refreshing token:",
          err.response?.data || err.message
        );
        localStorage.removeItem("access_token"); // Changed from jwt-token
        localStorage.removeItem("refresh_token");
        // Potentially redirect to login page or dispatch a logout action

        processQueue(refreshError, null); // Reject queued requests with the refresh error
        // Prefer rejecting with the error from the refresh attempt
        return Promise.reject(
          (refreshError as AxiosErrorLike).response?.data ? refreshError : error
        );
      } finally {
        isRefreshing = false;
      }
    }

    // For other errors or if it's a retry that failed again, reject the promise
    return Promise.reject(error);
  }
);

export default api;

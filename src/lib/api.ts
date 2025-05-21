import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_SERVER_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("jwt-token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add response interceptor to handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem("jwt-token");
      console.log("Token expired");
    }
    return Promise.reject(error);
  }
);

export default api;

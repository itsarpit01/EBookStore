import axios from "axios";

export const API_URL = "http://localhost:5001/api";
export const SERVER_URL = "http://localhost:5001";

export const getImageUrl = (path) => {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${SERVER_URL}${path.startsWith("/") ? "" : "/"}${path}`;
};

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const url = error.config?.url || "";
    const skip = url.includes("/auth/login") || url.includes("/auth/me");
    if (error.response?.status === 401 && !skip) {
      window.dispatchEvent(new Event("auth:logout"));
    }
    return Promise.reject(error);
  }
);

export default api;
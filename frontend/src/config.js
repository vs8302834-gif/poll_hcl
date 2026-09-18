const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8080";

const WS_URL = API_URL.replace(/^http/, "ws");

export { API_URL, WS_URL };
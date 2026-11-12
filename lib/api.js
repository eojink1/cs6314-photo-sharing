import axios from 'axios';

// Use this one instance for all application requests.
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001" });

export default api;

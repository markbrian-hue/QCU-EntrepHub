import axios from 'axios';

// Create a global instance for API calls
const api = axios.create({
  baseURL: '/api', 
  // REMOVED: headers: { 'Content-Type': 'application/json' } 
  // Axios will now automatically set the correct header for Files vs Text
});

export default api;
import axios from 'axios'; 

const axiosInstance = axios.create({
  baseURL: 'http://localhost:5000',
});


export const setAuthToken = (token) => {
  if (token) { 
    axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else { 
    delete axiosInstance.defaults.headers.common['Authorization'];
  }
};
export default axiosInstance;

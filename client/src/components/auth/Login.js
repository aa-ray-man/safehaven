import React, { useState, useEffect } from 'react'; 
import { Link, useNavigate } from 'react-router-dom'; 
import { useAuth } from '../../context/AuthContext'; 
import './Auth.css'; //for CSS of this page 

const Login = () => {
  // State Management
  const [formData, setFormData] = useState({ 
    email: '',    
    password: '' 
  });
  const [localError, setLocalError] = useState(''); 
  const [loading, setLoading] = useState(false); 
  const [successMessage, setSuccessMessage] = useState(''); 
  

  const { login, error, setError, isAuthenticated } = useAuth(); 
  const navigate = useNavigate(); 

  const { email, password } = formData;

  useEffect(() => {
    setError(null);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    

    if (localError) setLocalError('');
    if (error) setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); 
    setLocalError('');  
    setError(null);     

    if (!email || !password) {
      return setLocalError('Please fill in all fields');
    }
    
    setLoading(true); 

    try {
      await login(email, password);
      
      setSuccessMessage('Login successful! Redirecting to dashboard...');
      setTimeout(() => {
        navigate('/dashboard');
      }, 1000);
    } 
    catch (err) {  
      if (err.response) {
        switch(err.response.status) {
          case 401:
            setLocalError('Invalid email or password. Please try again.');
            break;
          case 404:
            setLocalError('Account not found. Please check your email or sign up.');
            break;
          default:
            setLocalError(err.response.data?.error || 'Login failed. Please try again.');
        }
      } 
      else if (err.request) {
        setLocalError('Network error. Please check your internet connection.');
      } 
      else {
        setLocalError('An unexpected error occurred. Please try again later.');
      }
    } 
    finally {
      setLoading(false); 
    }
  };
  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h2>Welcome Back</h2>
          <p>Log in to SafeHaven and stay connected, stay safe</p>
        </div>
        
        {(localError || error) && ( 
          <div className="error-message-container"> 
            <div className="error-message">{localError || error}</div>
          </div>
        )}
        
        {successMessage && (
          <div className="success-message-container">
            <div className="success-message">{successMessage}</div>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="auth-form">

          <div className="form-group">
            <label htmlFor="email">EMAIL ADDRESS</label>
            <input 
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={handleChange} 
              required 
              placeholder="Enter your email address"
            />
          </div>
          
          <div className="form-group"> 
            <label htmlFor="password">PASSWORD</label>
            <input
              type="password"
              id="password"
              name="password"
              value={password}
              onChange={handleChange}
              required
              placeholder="Enter your password"
              minLength="8"
            />
          </div>
          
          <div className="form-actions">
            <button 
              type="submit" 
              className="primary-button"
              disabled={loading}
            >
              {loading ? 'Logging in...' : 'Log In'}
            </button>
          </div>
        </form>
        
        <div className="auth-footer">
          <p>Don't have an account? <Link to="/signup" className="gradient-text">Sign up</Link></p>
          <Link to="/forgot-password" className="forgot-password">Forgot password?</Link>
        </div>
      </div>
    </div>
  );
};
export default Login;
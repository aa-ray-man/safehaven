import React, { useState } from 'react'; 
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import './Auth.css';

const Signup = () => {

  const [formData, setFormData] = useState({
    name: '',             
    email: '',            
    phone: '',            
    password: '',         
    confirmPassword: ''  
  });

  const [error, setError] = useState(''); 
  const [loading, setLoading] = useState(false); 

  const { register } = React.useContext(AuthContext); 
  const navigate = useNavigate(); 

  const { name, email, phone, password, confirmPassword } = formData;

  const handleChange = (e) => {
    setFormData({ 
      ...formData, 
      [e.target.name]: e.target.value 
    });
  }; 

  const handleSubmit = async (e) => {
    e.preventDefault(); 
    setError(''); 

    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }

    setLoading(true); 

    try {
      await register(name, email, password, phone);
      
      navigate('/dashboard');
    } 
    catch (err) {
      if (err.response) {
        const errorData = err.response.data;

        if (typeof errorData === 'string' && errorData.includes('Cannot POST')) {
          setError('Server error: Unable to process registration. Please try again later.');
        } else if (errorData?.error) {
          if (errorData.error.includes('already exists')) {
            setError('This email is already registered. Please use a different email.');
          } else {
            setError(errorData.error);
          }
        } else {
          setError('Registration failed. Please try again.');
        }
      } else if (err.request) {
        setError('Network error. Please check your internet connection.');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
      
      setLoading(false); 
    }
  };

  return (
    <div className="auth-container">
      <div className="gradient-overlay"></div>
      <div className="particles">
        {[...Array(12)].map((_, i) => (
          <div key={i} className={`particle particle-${i}`}></div>
        ))}
      </div>

      <div className="auth-card">
        <div className="auth-header">
          <h2>Create Your Account</h2>
          <p>Join SafeHaven today and stay connected, stay safe</p>
        </div>
        
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="name">FULL NAME</label>
            <input
              type="text"
              id="name"
              name="name"
              value={name}
              onChange={handleChange}
              required
              placeholder="Enter your full name"
            />
          </div>
          
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
            <label htmlFor="phone">PHONE NUMBER</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={phone}
              onChange={handleChange}
              placeholder="Enter your phone number (optional)"
              pattern="[0-9]{10}"
              title="Please enter a valid 10-digit phone number"
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
              placeholder="Create a password (min. 8 characters)"
              minLength="8"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="confirmPassword">CONFIRM PASSWORD</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={confirmPassword}
              onChange={handleChange}
              required
              placeholder="Confirm your password"
              minLength="8"
            />
          </div>
          
          <div className="form-actions">
            <button 
              type="submit" 
              className="primary-button"
              disabled={loading} 
            >
              {loading ? 'Creating Account...' : 'Sign Up'}
            </button>
          </div>
        </form>
        
        {error && (
          <div className="error-message-container">
            <div className="error-message">{error}</div>
          </div>
        )}
        
        <div className="auth-footer">
          <p>Already have an account? <Link to="/login" className="gradient-text">Log in</Link></p>
        </div>
      </div>
    </div>
  );
};
export default Signup;
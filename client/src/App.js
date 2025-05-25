import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import Testimonials from './components/Testimonials';
import Footer from './components/Footer';
import Chatbot from './components/Chatbot';
import EmergencySOS from './components/EmergencySOS';
import SafetyMap from './components/safetyMap/SafetyMap';
import Login from './components/auth/Login';
import Signup from './components/auth/Signup';
import Dashboard from './components/Dashboard';
import { AuthProvider, useAuth } from './context/AuthContext';

import './App.css';

function App() {
  return (
    <Router>  
      <AuthProvider>
        <div className="App">
          <Routes>
            <Route path="/" element={<MainContentWithLayout />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardWithLayout /></ProtectedRoute>} />
          </Routes>
        </div>
      </AuthProvider>
    </Router>
  );
}
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }
  return isAuthenticated ? children : <Navigate to="/login" />;
};
const MainContentWithLayout = () => {
  const { isAuthenticated } = useAuth();

  return isAuthenticated ? (
    <>
      <Navbar />
      <Hero />
      <Features />
      <SafetyMap />
      <Testimonials />
      <EmergencySOS />
      <Chatbot />
      <Footer />
    </>
  ) : (
    <Navigate to="/login" /> 
  );
};

const DashboardWithLayout = () => {
  return (
    <>
      <Navbar />
      <Dashboard />
      <Footer />
    </>
  );
};

const LoginPage = () => {
  const { isAuthenticated } = useAuth();

  return isAuthenticated ? <Navigate to="/dashboard" /> : <Login />;
};
const SignupPage = () => {
  const { isAuthenticated } = useAuth();

  return isAuthenticated ? <Navigate to="/dashboard" /> : <Signup />;
};
export default App;
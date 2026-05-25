import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';

// Layouts
import MainLayout from './layouts/MainLayout';
import AuthLayout from './layouts/AuthLayout';
import DashboardLayout from './layouts/DashboardLayout';

// Pages
import Home from './pages/Home';
import Features from './pages/Features';
import PricingPage from './pages/PricingPage';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsConditions from './pages/TermsConditions';
import RefundPolicy from './pages/RefundPolicy';
import ShippingPolicy from './pages/ShippingPolicy';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Listings from './pages/Listings';
import CreateListing from './pages/CreateListing';
import Rules from './pages/Rules';
import EbayAccounts from './pages/EbayAccounts';
import Subscription from './pages/Subscription';
import Settings from './pages/Settings';
import Checkout from './pages/Checkout';
import Testimonials from './pages/Testimonials';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminSettings from './pages/admin/AdminSettings';

// Components
import ProtectedRoute from './components/ProtectedRoute';

// Domain Routing Guard Component
const DomainRedirect = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const hostname = window.location.hostname;
    const isDev = hostname === 'localhost' || hostname === '127.0.0.1';
    
    // Check if we should enforce domain routing:
    // Only in production, or if the dev hostname explicitly contains a subdomain
    const shouldRedirect = !isDev || hostname.startsWith('app.');
    if (!shouldRedirect) return;

    const isAppSubdomain = hostname.startsWith('app.');
    const currentPath = location.pathname;
    
    const port = window.location.port ? `:${window.location.port}` : '';
    const landingBase = isDev ? `http://localhost${port}` : 'https://elister.ai';
    const appBase = isDev ? `http://app.localhost${port}` : 'https://app.elister.ai';

    const appPaths = [
      '/login',
      '/signup',
      '/dashboard',
      '/listings',
      '/create-listing',
      '/rules',
      '/ebay-accounts',
      '/ebay-callback',
      '/subscription',
      '/settings',
      '/checkout',
      '/admin'
    ];

    const isAppPath = appPaths.some(path => 
      currentPath === path || currentPath.startsWith(path + '/')
    );

    if (isAppSubdomain) {
      if (currentPath === '/') {
        // Redirect root subdomain to /dashboard (which redirects to login if unauthenticated)
        navigate('/dashboard', { replace: true });
        return;
      }
      
      if (!isAppPath) {
        // On app domain but accessing landing page path, redirect to landing domain
        window.location.href = `${landingBase}${currentPath}${location.search}`;
      }
    } else {
      // On landing page domain
      if (isAppPath) {
        // On landing domain but accessing app path, redirect to app domain
        window.location.href = `${appBase}${currentPath}${location.search}`;
      }
    }
  }, [location, navigate]);

  return children;
};

const App = () => {
  return (
    <Router>
      <DomainRedirect>
        <AnimatePresence mode="wait">
          <Routes>
          {/* Public Routes */}
          <Route element={<MainLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/features" element={<Features />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/testimonials" element={<Testimonials />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms-conditions" element={<TermsConditions />} />
            <Route path="/refund-policy" element={<RefundPolicy />} />
            <Route path="/shipping-policy" element={<ShippingPolicy />} />
          </Route>

          {/* Auth Routes */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
          </Route>

          {/* User Protected Routes */}
          <Route element={<ProtectedRoute adminOnly={false} />}>
            <Route element={<DashboardLayout isAdmin={false} />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/listings" element={<Listings />} />
              <Route path="/create-listing" element={<CreateListing />} />
              <Route path="/rules" element={<Rules />} />
              <Route path="/ebay-accounts" element={<EbayAccounts />} />
              {/* Alias for ebay callback to handle it on the same page */}
              <Route path="/ebay-callback" element={<EbayAccounts />} />
              <Route path="/subscription" element={<Subscription />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/checkout" element={<Checkout />} />
            </Route>
          </Route>

          {/* Admin Protected Routes */}
          <Route element={<ProtectedRoute adminOnly={true} />}>
            <Route element={<DashboardLayout isAdmin={true} />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
      </DomainRedirect>
    </Router>
  );
};

export default App;

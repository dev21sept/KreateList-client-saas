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
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Listings from './pages/Listings';
import CreateListing from './pages/CreateListing';
import CreateEbayListing from './pages/CreateEbayListing';
import BulkListingEbay from './pages/BulkListingEbay';
import CreatePoshmarkListing from './pages/CreatePoshmarkListing';
import CreateVintedListing from './pages/CreateVintedListing';
import CreateDepopListing from './pages/CreateDepopListing';
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

  const hostname = window.location.hostname;
  const isDev = hostname === 'localhost' || hostname === '127.0.0.1';
  
  // Check if we should enforce domain routing:
  // Only in production, or if the dev hostname explicitly contains a subdomain
  const shouldRedirect = !isDev || hostname.startsWith('app.');

  if (shouldRedirect) {
    const isAppSubdomain = hostname.startsWith('app.');
    const currentPath = location.pathname;
    
    const port = window.location.port ? `:${window.location.port}` : '';
    const landingBase = isDev ? `http://localhost${port}` : 'https://elister.ai';
    const appBase = isDev ? `http://app.localhost${port}` : 'https://app.elister.ai';

    const appPaths = [
      '/login',
      '/signup',
      '/forgot-password',
      '/reset-password',
      '/dashboard',
      '/listings',
      '/create-listing',
      '/create-ebay-listing',
      '/create-ebay-bulk-listing',
      '/create-poshmark-listing',
      '/create-vinted-listing',
      '/create-depop-listing',
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

    if (!isAppSubdomain && isAppPath) {
      window.location.replace(`${appBase}${currentPath}${location.search}`);
      return null;
    }

    if (isAppSubdomain && !isAppPath) {
      window.location.replace(`${landingBase}${currentPath}${location.search}`);
      return null;
    }
  }

  useEffect(() => {
    if (shouldRedirect) {
      const isAppSubdomain = hostname.startsWith('app.');
      const currentPath = location.pathname;
      if (isAppSubdomain && currentPath === '/') {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [location, navigate, hostname, shouldRedirect]);

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
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
          </Route>

          {/* User Protected Routes */}
          <Route element={<ProtectedRoute adminOnly={false} />}>
            <Route element={<DashboardLayout isAdmin={false} />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/listings" element={<Listings />} />
              <Route path="/create-listing" element={<CreateListing />} />
              <Route path="/create-ebay-listing" element={<CreateEbayListing />} />
              <Route path="/create-ebay-bulk-listing" element={<BulkListingEbay />} />
              <Route path="/create-poshmark-listing" element={<CreatePoshmarkListing />} />
              <Route path="/create-vinted-listing" element={<CreateVintedListing />} />
              <Route path="/create-depop-listing" element={<CreateDepopListing />} />
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

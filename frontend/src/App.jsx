import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';

// Layouts
import MainLayout from './layouts/MainLayout';
import AuthLayout from './layouts/AuthLayout';
import DashboardLayout from './layouts/DashboardLayout';
import NewDashboardLayout from './layouts/NewDashboardLayout';

// Route-level code splitting keeps the large marketplace taxonomies and page
// implementations out of the initial landing-page bundle.
const Home = lazy(() => import('./pages/Home'));
const Features = lazy(() => import('./pages/Features'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsConditions = lazy(() => import('./pages/TermsConditions'));
const RefundPolicy = lazy(() => import('./pages/RefundPolicy'));
const ShippingPolicy = lazy(() => import('./pages/ShippingPolicy'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Listings = lazy(() => import('./pages/NewListings'));
const Orders = lazy(() => import('./pages/Orders'));
const Analytics = lazy(() => import('./pages/Analytics'));
const CreateListing = lazy(() => import('./pages/CreateMasterListing'));
const CreateEbayListing = lazy(() => import('./pages/CreateEbayListing'));
const BulkListingEbay = lazy(() => import('./pages/BulkListingEbay'));
const CreatePoshmarkListing = lazy(() => import('./pages/CreatePoshmarkListing'));
const CreateEtsyListing = lazy(() => import('./pages/CreateEtsyListing'));
const CreateMercariListing = lazy(() => import('./pages/CreateMercariListing'));
const CreateAmazonListing = lazy(() => import('./pages/CreateAmazonListing'));
const Rules = lazy(() => import('./pages/Rules'));
const EbayAccounts = lazy(() => import('./pages/EbayAccounts'));
const Subscription = lazy(() => import('./pages/Subscription'));
const Settings = lazy(() => import('./pages/Settings'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Testimonials = lazy(() => import('./pages/Testimonials'));
const HelpSupport = lazy(() => import('./pages/HelpSupport'));
const AdminDashboard = lazy(() => import('./pages/admin/NewAdminDashboard'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));

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
  let externalRedirectUrl = null;

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
      '/integrations',
      '/analytics',
      '/orders',
      '/sales',
      '/create-listing',
      '/create-ebay-listing',
      '/create-ebay-bulk-listing',
      '/create-poshmark-listing',
      // '/create-depop-listing',
      '/create-etsy-listing',
      '/create-mercari-listing',
      '/create-amazon-listing',
      '/rules',
      '/ebay-accounts',
      '/ebay-callback',
      '/subscription',
      '/settings',
      '/checkout',
      '/admin',
      '/help'
    ];

    const isAppPath = appPaths.some(path => 
      currentPath === path || currentPath.startsWith(path + '/')
    );

    if (!isAppSubdomain && isAppPath) {
      externalRedirectUrl = `${appBase}${currentPath}${location.search}`;
    }

    if (isAppSubdomain && !isAppPath) {
      externalRedirectUrl = `${landingBase}${currentPath}${location.search}`;
    }
  }

  useEffect(() => {
    if (externalRedirectUrl) {
      window.location.replace(externalRedirectUrl);
      return;
    }
    if (shouldRedirect) {
      const isAppSubdomain = hostname.startsWith('app.');
      const currentPath = location.pathname;
      if (isAppSubdomain && currentPath === '/') {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [location, navigate, hostname, shouldRedirect, externalRedirectUrl]);

  if (externalRedirectUrl) return null;

  return children;
};

const App = () => {
  return (
    <Router>
      <DomainRedirect>
        <AnimatePresence mode="wait">
          <Suspense fallback={<div className="min-h-screen bg-slate-50" aria-busy="true" />}>
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
            <Route path="/support" element={<HelpSupport />} />
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
            <Route element={<NewDashboardLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/listings" element={<Listings />} />
              <Route path="/crosslisting" element={<Listings />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/sales" element={<Navigate to="/orders" replace />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/integrations" element={<EbayAccounts />} />
              <Route path="/create-listing" element={<CreateListing />} />
              <Route path="/create-ebay-listing" element={<CreateEbayListing />} />
              <Route path="/create-ebay-bulk-listing" element={<BulkListingEbay />} />
              <Route path="/create-poshmark-listing" element={<CreatePoshmarkListing />} />
              {/* <Route path="/create-depop-listing" element={<CreateDepopListing />} /> */}
              <Route path="/create-etsy-listing" element={<CreateEtsyListing />} />
              <Route path="/create-mercari-listing" element={<CreateMercariListing />} />
              <Route path="/create-amazon-listing" element={<CreateAmazonListing />} />
              <Route path="/rules" element={<Rules />} />
              <Route path="/ebay-accounts" element={<EbayAccounts />} />
              {/* Alias for ebay callback to handle it on the same page */}
              <Route path="/ebay-callback" element={<EbayAccounts />} />
              <Route path="/subscription" element={<Subscription />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/help" element={<HelpSupport />} />
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
          </Suspense>
        </AnimatePresence>
      </DomainRedirect>
    </Router>
  );
};

export default App;

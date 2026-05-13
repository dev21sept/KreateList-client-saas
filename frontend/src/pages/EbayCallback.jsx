import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ebayService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

const EbayCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loadUser } = useAuth();
  const [status, setStatus] = React.useState('loading'); // loading, success, error

  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      handleCallback(code);
    } else {
      setStatus('error');
    }
  }, [searchParams]);

  const handleCallback = async (code) => {
    try {
      await ebayService.callback(code);
      await loadUser(); // Refresh user data to get the connection status
      setStatus('success');
      setTimeout(() => {
        navigate('/ebay-accounts');
      }, 2000);
    } catch (error) {
      console.error('eBay callback error:', error);
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white p-10 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 text-center"
      >
        {status === 'loading' && (
          <div className="space-y-6">
            <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mx-auto">
              <Loader2 size={40} className="text-indigo-600 animate-spin" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-900">Connecting eBay...</h2>
              <p className="text-slate-500 font-medium">Please wait while we sync your account details.</p>
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-6">
            <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto">
              <CheckCircle2 size={40} className="text-emerald-600" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-900">Success!</h2>
              <p className="text-slate-500 font-medium">Your eBay account has been connected successfully. Redirecting you back...</p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-6">
            <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center mx-auto">
              <XCircle size={40} className="text-rose-600" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-900">Connection Failed</h2>
              <p className="text-slate-500 font-medium">Something went wrong during the connection process. Please try again.</p>
            </div>
            <button 
              onClick={() => navigate('/ebay-accounts')}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all"
            >
              Go Back
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default EbayCallback;

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft } from 'lucide-react';
import { authService } from '../services/api';
import { getLandingUrl } from '../utils/urls';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await authService.forgotPassword({ email });
      setSuccess(response.data.message || 'Reset link has been sent to your email.');
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full -z-10">
        <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-100/40 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-violet-100/40 blur-[120px] rounded-full"></div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <div className="text-center mb-10">
          <a href={getLandingUrl('/')} className="inline-flex items-center mb-8">
            <img src="/logo_vertical.png" alt="Elister.ai" className="h-24 w-auto object-contain" />
          </a>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Forgot Password</h2>
          <p className="mt-2 text-slate-600">Enter your email and we'll send you a password reset link.</p>
        </div>

        <div className="bg-white p-8 md:p-10 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
          {success ? (
            <div className="text-center space-y-6">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-emerald-100">
                <Mail className="h-6 w-6 text-emerald-600" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-950">Email Sent!</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {success}
                </p>
              </div>
              <div className="pt-4">
                <Link to="/login" className="btn-primary w-full py-3 inline-flex items-center justify-center gap-2">
                  <ArrowLeft className="w-4 h-4" /> Back to Sign In
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 text-sm font-bold rounded-xl text-center animate-shake">
                  {error}
                </div>
              )}
              
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 ml-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="email"
                    name="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@example.com"
                    className="input-field pl-12"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className={`btn-primary w-full py-4 text-lg ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {loading ? 'Sending link...' : 'Send Reset Link'}
              </button>

              <div className="text-center mt-6">
                <Link to="/login" className="inline-flex items-center gap-2 text-sm font-bold text-indigo-600 hover:underline">
                  <ArrowLeft className="w-4 h-4" /> Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ForgotPassword;

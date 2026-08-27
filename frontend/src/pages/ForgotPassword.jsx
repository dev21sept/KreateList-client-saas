import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft, Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { authService } from '../services/api';
import { getLandingUrl } from '../utils/urls';
import { useReducedMotion } from '../hooks/useReducedMotion';
import Button from '../components/ui/Button';

const ForgotPassword = () => {
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [step, setStep] = useState(1); // 1 = Enter Email, 2 = Enter OTP & New Password, 3 = Success Reset

  const handleSubmitEmail = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await authService.forgotPassword({ email });
      setSuccess(response.data.message || 'OTP code has been sent to your email.');
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      setLoading(false);
      return;
    }

    try {
      const response = await authService.resetPasswordWithOtp({
        email,
        otp,
        password
      });
      setSuccess(response.data.message || 'Password reset successfully!');
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password. Please verify your OTP code.');
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
        initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.4 }}
        className="max-w-md w-full"
      >
        <div className="text-center mb-10">
          <a href={getLandingUrl('/')} className="inline-flex items-center mb-8">
            <img src="/logo_vertical.png" alt="Elister.ai" className="h-24 w-auto object-contain" />
          </a>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {step === 1 && 'Forgot Password'}
            {step === 2 && 'Verify Reset OTP'}
            {step === 3 && 'Password Reset!'}
          </h2>
          <p className="mt-2 text-slate-600">
            {step === 1 && "Enter your email and we'll send you an OTP code."}
            {step === 2 && `Enter the 6-digit OTP code sent to ${email} and set your new password.`}
            {step === 3 && 'Your password has been changed successfully.'}
          </p>
        </div>

        <div className="bg-white p-8 md:p-10 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
          {step === 3 ? (
            <div className="text-center space-y-6">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-emerald-100">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-950">Success!</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {success}
                </p>
              </div>
              <div className="pt-4">
                <Link to="/login" className="btn-primary w-full py-3 inline-flex items-center justify-center gap-2">
                  Go to Sign In <ArrowLeft className="w-4 h-4 rotate-180" />
                </Link>
              </div>
            </div>
          ) : step === 2 ? (
            <form onSubmit={handleResetPassword} className="space-y-5">
              {error && (
                <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 text-sm font-bold rounded-xl text-center animate-shake">
                  {error}
                </div>
              )}
              {success && (
                <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 text-sm font-bold rounded-xl text-center">
                  {success}
                </div>
              )}

              {/* OTP Input */}
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 ml-1">Verification OTP</label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="input-field text-center font-bold tracking-[8px] text-xl w-full"
                />
              </div>

              {/* New Password */}
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 ml-1">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input-field pl-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 ml-1">Confirm New Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input-field pl-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={loading}
                className="w-full py-4 text-base rounded-2xl mt-2"
              >
                {loading ? 'Resetting Password...' : 'Reset Password'}
              </Button>

              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 hover:underline"
                >
                  <ArrowLeft className="w-4 h-4" /> Edit Email Address
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmitEmail} className="space-y-6">
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

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={loading}
                className="w-full py-4 text-base rounded-2xl"
              >
                {loading ? 'Sending OTP...' : 'Send Verification OTP'}
              </Button>

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

import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CreditCard, 
  CheckCircle2, 
  ArrowLeft, 
  Building2, 
  AlertCircle, 
  ShieldCheck, 
  Loader2, 
  Plus,
  Coins
} from 'lucide-react';
import { authService } from '../services/api';
import { useAuth } from '../context/AuthContext';

const Checkout = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loadUser } = useAuth();
  
  const planParam = (searchParams.get('plan') || 'PRO').toUpperCase();
  const cycleParam = searchParams.get('cycle') || 'monthly';

  const [paymentMethod, setPaymentMethod] = useState('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [error, setError] = useState('');
  const [overrideActivePlan, setOverrideActivePlan] = useState(false);
  
  // Card form state
  const [cardData, setCardData] = useState({
    number: '',
    expiry: '',
    cvv: '',
    name: ''
  });

  // UPI form state
  const [upiId, setUpiId] = useState('');

  // Plans reference
  const planPrices = {
    BASIC: 79,
    PRO: 149,
    ENTERPRISE: 299
  };

  const planNames = {
    BASIC: 'Basic Plan',
    PRO: 'Professional Pro Plan',
    ENTERPRISE: 'Enterprise Scale Plan'
  };

  const planBasePrice = planPrices[planParam] || 149;
  const cycleMultiplier = cycleParam === 'yearly' ? 12 : 1;
  const cycleLabel = cycleParam === 'yearly' ? 'yr' : 'mo';
  
  // Calculate pricing
  const baseMonthlyPrice = cycleParam === 'yearly' ? Math.floor(planBasePrice * 0.95) : planBasePrice;
  const subtotal = baseMonthlyPrice * cycleMultiplier;
  const gstAmount = Math.round(subtotal * 0.18); // 18% GST
  const totalAmount = subtotal + gstAmount;

  const handleCardChange = (e) => {
    const { name, value } = e.target;
    setCardData(prev => ({ ...prev, [name]: value }));
  };

  const handlePay = async (e) => {
    e.preventDefault();
    setError('');
    setIsProcessing(true);

    // Validate payment inputs
    if (paymentMethod === 'card') {
      if (!cardData.number || !cardData.expiry || !cardData.cvv || !cardData.name) {
        setError('Please fill in all credit card details.');
        setIsProcessing(false);
        return;
      }
    } else if (paymentMethod === 'upi') {
      if (!upiId || !upiId.includes('@')) {
        setError('Please enter a valid UPI ID (e.g. user@okhdfcbank).');
        setIsProcessing(false);
        return;
      }
    }

    // Simulate payment processing delay
    setTimeout(async () => {
      try {
        const expiresAt = new Date();
        if (cycleParam === 'yearly') {
          expiresAt.setFullYear(expiresAt.getFullYear() + 1);
        } else {
          expiresAt.setMonth(expiresAt.getMonth() + 1);
        }

        // Call backend update subscription API
        await authService.updateSubscription({
          plan: planParam.toLowerCase(),
          status: 'active',
          expiresAt: expiresAt
        });

        // Refresh user context
        await loadUser();

        setIsProcessing(false);
        setPaymentSuccess(true);
      } catch (err) {
        console.error('Subscription update failed:', err);
        setError(err.response?.data?.message || 'Payment simulation failed. Please try again.');
        setIsProcessing(false);
      }
    }, 2500);
  };

  const hasActiveSub = user?.subscription?.status === 'active';
  const currentSubPlan = user?.subscription?.plan?.toUpperCase();
  const isSamePlan = currentSubPlan === planParam;

  if (hasActiveSub && isSamePlan && !overrideActivePlan) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-12 rounded-[2.5rem] border border-slate-100 shadow-xl space-y-8"
        >
          <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <ShieldCheck size={44} className="stroke-[2.5]" />
          </div>
          
          <div className="space-y-3">
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Active Subscription Found</h2>
            <p className="text-slate-500 text-sm font-medium leading-relaxed max-w-md mx-auto">
              You already have an active subscription to the <span className="text-indigo-600 font-bold">{planParam}</span> plan. 
              {user?.subscription?.expiresAt && ` It is valid until ${new Date(user.subscription.expiresAt).toLocaleDateString()}.`}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="px-8 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition-all shadow-md w-full sm:w-auto"
            >
              Go to Dashboard
            </button>
            <button
              onClick={() => setOverrideActivePlan(true)}
              className="px-8 py-3.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-bold text-xs transition-all w-full sm:w-auto"
            >
              Renew / Checkout Again
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (paymentSuccess) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-12 rounded-[2.5rem] border border-slate-100 shadow-xl space-y-8"
        >
          <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 size={44} className="stroke-[2.5]" />
          </div>
          
          <div className="space-y-3">
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Payment Successful!</h2>
            <p className="text-slate-500 text-sm font-medium leading-relaxed max-w-md mx-auto">
              Your account has been upgraded to the <span className="text-indigo-600 font-bold">{planParam}</span> plan. 
              Your active subscription status is now synced with your eBay accounts.
            </p>
          </div>

          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100/50 max-w-sm mx-auto text-left space-y-2.5">
            <div className="flex justify-between text-xs text-slate-400 font-bold uppercase tracking-wider">
              <span>Receipt Details</span>
              <span>Paid via {paymentMethod.toUpperCase()}</span>
            </div>
            <div className="border-t border-slate-200/50 pt-2 flex justify-between text-sm font-bold text-slate-700">
              <span>{planNames[planParam] || planParam}</span>
              <span>${subtotal}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500 font-medium">
              <span>GST (18%)</span>
              <span>${gstAmount}</span>
            </div>
            <div className="border-t border-slate-200/50 pt-2 flex justify-between text-sm font-black text-indigo-600">
              <span>Total Charged</span>
              <span>${totalAmount}</span>
            </div>
          </div>

          <button
            onClick={() => navigate('/dashboard')}
            className="px-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-indigo-100 hover:scale-[1.02]"
          >
            Go to Dashboard
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8 antialiased">
      {/* Back link */}
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm font-bold transition-colors"
      >
        <ArrowLeft size={16} /> Back to Plans
      </button>

      {hasActiveSub && !isSamePlan && (
        <div className="p-5 bg-amber-50/50 border border-amber-100 text-amber-800 text-xs font-semibold rounded-2xl flex items-center gap-3.5 max-w-4xl">
          <div className="w-10 h-10 bg-amber-500/10 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
            <AlertCircle size={20} className="stroke-[2.5]" />
          </div>
          <div>
            <p className="font-bold text-slate-800 text-sm">Notice: Different Active Subscription Detected</p>
            <p className="text-slate-500 font-medium mt-0.5">
              You are currently subscribed to the <span className="text-amber-700 font-bold uppercase">{currentSubPlan}</span> plan. 
              Completing this payment will update your subscription to the <span className="text-indigo-600 font-bold uppercase">{planParam}</span> plan.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Payment Form */}
        <div className="lg:col-span-7 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-8">
          <div className="space-y-1">
            <h2 className="text-2xl font-extrabold text-slate-900">Choose Payment Method</h2>
            <p className="text-slate-400 text-sm font-medium">Select a mock payment processor to complete checkout.</p>
          </div>

          {/* Payment Method Selector Tabs */}
          <div className="grid grid-cols-3 gap-3 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
            {[
              { id: 'card', label: 'Credit Card', icon: <CreditCard size={18} /> },
              { id: 'upi', label: 'UPI / NetBanking', icon: <Coins size={18} /> },
              { id: 'paypal', label: 'PayPal', icon: <Building2 size={18} /> }
            ].map(method => (
              <button
                key={method.id}
                type="button"
                onClick={() => setPaymentMethod(method.id)}
                className={`py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border ${
                  paymentMethod === method.id 
                    ? 'bg-white border-slate-200 text-indigo-600 shadow-sm'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {method.icon}
                {method.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold rounded-xl flex items-center gap-2"
              >
                <AlertCircle size={16} /> {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handlePay} className="space-y-6">
            {paymentMethod === 'card' && (
              <motion.div 
                key="card-form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Card Holder Name</label>
                  <input
                    type="text"
                    name="name"
                    value={cardData.name}
                    onChange={handleCardChange}
                    placeholder="John Doe"
                    className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all shadow-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Card Number</label>
                  <div className="relative">
                    <input
                      type="text"
                      name="number"
                      maxLength="19"
                      value={cardData.number}
                      onChange={handleCardChange}
                      placeholder="4111 2222 3333 4444"
                      className="w-full h-12 pl-12 pr-4 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all shadow-sm"
                    />
                    <CreditCard size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Expiry Date</label>
                    <input
                      type="text"
                      name="expiry"
                      maxLength="5"
                      value={cardData.expiry}
                      onChange={handleCardChange}
                      placeholder="MM/YY"
                      className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all shadow-sm text-center"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">CVV</label>
                    <input
                      type="password"
                      name="cvv"
                      maxLength="3"
                      value={cardData.cvv}
                      onChange={handleCardChange}
                      placeholder="***"
                      className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all shadow-sm text-center"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {paymentMethod === 'upi' && (
              <motion.div 
                key="upi-form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">UPI ID</label>
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="username@bankname"
                    className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all shadow-sm"
                  />
                  <p className="text-[10px] text-slate-400 font-medium ml-1">Enter your UPI VPA to receive a payment request on your mobile app.</p>
                </div>
              </motion.div>
            )}

            {paymentMethod === 'paypal' && (
              <motion.div 
                key="paypal-form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4 py-4 text-center bg-slate-50 rounded-2xl border border-slate-100"
              >
                <Building2 className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700">Simulate PayPal Redirect</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">Clicking Pay will simulate logging into your PayPal account to authorize the transaction.</p>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={isProcessing}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 hover:scale-[1.01] disabled:opacity-80"
            >
              {isProcessing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Processing Mock Transaction...
                </>
              ) : (
                `Pay $${totalAmount} Now`
              )}
            </button>
          </form>

          <div className="border-t border-slate-100/80 pt-4 flex items-center justify-center gap-2 text-xs text-slate-400 font-semibold">
            <ShieldCheck size={16} className="text-emerald-500" /> Secure SSL Sandbox Encrypted Connection
          </div>
        </div>

        {/* Right: Order Summary */}
        <div className="lg:col-span-5 bg-slate-50 p-8 rounded-[2rem] border border-slate-100 space-y-6">
          <h3 className="text-lg font-black text-slate-900 uppercase tracking-wider">Order Summary</h3>
          
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-wider">{planParam}</span>
                <h4 className="font-bold text-slate-800 text-sm mt-1">{planNames[planParam] || planParam}</h4>
                <p className="text-xs text-slate-400 font-medium">Billed {cycleParam}</p>
              </div>
              <span className="font-black text-slate-800">${baseMonthlyPrice}<span className="text-[10px] text-slate-400">/{cycleLabel}</span></span>
            </div>
          </div>

          <div className="space-y-3 border-t border-slate-200/60 pt-4 text-xs font-semibold text-slate-600">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>${subtotal}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>GST / Tax (18%)</span>
              <span>${gstAmount}</span>
            </div>
            
            <div className="border-t border-slate-200/60 pt-3 flex justify-between text-sm font-black text-slate-800">
              <span>Total Price</span>
              <span>${totalAmount}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;

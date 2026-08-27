import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Mail } from 'lucide-react';
import { useReducedMotion } from '../hooks/useReducedMotion';

const RefundPolicy = () => {
  const reduceMotion = useReducedMotion();

  return (
    <div className="bg-slate-50 min-h-screen pt-28 pb-20">
      {/* Background Decorative Blur */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[5%] left-[10%] w-[35%] h-[35%] bg-indigo-200/10 blur-[130px] rounded-full"></div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.5 }}
          className="text-center space-y-4 mb-10"
        >
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-[10px] font-black text-indigo-600 uppercase tracking-widest">
            <ShieldCheck size={12} /> Legal
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Refunds & Cancellations Policies</h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </motion.div>

        {/* Article Card */}
        <motion.div
          initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.5, delay: reduceMotion ? 0 : 0.1 }}
          className="bg-white border border-slate-100 rounded-[2rem] shadow-sm p-8 md:p-12"
        >
          <article className="policy-article space-y-6 text-sm text-slate-600 leading-relaxed">
            <p>
              Here are the Refunds and Cancellations Policies to use the Elister By Kreatelist Infotech Private Limited Platform:
            </p>

            {/* Satisfaction Guarantee */}
            <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-5 space-y-2">
              <h2 className="text-base font-extrabold text-indigo-900">7-Day Money-Back Guarantee</h2>
              <p className="text-indigo-900/90 text-sm leading-relaxed">
                If you are not fully satisfied with Elister for any reason, you can request a full refund of your initial subscription fee within <strong className="font-bold">7 days</strong> of purchase.
              </p>
            </div>

            {/* Subscription Plans & Billing Policy */}
            <div className="space-y-4">
              <h2 className="text-lg font-extrabold text-slate-900 tracking-tight pt-2">Subscription Plans & Billing</h2>
              <p>
                Elister operates on a monthly or yearly recurring billing cycle. The plans and pricing are structured as follows:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 not-prose">
                <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/60">
                  <h3 className="font-bold text-slate-900 text-sm">BASIC Plan</h3>
                  <p className="text-indigo-600 font-black text-xl my-1">$79<span className="text-slate-400 text-xs font-normal">/mo</span></p>
                  <ul className="text-xs text-slate-500 space-y-1 mt-2 list-disc pl-4 marker:text-indigo-300">
                    <li>500 AI Listings / month</li>
                    <li>1 eBay Account</li>
                  </ul>
                </div>
                <div className="border border-indigo-200 rounded-2xl p-4 bg-white ring-1 ring-indigo-500/10 shadow-sm">
                  <h3 className="font-bold text-slate-900 text-sm">PRO Plan</h3>
                  <p className="text-indigo-600 font-black text-xl my-1">$149<span className="text-slate-400 text-xs font-normal">/mo</span></p>
                  <ul className="text-xs text-slate-500 space-y-1 mt-2 list-disc pl-4 marker:text-indigo-300">
                    <li>3,000 AI Listings / month</li>
                    <li>5 eBay Accounts</li>
                  </ul>
                </div>
                <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/60">
                  <h3 className="font-bold text-slate-900 text-sm">ENTERPRISE Plan</h3>
                  <p className="text-indigo-600 font-black text-xl my-1">$299<span className="text-slate-400 text-xs font-normal">/mo</span></p>
                  <ul className="text-xs text-slate-500 space-y-1 mt-2 list-disc pl-4 marker:text-indigo-300">
                    <li>10,000 AI Listings / month</li>
                    <li>Unlimited eBay Accounts</li>
                  </ul>
                </div>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* Refund & Cancellation Conditions */}
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Refund & Cancellation Policy</h2>

            <div className="space-y-4">
              {/* Cancellation */}
              <div className="bg-slate-50/60 border border-slate-100 rounded-2xl p-6">
                <h3 className="text-sm font-extrabold text-slate-900 mb-2">Subscription Cancellation</h3>
                <p className="text-slate-500 text-xs leading-relaxed">
                  You can cancel your subscription at any time through your Account Billing dashboard.
                  On cancellation, your subscription will remain active, and you will retain full access to all features and listing tools, until the end of your current billing period.
                  No future recurring charges will be made.
                </p>
              </div>

              {/* Refund Policy */}
              <div className="bg-slate-50/60 border border-slate-100 rounded-2xl p-6">
                <h3 className="text-sm font-extrabold text-slate-900 mb-2">Refund Policy</h3>
                <ul className="list-disc pl-5 space-y-2 text-slate-500 text-xs marker:text-slate-300">
                  <li>
                    Refunds are only eligible within the first <strong className="font-bold text-slate-700">7 days</strong> of your very first subscription purchase.
                  </li>
                  <li>
                    Subsequent renewals or upgrades/downgrades are non-refundable.
                  </li>
                  <li>
                    Refunded amounts will be processed back to your original payment method (Stripe, Razorpay, or Cards) in <strong className="font-bold text-slate-700">5 to 7 working days</strong>.
                  </li>
                  <li className="text-rose-600 font-semibold">
                    No partial refunds or pro-rated credits are provided for unused portions of the monthly or yearly billing cycles.
                  </li>
                </ul>
              </div>
            </div>
          </article>
        </motion.div>

        {/* Contact footer note */}
        <motion.div
          initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.5, delay: reduceMotion ? 0 : 0.2 }}
          className="mt-8 text-center"
        >
          <p className="text-xs text-slate-400 font-medium">
            Questions about refunds?{' '}
            <a href="mailto:support@elister.ai" className="inline-flex items-center gap-1 text-indigo-600 font-bold hover:underline">
              <Mail size={12} /> support@elister.ai
            </a>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default RefundPolicy;

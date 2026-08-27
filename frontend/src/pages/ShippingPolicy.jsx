import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Mail } from 'lucide-react';
import { useReducedMotion } from '../hooks/useReducedMotion';

const ShippingPolicy = () => {
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
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Shipping & Delivery Policies</h1>
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
              Here are the Shipping and Delivery Policies to use the Elister By Kreatelist Infotech Private Limited Platform:
            </p>

            <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-5 space-y-2">
              <h2 className="text-base font-extrabold text-indigo-900">Instant Digital Delivery</h2>
              <p className="text-indigo-900/90 text-sm leading-relaxed">
                Elister is a SaaS (Software-as-a-Service) platform. All features, tools, and subscription plans are delivered digitally. There are no physical shipping requirements.
              </p>
            </div>

            <hr className="border-slate-100" />

            {/* Services Detailed List */}
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Service Provisioning & Access</h2>

            <div className="space-y-4">
              {/* Account Provisioning */}
              <div className="bg-slate-50/60 border border-slate-100 rounded-2xl p-6">
                <h3 className="text-sm font-extrabold text-slate-900 mb-2">Instant Account Setup</h3>
                <p className="text-slate-500 text-xs leading-relaxed">
                  Upon payment confirmation for any of our subscription plans (BASIC, PRO, or ENTERPRISE), your account features are provisioned and unlocked <strong className="font-bold text-slate-700">instantly</strong>. You will receive immediate access to connect your channels and begin listing.
                </p>
              </div>

              {/* Data Sync & API Timelines */}
              <div className="bg-slate-50/60 border border-slate-100 rounded-2xl p-6">
                <h3 className="text-sm font-extrabold text-slate-900 mb-2">AI Optimization & Publishing Timelines</h3>
                <ul className="list-disc pl-5 space-y-2 text-slate-500 text-xs marker:text-slate-300">
                  <li>
                    <strong className="font-bold text-slate-700">AI Optimizations:</strong> Generated within <strong className="font-bold text-slate-700">seconds</strong> directly in your browser.
                  </li>
                  <li>
                    <strong className="font-bold text-slate-700">Channel Sync & Imports:</strong> Triggered immediately and completed in the background within a few minutes depending on platform queue sizes.
                  </li>
                </ul>
              </div>

              {/* Support SLA by Tiers */}
              <div className="bg-slate-50/60 border border-slate-100 rounded-2xl p-6">
                <h3 className="text-sm font-extrabold text-slate-900 mb-4">Support & Service Delivery SLAs</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <span className="font-bold text-xs text-slate-800">BASIC Plan Support</span>
                    <span className="text-[11px] text-slate-500 font-semibold text-right">24 - 48 Hours Email Response</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <span className="font-bold text-xs text-slate-800">PRO Plan Support</span>
                    <span className="text-[11px] text-slate-500 font-semibold text-right">12 - 24 Hours Priority Support</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-xs text-slate-800">ENTERPRISE Plan Support</span>
                    <span className="text-[11px] text-slate-500 font-semibold text-right">24/7 Dedicated Account Manager Support</span>
                  </div>
                </div>
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
            Questions about delivery timelines?{' '}
            <a href="mailto:support@elister.ai" className="inline-flex items-center gap-1 text-indigo-600 font-bold hover:underline">
              <Mail size={12} /> support@elister.ai
            </a>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default ShippingPolicy;

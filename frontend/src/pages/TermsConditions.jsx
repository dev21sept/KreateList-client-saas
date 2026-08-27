import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Mail } from 'lucide-react';
import { useReducedMotion } from '../hooks/useReducedMotion';

const TermsConditions = () => {
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
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">User Terms & Conditions</h1>
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
              These terms and conditions are a type of contract between You (As User) and <strong className="font-bold text-slate-900">Elister By Kreatelist Infotech Private Limited</strong> (Service Provider Company) to access the Website or Web Application or Mobile Application (Android and IOS Both) of Elister By Kreatelist Infotech Private Limited.
            </p>

            <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-5">
              <p className="font-bold text-indigo-900 text-sm leading-relaxed">
                By Agree Submission in Sign Up with the terms and conditions you are agreeing that you have read, understood, and agreed to all the conditions written below:
              </p>
            </div>

            <ul className="list-disc pl-5 space-y-6 marker:text-indigo-400">
              <li>
                <span className="font-bold text-slate-900">1. Service Scope:</span> I have chosen Elister By Kreatelist Infotech Private Limited to automate and scale my eBay listing process. I understand the platform provides tools like the Smart Rule Engine, eBay Taxonomy Category Lookup, AI Listing Optimizer, and Bulk Publishing features.
              </li>

              <li>
                <span className="font-bold text-slate-900">2. Pricing & Subscription Plans:</span> I have understood the pricing model and agree to pay the subscription price prior to using the platform. Elister By Kreatelist Infotech Private Limited operates on a monthly or yearly subscription basis (with a 5% discount on annual billing):
                <ul className="list-disc pl-5 mt-3 space-y-2 text-slate-500 marker:text-slate-300">
                  <li><strong className="font-bold text-slate-700">BASIC Plan ($79/mo):</strong> Includes up to 500 AI Listings per month and support for 1 eBay Account.</li>
                  <li><strong className="font-bold text-slate-700">PRO Plan ($149/mo):</strong> Includes up to 3,000 AI Listings per month and support for 5 eBay Accounts.</li>
                  <li><strong className="font-bold text-slate-700">ENTERPRISE Plan ($299/mo):</strong> Includes up to 10,000 AI Listings per month and support for Unlimited eBay Accounts.</li>
                </ul>
              </li>

              <li>
                <span className="font-bold text-slate-900">3. Billing & Payments:</span>
                <ul className="list-disc pl-5 mt-2 space-y-2 text-slate-500 marker:text-slate-300">
                  <li>Subscriptions are billed in advance on a monthly or annual cycle depending on my selection.</li>
                  <li>I am responsible for maintaining an active payment method to avoid service interruption.</li>
                </ul>
              </li>

              <li>
                <span className="font-bold text-slate-900">4. User Information & Privacy:</span> I am sharing my contact info with Elister By Kreatelist Infotech Private Limited as accurately as my government documents and Elister By Kreatelist Infotech Private Limited can use the info to contact me regarding my account or subscription.
              </li>

              <li>
                <span className="font-bold text-slate-900">5. Account Restriction:</span> I am creating an account with Elister By Kreatelist Infotech Private Limited and the company reserves the right to restrict or terminate my account at any point in time in case of negligence, unauthorized use of eBay integrations, or violation of any term or condition.
              </li>

              <li>
                <span className="font-bold text-slate-900">6. Intellectual Property:</span> I will not use, copy, reverse engineer, or replicate the same business idea, features (like Rule Engine, AI Optimizer, Taxonomy API), or software logic of Elister By Kreatelist Infotech Private Limited at any point.
              </li>
            </ul>

            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5">
              <p className="text-rose-700 font-bold text-sm leading-relaxed">
                **If I commit any negligence of Company Norms or Intellectual Property theft, the Company (Elister By Kreatelist Infotech Private Limited) can take legal action against me.
              </p>
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
            Questions about these terms?{' '}
            <a href="mailto:support@elister.ai" className="inline-flex items-center gap-1 text-indigo-600 font-bold hover:underline">
              <Mail size={12} /> support@elister.ai
            </a>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default TermsConditions;

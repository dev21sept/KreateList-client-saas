import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Mail } from 'lucide-react';
import { useReducedMotion } from '../hooks/useReducedMotion';

const PrivacyPolicy = () => {
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
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">User Data Security & Policy</h1>
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
              As Elister By Kreatelist Infotech Private Limited (the "Company"), we promise the following data privacy and security terms:
            </p>

            <ul className="list-disc pl-5 space-y-3 marker:text-indigo-400">
              <li>We will not use your account information for anyone else.</li>
              <li>We will not pass or share your personal information and data with anyone else.</li>
              <li>We will not use your account for any transaction on our end. All the transactions will be authorized by the user itself.</li>
              <li>On account cancellation, we will block all transactions on your account.</li>
              <li>We will not do any unauthorized transactions with your payment methods.</li>
              <li>We will do transactions with the authorized methods (Razorpay, Paypal, or Cards).</li>
              <li>We will not deduct any of the amounts after the cancellation of the Subscription.</li>
              <li>User can delete their account and we will delete all the user info on our end.</li>
              <li>On the negligence of Terms & Conditions company can delete the user account and Data.</li>
              <li>If your account does not have any activity in 3 months, your account will be deactivated from our system and you can reactivate it. For reactivation you have to send an email to "admin@elister.ai".</li>
            </ul>

            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight pt-4">Approval To Use Software & Security Policy</h2>
            <p>
              The Company allows the nonexclusive use of the software in relation to the Service (hereinafter referred to as the &ldquo;Software&rdquo; and includes software that is newly provided due to future upgrades) provided by the Company for users who download the Software for the use of the Service under the condition that the user abides by the Terms and Conditions. The copyright to the Software and any associated rights will belong to the Company.
            </p>
            <p>
              The Company cannot guarantee that the Software is free of any actual or legal defects (including but not limited to stability, reliability, accuracy, completeness, validity, suitability for a specific purpose, security-related defects, errors, or bugs, infringement of rights, etc.).
            </p>

            <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-5">
              <p className="font-bold text-indigo-900 text-sm leading-relaxed">
                The user must not conduct the following actions when using the Software unless the user has separately obtained evident approval from the Company:
              </p>
            </div>

            <ul className="list-disc pl-5 space-y-3 marker:text-indigo-400">
              <li>Copy the whole or part of the Software.</li>
              <li>Modify the whole or part of the Software&rsquo;s features, text, and/or program source code.</li>
              <li>Disassemble or decompile the whole or part of the Software, or attempt to decipher the whole or part of the Software.</li>
              <li>Assign, lend or licence the Software to a third party.</li>
              <li>Use the Software for advertising, commercial purposes, or solicitation.</li>
              <li>Violate a law, judgement, judicial ruling, court order, or binding regulation.</li>
              <li>Violate the rights of the Company or of any third party (including, copyright, trademark, patent, or similar intellectual property rights, right of reputation, right to privacy, or any other right arising at law or by contract).</li>
              <li>Interfere with or obstruct the Company&rsquo;s operation of the Service or other users&rsquo; use of the Service.</li>
              <li>Aid or encourage any of the actions mentioned above.</li>
              <li>Any other use of the Service that the Company deems inappropriate.</li>
            </ul>
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
            Questions about this policy?{' '}
            <a href="mailto:support@elister.ai" className="inline-flex items-center gap-1 text-indigo-600 font-bold hover:underline">
              <Mail size={12} /> support@elister.ai
            </a>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;

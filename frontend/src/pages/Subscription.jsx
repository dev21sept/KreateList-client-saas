import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Zap, Rocket, Building2, HelpCircle } from 'lucide-react';

const Subscription = () => {
  const [billingCycle, setBillingCycle] = useState('monthly');

  const plans = [
    {
      name: 'Basic',
      price: billingCycle === 'monthly' ? 29 : 24,
      icon: <Zap className="text-indigo-600" />,
      features: [
        '500 Listings per month',
        '1 eBay Account',
        'Standard Rule Engine',
        'Email Support',
        'Basic Analytics'
      ],
      current: false
    },
    {
      name: 'Pro',
      price: billingCycle === 'monthly' ? 79 : 69,
      icon: <Rocket className="text-indigo-600" />,
      features: [
        '5,000 Listings per month',
        '5 eBay Accounts',
        'Advanced Rule Engine',
        'Priority Support',
        'AI Descriptions (100/mo)',
        'Inventory Sync'
      ],
      current: true,
      popular: true
    },
    {
      name: 'Enterprise',
      price: 199,
      icon: <Building2 className="text-indigo-600" />,
      features: [
        'Unlimited Listings',
        'Unlimited eBay Accounts',
        'Full API Access',
        'Dedicated Account Manager',
        'Bulk Import/Export',
        'Custom Team Roles'
      ],
      current: false
    }
  ];

  return (
    <div className="space-y-12 max-w-6xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Simple, Transparent Pricing</h1>
        <p className="text-xl text-slate-500 max-w-2xl mx-auto">Choose the plan that fits your business scale. No hidden fees.</p>
        
        {/* Toggle */}
        <div className="flex items-center justify-center pt-4">
          <div className="bg-slate-100 p-1 rounded-2xl flex items-center">
            <button 
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${billingCycle === 'monthly' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Monthly
            </button>
            <button 
              onClick={() => setBillingCycle('yearly')}
              className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${billingCycle === 'yearly' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Yearly <span className="text-[10px] text-emerald-600 ml-1">Save 15%</span>
            </button>
          </div>
        </div>
      </div>

      {/* Pricing Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {plans.map((plan, index) => (
          <motion.div
            key={plan.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`relative p-8 rounded-3xl border transition-all ${
              plan.popular 
                ? 'bg-white border-indigo-200 shadow-2xl shadow-indigo-100 scale-105 z-10' 
                : 'bg-white/60 border-slate-100 shadow-sm'
            }`}
          >
            {plan.popular && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-indigo-600 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                Most Popular
              </span>
            )}

            <div className="flex justify-between items-start mb-6">
              <div className="p-3 bg-slate-50 rounded-2xl">
                {plan.icon}
              </div>
              {plan.current && (
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">Current Plan</span>
              )}
            </div>

            <h3 className="text-2xl font-bold text-slate-900 mb-2">{plan.name}</h3>
            <div className="mb-8">
              <span className="text-4xl font-black text-slate-900">${plan.price}</span>
              <span className="text-slate-400 font-medium">/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
            </div>

            <ul className="space-y-4 mb-10">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center text-sm text-slate-600">
                  <Check className="w-5 h-5 text-emerald-500 mr-3 shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>

            <button className={`w-full py-4 rounded-2xl font-bold transition-all ${
              plan.current 
                ? 'bg-slate-100 text-slate-400 cursor-default' 
                : plan.popular 
                  ? 'btn-primary' 
                  : 'bg-white border-2 border-slate-100 text-slate-900 hover:bg-slate-50'
            }`}>
              {plan.current ? 'Your Active Plan' : `Upgrade to ${plan.name}`}
            </button>
          </motion.div>
        ))}
      </div>

      {/* FAQ / Info */}
      <div className="bg-indigo-50 p-10 rounded-[40px] flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="space-y-4">
          <div className="flex items-center space-x-2 text-indigo-600">
            <HelpCircle size={24} />
            <span className="font-bold uppercase tracking-wider text-sm">Need help?</span>
          </div>
          <h3 className="text-2xl font-bold text-slate-900">Custom enterprise solutions</h3>
          <p className="text-slate-600 max-w-md leading-relaxed">
            Managing more than 50,000 listings or have complex multi-channel needs? Our team can build a custom plan for your scale.
          </p>
        </div>
        <button className="px-8 py-4 bg-white text-indigo-600 font-bold rounded-2xl shadow-xl shadow-indigo-100 hover:scale-105 transition-all">
          Contact Sales Team
        </button>
      </div>
    </div>
  );
};

export default Subscription;

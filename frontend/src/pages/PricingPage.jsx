import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Zap, 
  Rocket, 
  Users, 
  Check, 
  ArrowRight,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PricingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [billingCycle, setBillingCycle] = useState('monthly');
  const [selectedProfile, setSelectedProfile] = useState(null);

  const plans = [
    {
      name: 'BASIC',
      monthlyPrice: 79,
      icon: <Zap className="w-5 h-5 text-blue-500" />,
      perfectFor: ['New resellers', 'Small eBay sellers', 'Side hustlers'],
      features: [
        '500 AI Listings / month',
        '1 eBay Account',
        'AI Titles & Descriptions',
        'Smart Listing Templates',
        'Basic Analytics',
        'Image Upload Support',
        'Email Support'
      ]
    },
    {
      name: 'PRO',
      monthlyPrice: 149,
      popular: true,
      icon: <Rocket className="w-5 h-5 text-indigo-600" />,
      perfectFor: ['Growing resellers', 'Full-time sellers', 'Multi-account stores'],
      features: [
        '3,000 AI Listings / month',
        '5 eBay Accounts',
        'AI SEO Optimization',
        'Bulk Listing Tools',
        'Inventory Sync',
        'Team Collaboration',
        'AI Pricing Suggestions',
        'Priority Support'
      ]
    },
    {
      name: 'ENTERPRISE',
      monthlyPrice: 299,
      icon: <Users className="w-5 h-5 text-purple-600" />,
      perfectFor: ['Large reseller teams', 'Agencies & enterprises', 'High-volume sellers'],
      features: [
        '10,000 AI Listings / month',
        'Unlimited eBay Accounts',
        'API Access',
        'Advanced Automation',
        'Team Roles & Permissions',
        'Dedicated Account Manager',
        'White Label Support',
        '24/7 Premium Support'
      ]
    }
  ];

  const getPrice = (price) => {
    return billingCycle === 'yearly' ? Math.floor(price * 0.95) : price;
  };

  const handlePlanSelect = (planName) => {
    const destination = user ? '/checkout' : '/signup';
    navigate(`${destination}?plan=${planName}&cycle=${billingCycle}`);
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 space-y-16 antialiased pt-24">
      {/* Header */}
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <span className="px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-[10px] font-black text-indigo-600 uppercase tracking-widest">
          Pricing Plans
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-sans">Simple, Powerful Pricing</h1>
        <p className="text-slate-500 text-sm font-medium leading-relaxed">
          Choose the plan matching your eBay listing volume. Save 5% automatically on annual cycles.
        </p>

        {/* Toggle */}
        <div className="flex items-center justify-center pt-4">
          <div className="relative bg-slate-100 p-1 rounded-2xl flex items-center border border-slate-200 w-fit">
            <button 
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`relative z-10 px-6 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${billingCycle === 'monthly' ? 'text-slate-900' : 'text-slate-500'}`}
            >
              Monthly
            </button>
            <button 
              type="button"
              onClick={() => setBillingCycle('yearly')}
              className={`relative z-10 px-6 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${billingCycle === 'yearly' ? 'text-slate-900' : 'text-slate-500'}`}
            >
              Yearly <span className="text-[9px] text-emerald-600 ml-1 font-black">SAVE 5%</span>
            </button>
            <div 
              className={`absolute top-1 bottom-1 left-1 bg-white rounded-xl shadow-sm transition-all duration-300 border border-slate-200/50 ${billingCycle === 'monthly' ? 'w-[calc(50%-4px)]' : 'w-[calc(50%-4px)] translate-x-full'}`}
            />
          </div>
        </div>

        {/* Profile Selector */}
        <div className="bg-slate-50 border border-slate-100 p-5 rounded-[2rem] max-w-xl mx-auto space-y-3 shadow-sm pt-4">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Select your profile to find your plan</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {[
              { label: 'New Seller / Side Hustler', plan: 'BASIC' },
              { label: 'Full-time / Active Seller', plan: 'PRO' },
              { label: 'Large Team / High Volume', plan: 'ENTERPRISE' }
            ].map(profile => (
              <button
                key={profile.plan}
                type="button"
                onClick={() => setSelectedProfile(profile.plan)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                  selectedProfile === profile.plan
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
                }`}
              >
                {profile.label}
              </button>
            ))}
            {selectedProfile && (
              <button
                type="button"
                onClick={() => setSelectedProfile(null)}
                className="text-xs font-bold text-rose-500 hover:text-rose-600 underline ml-1"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch pt-6">
        {plans.map((plan, idx) => {
          const isHighlighted = selectedProfile ? selectedProfile === plan.name : plan.popular;
          return (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`flex flex-col p-8 rounded-[2rem] border bg-white transition-all duration-500 relative group cursor-pointer ${
                isHighlighted 
                  ? 'border-indigo-500 shadow-[0_20px_50px_rgba(99,102,241,0.12)] ring-2 ring-indigo-500/20 scale-[1.02]' 
                  : 'border-slate-100 shadow-sm hover:shadow-md'
              }`}
              onClick={() => setSelectedProfile(plan.name)}
            >
              {isHighlighted && (
                <div className="absolute top-0 right-8 -translate-y-1/2 bg-indigo-600 text-white px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100">
                  {selectedProfile ? "Match For You" : "Recommended"}
                </div>
              )}

              <div className="flex justify-between items-start mb-6">
                <div className={`p-3 rounded-xl ${isHighlighted ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-600'}`}>
                  {plan.icon}
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-lg font-bold text-slate-900 mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-slate-900">${getPrice(plan.monthlyPrice)}</span>
                  <span className="text-slate-400 text-xs font-semibold">/mo</span>
                </div>
              </div>

              <div className="mb-8 space-y-2">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Ideal For</p>
                <div className="flex flex-wrap gap-1">
                  {plan.perfectFor.map(p => (
                    <span 
                      key={p} 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProfile(plan.name);
                      }}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all border ${
                        isHighlighted 
                          ? 'bg-indigo-50 border-indigo-100 text-indigo-700'
                          : 'bg-slate-50 border-slate-100 text-slate-600'
                      }`}
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex-grow space-y-4 mb-8">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Key Features</p>
                <ul className="space-y-3">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-xs text-slate-600 font-medium leading-tight">
                      <div className="mt-0.5 p-0.5 rounded-full bg-emerald-50 text-emerald-600 shrink-0">
                        <Check className="w-2.5 h-2.5 stroke-[4]" />
                      </div>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlanSelect(plan.name);
                }}
                className={`w-full py-3.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 hover:scale-[1.01] ${
                  isHighlighted 
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100' 
                    : 'bg-slate-950 text-white hover:bg-slate-900'
                }`}
              >
                Get Started <ArrowRight size={14} />
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default PricingPage;

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, Zap, Rocket, Building2, Package, Plus, Users, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/api';

const Subscription = () => {
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await authService.getMe();
        if (res.data.success) {
          setUser(res.data.data);
        }
      } catch (err) {
        console.error("Error fetching user subscription details:", err);
      }
    };
    fetchUser();
  }, []);

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
      icon: <Building2 className="w-5 h-5 text-purple-600" />,
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

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-16 antialiased">
      {/* Header Section */}
      <div className="text-center space-y-6">
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-bold uppercase tracking-wider"
        >
          <Sparkles className="w-3 h-3" />
          Pricing Plans
        </motion.div>
        
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">Simple, Powerful Pricing</h1>
          <p className="text-slate-500 max-w-xl mx-auto text-sm font-medium leading-relaxed">
            Choose the perfect plan for your business. Whether you're just starting or scaling to thousands of listings.
          </p>
        </div>

        {/* Improved Toggle */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-2">
          <div className="relative bg-slate-100 p-1 rounded-2xl flex items-center border border-slate-200 w-fit">
            <button 
              onClick={() => setBillingCycle('monthly')}
              className={`relative z-10 px-8 py-2 rounded-xl text-sm font-bold transition-all duration-300 ${billingCycle === 'monthly' ? 'text-slate-900' : 'text-slate-500'}`}
            >
              Monthly
            </button>
            <button 
              onClick={() => setBillingCycle('yearly')}
              className={`relative z-10 px-8 py-2 rounded-xl text-sm font-bold transition-all duration-300 ${billingCycle === 'yearly' ? 'text-slate-900' : 'text-slate-500'}`}
            >
              Yearly <span className="text-[10px] text-emerald-600 ml-1 font-black">SAVE 5%</span>
            </button>
            <div 
              className={`absolute top-1 bottom-1 left-1 bg-white rounded-xl shadow-sm transition-all duration-300 border border-slate-200/50 ${billingCycle === 'monthly' ? 'w-[calc(50%-4px)]' : 'w-[calc(50%-4px)] translate-x-full'}`}
            />
          </div>
        </div>

        {/* Profile / Ideal For Selector */}
        <div className="bg-slate-50 border border-slate-100 p-6 rounded-[2rem] max-w-3xl mx-auto space-y-4 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select your profile to find your ideal plan</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {[
              { label: 'New Reseller / Side Hustler', plan: 'BASIC' },
              { label: 'Full-time / Growing Reseller', plan: 'PRO' },
              { label: 'Agency / Large Team', plan: 'ENTERPRISE' }
            ].map(profile => (
              <button
                key={profile.plan}
                type="button"
                onClick={() => setSelectedProfile(profile.plan)}
                className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all border ${
                  selectedProfile === profile.plan
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100 scale-[1.03]'
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
                className="text-xs font-bold text-rose-500 hover:text-rose-600 underline ml-2 transition-colors"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
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
                  : 'border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200'
              }`}
              onClick={() => setSelectedProfile(plan.name)}
            >
              {isHighlighted && (
                <div className="absolute top-0 right-8 -translate-y-1/2 bg-indigo-600 text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 animate-pulse">
                  {selectedProfile ? "Your Match" : "Recommended"}
                </div>
              )}

              <div className="flex justify-between items-start mb-6">
                <div className={`p-3 rounded-xl ${isHighlighted ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-600'}`}>
                  {plan.icon}
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-xl font-bold text-slate-900 mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-slate-900">${getPrice(plan.monthlyPrice)}</span>
                  <span className="text-slate-400 text-sm font-semibold">/mo</span>
                </div>
              </div>

              <div className="mb-8 space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ideal For</p>
                <div className="flex flex-wrap gap-1.5">
                  {plan.perfectFor.map(p => (
                    <span 
                      key={p} 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProfile(plan.name);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border ${
                        isHighlighted 
                          ? 'bg-indigo-50/80 border-indigo-100 text-indigo-700 hover:bg-indigo-100'
                          : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                      }`}
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex-grow space-y-4 mb-10">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Key Features</p>
                <ul className="space-y-3">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-3 text-sm text-slate-600 font-medium leading-tight">
                      <div className="mt-0.5 p-0.5 rounded-full bg-emerald-50 text-emerald-600 shrink-0">
                        <Check className="w-3 h-3 stroke-[4]" />
                      </div>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              {(() => {
                const isActive = user?.subscription?.plan?.toLowerCase() === plan.name.toLowerCase() && user?.subscription?.status === 'active';
                return (
                  <button 
                    type="button"
                    disabled={isActive}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isActive) {
                        navigate(`/checkout?plan=${plan.name}&cycle=${billingCycle}`);
                      }
                    }}
                    className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all ${
                      isActive
                        ? 'bg-emerald-100 text-emerald-700 cursor-not-allowed border border-emerald-200'
                        : isHighlighted 
                          ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-200 hover:scale-[1.01]' 
                          : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    {isActive ? 'Active Plan' : isHighlighted ? 'Get Started Now' : `Select ${plan.name}`}
                  </button>
                );
              })()}
            </motion.div>
          );
        })}
      </div>

      {/* Add-ons & Benefits */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-8 border-t border-slate-100">
        {/* Add-ons List */}
        <div className="space-y-6">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Plus className="w-5 h-5 text-indigo-500" />
            Add-on Options
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <AddOnCard name="Extra Listings" price="$39" icon={<Package className="w-4 h-4" />} />
            <AddOnCard name="Extra Account" price="$19" icon={<Plus className="w-4 h-4" />} />
            <AddOnCard name="Team Pack" price="$49" icon={<Users className="w-4 h-4" />} />
          </div>
        </div>

        {/* Benefits List */}
        <div className="space-y-6">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500" />
            Why Choose Elister.ai?
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <BenefitItem text="AI listings in seconds" />
            <p className="text-xs text-slate-500 font-medium border-l-2 border-slate-100 pl-4 py-1">Save hours of manual work every day</p>
            <BenefitItem text="Scale business faster" />
            <p className="text-xs text-slate-500 font-medium border-l-2 border-slate-100 pl-4 py-1">Built specifically for resellers</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const AddOnCard = ({ name, price, icon }) => (
  <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow text-center">
    <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center mx-auto mb-3 text-slate-400 group-hover:text-indigo-500">
      {icon}
    </div>
    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">{name}</p>
    <p className="text-lg font-black text-slate-900">{price}<span className="text-[10px] text-slate-400">/mo</span></p>
  </div>
);

const BenefitItem = ({ text }) => (
  <div className="flex items-center gap-3 p-3 rounded-xl bg-indigo-50/50 border border-indigo-100/50">
    <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
    <span className="text-xs font-bold text-slate-700">{text}</span>
  </div>
);

export default Subscription;





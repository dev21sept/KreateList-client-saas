import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronRight,
  Zap,
  Shield,
  BarChart3,
  Rocket,
  Check,
  ArrowRight,
  Sparkles,
  Users
} from 'lucide-react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useReducedMotion } from '../hooks/useReducedMotion';
import CountUp from '../components/CountUp';

const Home = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    if (code || error) {
      console.log('Detected eBay callback params on Home page, forwarding to /ebay-callback...');
      navigate(`/ebay-callback${window.location.search}`, { replace: true });
    }
  }, [searchParams, navigate]);

  const fadeUp = (delay = 0) => ({
    initial: reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-80px' },
    transition: { duration: reduceMotion ? 0 : 0.5, delay: reduceMotion ? 0 : delay },
  });

  return (
    <div className="pt-20 space-y-24">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 lg:py-28">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-200/20 blur-[120px] rounded-full"></div>
          <div className="absolute bottom-[10%] right-[-10%] w-[30%] h-[30%] bg-violet-200/20 blur-[120px] rounded-full"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          <motion.div
            initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.5 }}
            className="space-y-6"
          >
            <span className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-bold bg-indigo-50 border border-indigo-100 text-indigo-700 tracking-wide uppercase">
              <Zap className="w-3.5 h-3.5 mr-1.5 text-indigo-500 fill-indigo-500 animate-pulse" />
              AI-Powered eBay Automation
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-none max-w-4xl mx-auto font-sans">
              List Faster. Sell Smarter.<br className="hidden sm:inline" />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600">
                Automate Your eBay Store.
              </span>
            </h1>
            <p className="text-base sm:text-lg text-slate-500 max-w-xl mx-auto leading-relaxed font-medium">
              Elister.ai streamlines listing creation with smart aspect mapping, rules, and AI descriptions.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link to="/signup" className="w-full sm:w-auto px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/35 hover:-translate-y-0.5 active:scale-[0.98] flex items-center justify-center gap-1.5">
                Start Free Trial <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/features" className="px-8 py-4 text-slate-600 hover:text-indigo-600 text-sm font-bold transition-all flex items-center gap-1.5 hover:translate-x-0.5">
                Explore Features <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>

          {/* Preview Image */}
          <motion.div
            initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.6, delay: reduceMotion ? 0 : 0.2 }}
            className="mt-12 max-w-5xl mx-auto relative group"
          >
            <div className="absolute inset-0 bg-indigo-600/5 rounded-3xl blur-2xl -z-10 group-hover:bg-indigo-600/10 transition-colors duration-500"></div>
            <div className="bg-white p-2 border border-slate-100 rounded-[2.5rem] shadow-xl">
              <img
                src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=2426"
                alt="Elister.ai Dashboard Overview"
                className="rounded-[2rem] border border-slate-100/50 shadow-sm w-full"
              />
            </div>

            {/* Animated Float Tag */}
            <div className={`absolute -top-4 -right-4 hidden sm:block ${reduceMotion ? '' : 'animate-bounce duration-4000'}`}>
              <div className="bg-white/90 backdrop-blur-md px-4 py-3 rounded-2xl border border-slate-100 shadow-lg flex items-center gap-3">
                <div className="w-8 h-8 bg-emerald-500 text-white rounded-xl flex items-center justify-center">
                  <Check className="w-4 h-4 stroke-[3]" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-black text-slate-900">eBay Listing Live</p>
                  <p className="text-[10px] text-slate-400 font-semibold">Synced in 1.4s</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Banner */}
      <motion.section {...fadeUp()} className="bg-slate-900 py-12">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <StatItem value={50} suffix="k+" label="Listings Created" reduceMotion={reduceMotion} />
          <StatItem value={10} suffix="k+" label="Active Accounts" reduceMotion={reduceMotion} />
          <StatItem value={99.9} suffix="%" label="API Reliability" decimals={1} reduceMotion={reduceMotion} />
          <StatItem value={10} suffix="x" label="Faster Processing" reduceMotion={reduceMotion} />
        </div>
      </motion.section>

      {/* Features Overview */}
      <section className="max-w-7xl mx-auto px-6 py-8 space-y-12">
        <motion.div {...fadeUp()} className="text-center space-y-3">
          <span className="px-3 py-1 rounded-full bg-slate-50 border border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Overview
          </span>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Standardize and Accelerate Your Listings</h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <motion.div {...fadeUp(0.05)}>
            <OverviewCard
              icon={<Zap className="w-6 h-6 text-indigo-600" />}
              title="Smart Rule Engine"
              description="Create reusable title formats, condition templates, and logistics rules instantly."
            />
          </motion.div>
          <motion.div {...fadeUp(0.15)}>
            <OverviewCard
              icon={<Shield className="w-6 h-6 text-indigo-600" />}
              title="eBay Verification"
              description="Official OAuth integration ensures secure token management directly from eBay servers."
            />
          </motion.div>
          <motion.div {...fadeUp(0.25)}>
            <OverviewCard
              icon={<BarChart3 className="w-6 h-6 text-indigo-600" />}
              title="Analytics & Logs"
              description="Track draft listings, scheduled events, publish counts, and active server messages."
            />
          </motion.div>
        </div>

        <motion.div {...fadeUp()} className="text-center pt-4">
          <Link
            to="/features"
            className="inline-flex items-center gap-2 px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:-translate-y-0.5"
          >
            Explore Detailed Features <ArrowRight size={14} />
          </Link>
        </motion.div>
      </section>

      {/* Pricing Teaser */}
      <motion.section {...fadeUp()} className="bg-slate-50 py-16">
        <div className="max-w-5xl mx-auto px-6 text-center space-y-8">
          <div className="space-y-3">
            <span className="px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-[10px] font-black text-indigo-600 uppercase tracking-widest">
              Simple Rates
            </span>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Pricing Suited for Your Selling Goals</h2>
            <p className="text-slate-500 max-w-md mx-auto text-xs font-medium leading-relaxed">
              Unlock unlimited possibilities with our transparent, feature-packed subscriptions. No hidden setup fees.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-4 pt-2">
            <Link
              to="/pricing"
              className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-indigo-500/25 hover:-translate-y-0.5"
            >
              View Pricing Tiers
            </Link>
            <Link
              to="/signup"
              className="px-8 py-4 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-2xl text-sm font-bold transition-all shadow-sm hover:-translate-y-0.5"
            >
              Start 14-Day Trial
            </Link>
          </div>
        </div>
      </motion.section>
    </div>
  );
};

const OverviewCard = ({ icon, title, description }) => (
  <div className="h-full p-8 bg-white border border-slate-100 rounded-3xl shadow-sm space-y-4 transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-indigo-100">
    <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center">
      {icon}
    </div>
    <h3 className="text-base font-bold text-slate-900">{title}</h3>
    <p className="text-slate-500 text-xs font-medium leading-relaxed">{description}</p>
  </div>
);

const StatItem = ({ value, suffix, label, decimals = 0, reduceMotion }) => (
  <div>
    <p className="text-3xl font-black text-white tabular-nums">
      <CountUp value={value} suffix={suffix} decimals={decimals} disabled={reduceMotion} />
    </p>
    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">{label}</p>
  </div>
);

export default Home;

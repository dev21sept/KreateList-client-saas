import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Zap, Shield, BarChart3, Rocket } from 'lucide-react';
import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <div className="pt-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 lg:py-32">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-200/30 blur-[120px] rounded-full"></div>
          <div className="absolute bottom-[10%] right-[-10%] w-[30%] h-[30%] bg-violet-200/30 blur-[120px] rounded-full"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-50 text-indigo-700 border border-indigo-100 mb-6">
              <Zap className="w-4 h-4 mr-1 fill-indigo-500" /> AI-Powered eBay Automation
            </span>
            <h1 className="text-5xl lg:text-7xl font-extrabold text-slate-900 tracking-tight mb-6">
              List Faster. Sell Smarter.<br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
                Automate Your eBay Business.
              </span>
            </h1>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
              KreateList helps thousands of sellers automate their eBay listings with custom rules, AI descriptions, and bulk publishing. Save 80% of your time.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
              <Link to="/signup" className="btn-primary px-8 py-4 text-lg">
                Start Free Trial
              </Link>
              <a href="#features" className="px-8 py-4 text-lg font-medium text-slate-600 hover:text-indigo-600 transition-colors flex items-center">
                See How It Works <ChevronRight className="ml-1 w-5 h-5" />
              </a>
            </div>
          </motion.div>

          {/* Dashboard Preview Mockup */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-16 relative"
          >
            <div className="glass-card p-2 bg-slate-100/50">
              <img
                src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=2426"
                alt="Dashboard Preview"
                className="rounded-xl shadow-2xl border border-slate-200"
              />
            </div>
            {/* Floating elements for extra premium look */}
            <div className="absolute -top-6 -right-6 hidden lg:block">
              <div className="glass-card p-4 shadow-xl">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                    <Rocket className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Listing Published!</p>
                    <p className="text-xs text-slate-500">2 seconds ago</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-indigo-600">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap justify-center gap-12 lg:gap-24 text-white">
          <div className="text-center">
            <p className="text-4xl font-bold">50k+</p>
            <p className="text-indigo-100">Listings Daily</p>
          </div>
          <div className="text-center">
            <p className="text-4xl font-bold">10k+</p>
            <p className="text-indigo-100">Active Sellers</p>
          </div>
          <div className="text-center">
            <p className="text-4xl font-bold">99.9%</p>
            <p className="text-indigo-100">Uptime</p>
          </div>
          <div className="text-center">
            <p className="text-4xl font-bold">4.9/5</p>
            <p className="text-indigo-100">User Rating</p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-indigo-600 font-semibold tracking-wide uppercase">Features</h2>
            <p className="mt-2 text-3xl font-extrabold text-slate-900 sm:text-4xl">
              Everything you need to scale your eBay store
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Zap className="w-8 h-8 text-indigo-600" />}
              title="Rule Engine"
              description="Create dynamic listing templates that automatically format your titles and descriptions."
            />
            <FeatureCard
              icon={<Shield className="w-8 h-8 text-indigo-600" />}
              title="eBay Verified"
              description="Direct integration with eBay Sell API using secure OAuth 2.0 authentication."
            />
            <FeatureCard
              icon={<BarChart3 className="w-8 h-8 text-indigo-600" />}
              title="Advanced Analytics"
              description="Monitor your sales performance and listing success rates in real-time."
            />
          </div>
        </div>
      </section>
    </div>
  );
};

const FeatureCard = ({ icon, title, description }) => (
  <motion.div
    whileHover={{ y: -5 }}
    className="p-8 bg-slate-50 rounded-2xl border border-slate-100 hover:shadow-xl transition-all"
  >
    <div className="w-16 h-16 bg-white rounded-xl shadow-sm flex items-center justify-center mb-6">
      {icon}
    </div>
    <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
    <p className="text-slate-600 leading-relaxed">
      {description}
    </p>
  </motion.div>
);

export default Home;

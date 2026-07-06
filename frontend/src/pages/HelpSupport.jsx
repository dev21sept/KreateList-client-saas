import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  ChevronDown, 
  Mail, 
  MessageSquare, 
  BookOpen, 
  HelpCircle, 
  Send, 
  CheckCircle, 
  ArrowRight,
  Sparkles,
  Zap,
  Shield,
  CreditCard
} from 'lucide-react';

const FAQS = [
  {
    id: 1,
    category: 'listing',
    question: 'How do I publish a listing to eBay or Poshmark?',
    answer: 'Simply click the "New Listing" button in the dashboard, select your target platform, fill out the listing details (titles, descriptions, categories, and specifics), and click "Publish". The system will process it and verify live URLs in real-time.'
  },
  {
    id: 2,
    category: 'listing',
    question: 'What does the "No Listed On" filter do?',
    answer: 'The "No Listed On" filter allows you to identify products that are not published on a particular platform. Drafts, errors, and unlisted items on that platform are shown, while active listings on that platform are hidden. This is helpful for finding items to cross-list.'
  },
  {
    id: 3,
    category: 'integrations',
    question: 'How do I connect my eBay and Poshmark accounts?',
    answer: 'Navigate to the "Integrations" page from the sidebar menu. Click "Connect Account" for the platform you want to add, and authorize Elister.ai to securely synchronize your inventory and listings.'
  },
  {
    id: 4,
    category: 'billing',
    question: 'Can I change or cancel my plan at any time?',
    answer: 'Yes, you can upgrade, downgrade, or cancel your subscription plan at any time by going to the "Subscription" tab in the sidebar and clicking "Manage Plan". Your new quotas will be applied instantly.'
  },
  {
    id: 5,
    category: 'general',
    question: 'What is the Rule Engine and how do I use templates?',
    answer: 'The Rule Engine (accessible via the "Rules" tab) lets you build templates for your titles, description patterns, package specs, and policy settings. When creating listings, these templates automatically pre-fill aspects so you avoid manual data entry.'
  },
  {
    id: 6,
    category: 'general',
    question: 'Does Elister.ai support automatic inventory synchronization?',
    answer: 'Yes! When an item sells on one connected platform, Elister.ai automatically detects the sale and updates the quantity or delists the item on your other active platforms to prevent double-selling.'
  }
];

const HelpSupport = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isDashboard = location.pathname === '/help';

  // State Management
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [openFaqId, setOpenFaqId] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    category: 'technical',
    subject: '',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const toggleFaq = (id) => {
    setOpenFaqId(openFaqId === id ? null : id);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.subject || !formData.message) return;

    setSubmitting(true);
    // Simulate API Submission
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
      setFormData({
        name: '',
        email: '',
        category: 'technical',
        subject: '',
        message: ''
      });
    }, 1200);
  };

  // Filter FAQs
  const filteredFaqs = FAQS.filter(faq => {
    const matchesSearch = faq.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'all' || faq.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = [
    { id: 'all', name: 'All Topics', icon: <HelpCircle size={16} /> },
    { id: 'listing', name: 'Listing & Sync', icon: <Zap size={16} /> },
    { id: 'integrations', name: 'Integrations', icon: <Shield size={16} /> },
    { id: 'billing', name: 'Billing & Plans', icon: <CreditCard size={16} /> },
    { id: 'general', name: 'General Reselling', icon: <Sparkles size={16} /> }
  ];

  return (
    <div className={`antialiased ${!isDashboard ? 'max-w-6xl mx-auto px-6 py-12 space-y-16 pt-28' : 'space-y-8'}`}>
      
      {/* HEADER SECTION */}
      {!isDashboard ? (
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <span className="px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-[10px] font-black text-indigo-600 uppercase tracking-widest">
            Help Center
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">How can we help you?</h1>
          <p className="text-slate-500 text-sm font-medium leading-relaxed">
            Find answers to frequently asked questions, configure integration credentials, or open a support ticket directly with our engineering team.
          </p>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-3xl border border-[#f1f3f9] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-950">Help & Support</h2>
            <p className="text-slate-400 text-xs font-semibold mt-0.5">Explore guides, read FAQs, or reach out to our team.</p>
          </div>
          <div className="flex gap-3">
            <a 
              href="mailto:support@elister.ai" 
              className="flex items-center gap-2 px-4 py-2.5 bg-[#f4f5ff] hover:bg-indigo-100/50 text-indigo-600 text-xs font-black rounded-2xl transition-all cursor-pointer"
            >
              <Mail size={14} />
              Email Support
            </a>
          </div>
        </div>
      )}

      {/* SUPPORT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: SEARCH & FAQS */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Search bar card */}
          <div className="bg-white p-5 rounded-3xl border border-[#f1f3f9] shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-slate-800">Frequently Asked Questions</h3>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 pointer-events-none" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for questions, terms, features..."
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 focus:bg-white rounded-2xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400"
              />
            </div>

            {/* Categories pills selection */}
            <div className="flex flex-wrap gap-2 pt-1">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeCategory === cat.id
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                  }`}
                >
                  {cat.icon}
                  <span>{cat.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* FAQS Accordion list */}
          <div className="space-y-3">
            {filteredFaqs.length > 0 ? (
              filteredFaqs.map((faq) => {
                const isOpen = openFaqId === faq.id;
                return (
                  <div 
                    key={faq.id}
                    className="bg-white border border-[#f1f3f9] hover:border-slate-200 rounded-2xl transition-all overflow-hidden shadow-xs"
                  >
                    <button
                      onClick={() => toggleFaq(faq.id)}
                      className="w-full px-5 py-4 flex justify-between items-center text-left cursor-pointer"
                    >
                      <span className="text-xs font-extrabold text-slate-800 pr-4">{faq.question}</span>
                      <ChevronDown 
                        size={16} 
                        className={`text-slate-450 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-600' : ''}`}
                      />
                    </button>
                    
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: 'auto' }}
                          exit={{ height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-5 pt-0.5 text-xs text-slate-500 leading-relaxed font-semibold border-t border-[#fafbfc]">
                            {faq.answer}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })
            ) : (
              <div className="bg-white border border-[#f1f3f9] rounded-3xl p-8 text-center space-y-2">
                <p className="text-xs font-extrabold text-slate-700">No results found</p>
                <p className="text-[11px] text-slate-400 font-semibold">Try modifying your query or selecting another category filter.</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: TICKET SUPPORT FORM */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Quick Contact cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-[#f1f3f9] p-4.5 rounded-2xl shadow-xs text-center space-y-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-650 flex items-center justify-center mx-auto">
                <MessageSquare size={16} />
              </div>
              <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider">Live Chat</h4>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-50 text-emerald-700 leading-none">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Online
              </span>
            </div>

            <a 
              href="https://docs.elister.ai"
              target="_blank"
              rel="noreferrer"
              className="bg-white hover:bg-slate-50 border border-[#f1f3f9] p-4.5 rounded-2xl shadow-xs text-center space-y-2 cursor-pointer transition-all block"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <BookOpen size={16} />
              </div>
              <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider">Documentation</h4>
              <span className="inline-flex items-center text-[9px] font-black text-indigo-600">
                Read Guides <ArrowRight size={10} className="ml-0.5" />
              </span>
            </a>
          </div>

          {/* Ticket Submission Form */}
          <div className="bg-white border border-[#f1f3f9] rounded-3xl p-6 shadow-sm">
            {submitted ? (
              <div className="text-center py-8 space-y-4 animate-in fade-in duration-300">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle size={28} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-extrabold text-slate-900">Ticket Submitted!</h3>
                  <p className="text-[11px] text-slate-400 font-semibold max-w-[240px] mx-auto leading-relaxed">
                    Thank you! Your query has been successfully received. We will respond within 24 hours.
                  </p>
                </div>
                <button
                  onClick={() => setSubmitted(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 rounded-xl cursor-pointer transition-all"
                >
                  Submit Another Query
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-extrabold text-slate-800">Open a Support Ticket</h3>
                  <p className="text-[10px] text-slate-450 font-semibold leading-normal">Submit your ticket and our reselling experts will assist you.</p>
                </div>

                <div className="space-y-3.5 pt-1">
                  {/* Name field */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider">Name</label>
                    <input 
                      type="text"
                      name="name"
                      required
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="Your full name"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-100 focus:bg-white rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-450"
                    />
                  </div>

                  {/* Email field */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider">Email Address</label>
                    <input 
                      type="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="name@email.com"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-100 focus:bg-white rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-450"
                    />
                  </div>

                  {/* Support Category field */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider">Category</label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-extrabold text-slate-700 cursor-pointer outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                    >
                      <option value="technical">Technical Support</option>
                      <option value="billing">Billing & Plan Inquiry</option>
                      <option value="listings">Listing / Cross-Listing Help</option>
                      <option value="general">General Question</option>
                    </select>
                  </div>

                  {/* Subject field */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider">Subject</label>
                    <input 
                      type="text"
                      name="subject"
                      required
                      value={formData.subject}
                      onChange={handleInputChange}
                      placeholder="Brief topic header"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-100 focus:bg-white rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-450"
                    />
                  </div>

                  {/* Message field */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider">Message</label>
                    <textarea 
                      name="message"
                      required
                      rows="4"
                      value={formData.message}
                      onChange={handleInputChange}
                      placeholder="Describe your issue or query in detail..."
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-100 focus:bg-white rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-450 resize-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-extrabold rounded-2xl flex items-center justify-center gap-2 text-xs transition-all active:scale-[0.98] shadow-md shadow-indigo-100 cursor-pointer mt-2"
                >
                  <Send size={14} />
                  {submitting ? 'Submitting Ticket...' : 'Submit Support Ticket'}
                </button>
              </form>
            )}
          </div>

        </div>

      </div>

      {/* BOTTOM CTA: PUBLIC WEBSITE ONLY */}
      {!isDashboard && (
        <div className="bg-slate-900 p-8 rounded-[2.5rem] text-center space-y-6 text-white max-w-4xl mx-auto shadow-xl relative overflow-hidden">
          <div className="relative z-10 space-y-2">
            <h3 className="text-xl font-bold">Resell smarter starting today</h3>
            <p className="text-slate-400 text-xs font-medium max-w-md mx-auto">Create a free account or upgrade to gain access to premium cross-listing endpoints.</p>
          </div>
          <div className="flex justify-center gap-4 relative z-10">
            <button 
              onClick={() => navigate('/signup')}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-500/20"
            >
              Get Started Free
            </button>
            <button 
              onClick={() => navigate('/login')}
              className="px-6 py-3 bg-white text-slate-900 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              Sign In
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default HelpSupport;

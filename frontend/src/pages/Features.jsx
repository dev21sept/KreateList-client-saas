import React from 'react';
import { motion } from 'framer-motion';
import { 
  Zap, 
  Shield, 
  BarChart3, 
  Sparkles, 
  Search, 
  Layers, 
  Database,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Features = () => {
  const navigate = useNavigate();

  const details = [
    {
      id: 'rule-engine',
      icon: <Zap className="w-6 h-6 text-indigo-600" />,
      title: 'Smart Rule Engine & Templates',
      tagline: 'Standardize listing schemas to avoid duplicate manual work.',
      description: 'The Rule Engine is the brain of Elister.ai. It lets you create reusable templates specifying title syntax, standard condition notes, and logistics parameters.',
      highlights: [
        'Drag-and-drop title syntax structuring.',
        'Quick-add dynamic attributes or static keywords (e.g. Vintage, Free Shipping).',
        'Save package weight & dimension presets to auto-populate shipping settings.',
        'Define location parameters and policy identifiers for compliance.'
      ],
      color: 'from-blue-50 to-indigo-50/50'
    },
    {
      id: 'taxonomy-api',
      icon: <Search className="w-6 h-6 text-emerald-600" />,
      title: 'eBay Taxonomy Category Lookup',
      tagline: 'Always match official eBay guidelines for categories & aspects.',
      description: 'No more searching for correct categories or facing listing rejection. The system suggestions leaf categories and fetches corresponding aspect constraints in real-time.',
      highlights: [
        'Debounced, async category autocomplete directly from eBay servers.',
        'Automatically fetch item aspects constraints (required and optional keys).',
        'Populates searchable aspect dropdown options dynamically.',
        'Seamless aspect updates when switching category values.'
      ],
      color: 'from-emerald-50 to-teal-50/50'
    },
    {
      id: 'ai-assistant',
      icon: <Sparkles className="w-6 h-6 text-purple-600" />,
      title: 'AI Listing Optimizer',
      tagline: 'Generate optimized copy in seconds using AI models.',
      description: 'Use the integrated AI generation assistant to optimize titles and descriptions based on product image metadata and prompt presets.',
      highlights: [
        'Instantly craft description paragraphs tailored to your audience.',
        'Ensure listing matches SEO standards to score higher in search results.',
        'Refine description prompt styling based on rules.',
        'Auto-extract details from initial product data.'
      ],
      color: 'from-purple-50 to-fuchsia-50/50'
    },
    {
      id: 'bulk-publishing',
      icon: <Layers className="w-6 h-6 text-amber-600" />,
      title: 'Bulk Publishing & Drafts',
      tagline: 'Batch process hundreds of product creations.',
      description: 'Create listing drafts first, perform final quality checks, and then batch publish them to eBay via secure OAuth authentication.',
      highlights: [
        'Save listings as drafts locally in Elister.ai.',
        'Edit SKU, categories, and specifics before sending data live.',
        'Monitor listing status (Draft, Scheduled, Published, Failed) on the Dashboard.',
        'Verify eBay URL links immediately after creation.'
      ],
      color: 'from-amber-50/70 to-orange-50/30'
    }
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 space-y-16 antialiased pt-24">
      {/* Header */}
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <span className="px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-[10px] font-black text-indigo-600 uppercase tracking-widest">
          Features
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Everything You Need to Scale</h1>
        <p className="text-slate-500 text-sm font-medium leading-relaxed">
          Elister.ai is built specifically for growing eBay resellers. Discover how our tools automate manual listing chores.
        </p>
      </div>

      {/* Grid of detailed features */}
      <div className="space-y-12">
        {details.map((feat, idx) => (
          <motion.div
            key={feat.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className={`grid grid-cols-1 lg:grid-cols-12 gap-8 p-8 rounded-[2.5rem] bg-gradient-to-r ${feat.color} border border-slate-100 shadow-sm`}
          >
            <div className="lg:col-span-5 space-y-4">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center">
                {feat.icon}
              </div>
              <h3 className="text-xl font-extrabold text-slate-900">{feat.title}</h3>
              <p className="text-indigo-600 text-xs font-bold">{feat.tagline}</p>
              <p className="text-slate-500 text-xs leading-relaxed font-semibold">
                {feat.description}
              </p>
            </div>

            <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-slate-100/50 shadow-inner space-y-4 flex flex-col justify-center">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Key Capabilities</h4>
              <ul className="space-y-3">
                {feat.highlights.map((hl, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs font-bold text-slate-700 leading-tight">
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    <span>{hl}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Bottom CTA */}
      <div className="bg-slate-900 p-8 rounded-[2.5rem] text-center space-y-6 text-white max-w-4xl mx-auto shadow-xl relative overflow-hidden">
        <div className="relative z-10 space-y-2">
          <h3 className="text-xl font-bold">Ready to see it in action?</h3>
          <p className="text-slate-400 text-xs font-medium max-w-md mx-auto">Create an account or select the pricing tier that best fits your listing volumes.</p>
        </div>
        <div className="flex justify-center gap-4 relative z-10">
          <button 
            onClick={() => navigate('/pricing')}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-500/20"
          >
            View Pricing Plans
          </button>
          <button 
            onClick={() => navigate('/signup')}
            className="px-6 py-3 bg-white text-slate-900 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            Start Free Trial
          </button>
        </div>
      </div>
    </div>
  );
};

export default Features;

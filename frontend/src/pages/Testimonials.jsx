import React from 'react';
import { motion } from 'framer-motion';
import { Star, Quote, Sparkles, MessageSquare, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const testimonialsData = [
  {
    id: 1,
    name: "Sarah Jenkins",
    role: "eBay PowerSeller",
    storeSize: "15,000+ active listings",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=150",
    rating: 5,
    quote: "Elister.ai completely changed our eBay workflow. Creating a listing with perfect description and AI aspects now takes under a minute. Our sales have grown by 35% in just three months!",
    tag: "Efficiency"
  },
  {
    id: 2,
    name: "David Chen",
    role: "Founder, Chen Logistics",
    storeSize: "Top Rated Seller",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150",
    rating: 5,
    quote: "The rule engine is incredibly powerful. Setting custom sequences for titles based on category details has cut our drafts preparation time in half. Official eBay OAuth integration makes it so reliable.",
    tag: "Rule Engine"
  },
  {
    id: 3,
    name: "Amanda Ross",
    role: "Vintage Clothing Curator",
    storeSize: "8,500+ items sold",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=150",
    rating: 5,
    quote: "AI aspect mapping is pure magic. It automatically extracts details from images and vintage descriptions that I used to manually type out. An absolute lifesaver for fashion sellers.",
    tag: "AI Aspect Mapping"
  },
  {
    id: 4,
    name: "Marcus Brodie",
    role: "Refurbished Electronics Outlet",
    storeSize: "Volume Business Seller",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=150",
    rating: 5,
    quote: "We cross-list hundreds of items daily. The platform's automated templates ensure our conditions policies are aligned correctly. Couldn't recommend Elister.ai enough.",
    tag: "Automation"
  },
  {
    id: 5,
    name: "Elena Rostova",
    role: "Direct Consumer Brands",
    storeSize: "Multi-channel reseller",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150",
    rating: 5,
    quote: "The bulk listing tools and API push are extremely stable. We previously had connection issues with other tools, but Elister.ai oauth connection has worked flawlessly.",
    tag: "Integration"
  },
  {
    id: 6,
    name: "Tyler Vance",
    role: "Collectible Toys Shop Owner",
    storeSize: "4,000+ listings",
    avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=150",
    rating: 5,
    quote: "I love the clean interface. Everything from creating rules to viewing listings analytics is extremely simple. Customer support responds almost instantly whenever we have policy questions.",
    tag: "UX Design"
  }
];

const Testimonials = () => {
  return (
    <div className="bg-slate-50 min-h-screen pt-28 pb-16">
      {/* Background Decorative Blur */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[5%] left-[10%] w-[35%] h-[35%] bg-indigo-200/10 blur-[130px] rounded-full"></div>
        <div className="absolute bottom-[20%] right-[5%] w-[30%] h-[30%] bg-violet-200/10 blur-[130px] rounded-full"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center space-y-4 mb-16">
          <span className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-bold bg-indigo-50 border border-indigo-100 text-indigo-700 tracking-wide uppercase">
            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-indigo-500 fill-indigo-500" /> 
            Customer Love
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-none font-sans">
            Hear from Successful<br className="hidden sm:inline" />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
              eBay Sellers & Store Owners
            </span>
          </h1>
          <p className="text-base text-slate-500 max-w-xl mx-auto leading-relaxed font-medium">
            Discover how Elister.ai is helping sellers automate aspects extraction, draft titles, and list products 10x faster.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {testimonialsData.map((item, idx) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
              className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm relative flex flex-col justify-between hover:shadow-md transition-all duration-300 group"
            >
              <div className="absolute -top-3 -right-3 w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-500 opacity-20 group-hover:opacity-100 transition-opacity duration-300">
                <Quote size={18} className="fill-indigo-50" />
              </div>
              
              <div className="space-y-6">
                {/* Rating & Tag */}
                <div className="flex justify-between items-center">
                  <div className="flex text-amber-400">
                    {[...Array(item.rating)].map((_, i) => (
                      <Star key={i} size={16} className="fill-amber-400 stroke-amber-400" />
                    ))}
                  </div>
                  <span className="text-[10px] font-black text-indigo-600 bg-indigo-50/70 border border-indigo-100/50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {item.tag}
                  </span>
                </div>

                {/* Quote Text */}
                <p className="text-sm font-medium text-slate-600 leading-relaxed italic">
                  "{item.quote}"
                </p>
              </div>

              {/* User Bio */}
              <div className="flex items-center space-x-4 pt-6 mt-6 border-t border-slate-50">
                <img 
                  src={item.avatar} 
                  alt={item.name} 
                  className="w-12 h-12 rounded-2xl object-cover border-2 border-slate-100" 
                />
                <div className="text-left min-w-0">
                  <h4 className="font-bold text-slate-900 text-sm truncate">{item.name}</h4>
                  <p className="text-xs text-slate-500 font-medium truncate">{item.role}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{item.storeSize}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA Teaser */}
        <div className="bg-slate-900 rounded-[2.5rem] p-12 text-center relative overflow-hidden shadow-xl max-w-4xl mx-auto">
          <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-indigo-600/10 blur-[100px] rounded-full"></div>
          <div className="absolute bottom-0 left-0 w-[200px] h-[200px] bg-violet-600/10 blur-[100px] rounded-full"></div>
          
          <div className="relative z-10 space-y-6 max-w-lg mx-auto">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mx-auto text-white">
              <MessageSquare size={24} />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Ready to optimize your workflow?</h2>
            <p className="text-slate-400 text-xs font-semibold leading-relaxed">
              Join Sarah, David, and thousands of other resellers. Save hours on template generation, categories matching, and specifics filling.
            </p>
            <div className="pt-2">
              <Link 
                to="/signup" 
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-indigo-500/20 hover:scale-[1.02]"
              >
                Start Listing for Free <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Testimonials;

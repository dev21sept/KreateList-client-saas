import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  Shield,
  BarChart3,
  Rocket,
  Check,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Sliders,
  Layers,
  ShoppingBag,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Cpu,
  Globe2,
  ExternalLink,
  Laptop
} from 'lucide-react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useReducedMotion } from '../hooks/useReducedMotion';
import CountUp from '../components/CountUp';

const Home = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  // Hero Slider Active Slide Index
  const [activeSlide, setActiveSlide] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    if (code || error) {
      console.log('Detected eBay callback params on Home page, forwarding to /ebay-callback...');
      navigate(`/ebay-callback${window.location.search}`, { replace: true });
    }
  }, [searchParams, navigate]);

  // Platforms definition
  const platforms = [
    {
      name: 'eBay',
      logo: '/ebay.png',
      status: 'Live & Active',
      isLive: true,
      desc: 'Full 2-way sync, automated inventory import, live listing publishing & real-time sold tracking.',
      features: ['Auto-import inventory', '1-Click cross-publish', 'Instant sold detection', 'Smart fee calculation'],
      accent: 'border-blue-200 bg-blue-50/50 hover:border-blue-400'
    },
    {
      name: 'Poshmark',
      logo: '/poshmark.png',
      status: 'Coming Soon',
      isLive: false,
      desc: 'High-speed closet share, automated cross-listing, and smart price drop automation.',
      features: ['Closet auto-sync', 'Offer to likers sync', 'Real-time delist guard', 'Brand auto-mapping'],
      accent: 'border-rose-200 bg-rose-50/50 hover:border-rose-400'
    },
    {
      name: 'Mercari',
      logo: '/mercari.png',
      status: 'Coming Soon',
      isLive: false,
      desc: 'Instant 1-click import, automatic listing promoter, and zero-delay sold item removal.',
      features: ['Direct store sync', 'Promote & drop engine', 'Double-sale prevention', 'Category mapping'],
      accent: 'border-red-200 bg-red-50/50 hover:border-red-400'
    },
    {
      name: 'Etsy',
      logo: '/etsy.png',
      status: 'Coming Soon',
      isLive: false,
      desc: 'Seamless multi-shop integration for vintage, handmade, and unique marketplace listings.',
      features: ['Multi-shop connection', 'Tag & keyword AI', 'Inventory deduplication', 'Stock level matching'],
      accent: 'border-amber-200 bg-amber-50/50 hover:border-amber-400'
    },
    {
      name: 'Amazon',
      logo: '/amazon.png',
      status: 'Coming Soon',
      isLive: false,
      desc: 'ASIN catalog matching, automated FBA/FBM inventory balance, and high-velocity order tracking.',
      features: ['ASIN match lookup', 'FBM stock guard', 'Price markup formulas', 'Multi-channel balance'],
      accent: 'border-yellow-200 bg-yellow-50/50 hover:border-yellow-400'
    },
    {
      name: 'Depop',
      logo: '/depop.png',
      status: 'Coming Soon',
      isLive: false,
      desc: 'Gen-Z streetwear and fashion listing synchronization with auto-refresh and bundle features.',
      features: ['Streetwear tagger', 'Fast image optimizer', 'Instant cross-delist', 'Mobile push alerts'],
      accent: 'border-red-200 bg-red-50/50 hover:border-red-400'
    },
  ];

  // Hero interactive slides
  const heroSlides = [
    {
      id: 'matrix',
      tag: 'Omnichannel Matrix',
      title: '1-Click Master Cross-Listing Matrix',
      subtitle: 'Create a listing once. Publish to eBay, Poshmark, Mercari, Etsy, Amazon, and Depop simultaneously in seconds.',
      badge: 'Multi-Channel Engine',
      badgeColor: 'bg-indigo-500/10 text-indigo-700 border-indigo-200',
      icon: Layers,
      previewComponent: (
        <div className="bg-slate-900 rounded-2xl p-5 md:p-7 text-white shadow-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-rose-500 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
              <span className="text-xs font-mono text-slate-400 ml-2">Master Product #8942</span>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">
              Synced to 6 Channels
            </span>
          </div>

          <div className="flex items-center space-x-4 bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60">
            <div className="w-14 h-14 bg-slate-700 rounded-lg flex items-center justify-center font-bold text-slate-300 text-lg">
              👟
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-white truncate">Nike Air Jordan 1 Retro High OG - Chicago</h4>
              <p className="text-xs text-slate-400">Master SKU: <span className="font-mono text-indigo-300">NK-AJ1-002</span> | Qty: 1</p>
            </div>
            <div className="text-right">
              <div className="text-base font-bold text-emerald-400">$185.00</div>
              <div className="text-[10px] text-slate-400">Target Profit: +38%</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/40 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <img src="/ebay.png" alt="eBay" className="w-5 h-5 object-contain" />
                <span className="font-medium text-slate-200">eBay</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">LIVE</span>
            </div>

            <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/40 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <img src="/poshmark.png" alt="Poshmark" className="w-5 h-5 object-contain" />
                <span className="font-medium text-slate-200">Poshmark</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">READY</span>
            </div>

            <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/40 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <img src="/mercari.png" alt="Mercari" className="w-5 h-5 object-contain" />
                <span className="font-medium text-slate-200">Mercari</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">READY</span>
            </div>

            <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/40 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <img src="/etsy.png" alt="Etsy" className="w-5 h-5 object-contain" />
                <span className="font-medium text-slate-200">Etsy</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">READY</span>
            </div>

            <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/40 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <img src="/amazon.png" alt="Amazon" className="w-5 h-5 object-contain" />
                <span className="font-medium text-slate-200">Amazon</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">READY</span>
            </div>

            <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/40 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <img src="/depop.png" alt="Depop" className="w-5 h-5 object-contain" />
                <span className="font-medium text-slate-200">Depop</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">READY</span>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'delist',
      tag: 'Zero Double-Selling',
      title: '24/7 Sold Tracker & Auto-Delist Guard',
      subtitle: 'When an item sells on eBay or any marketplace, Elister instantly detects it and automatically delists it across all other stores in under 60 seconds.',
      badge: 'Zero Risk Protection',
      badgeColor: 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
      icon: Shield,
      previewComponent: (
        <div className="bg-slate-900 rounded-2xl p-5 md:p-7 text-white shadow-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping inline-block"></span>
              <span className="text-xs font-mono text-emerald-300">Live Sold Event Triggered</span>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Auto-Delisting in Action
            </span>
          </div>

          <div className="bg-emerald-950/40 border border-emerald-800/60 p-3.5 rounded-xl flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-emerald-600/30 flex items-center justify-center text-emerald-400 font-bold">
                ✓
              </div>
              <div>
                <div className="text-xs font-medium text-emerald-200">ITEM SOLD ON EBAY</div>
                <div className="text-sm font-bold text-white">Vintage Leather Bomber Jacket - L</div>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-400">$142.50</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/70 border border-slate-700/50">
              <div className="flex items-center space-x-2">
                <img src="/poshmark.png" alt="Poshmark" className="w-5 h-5 object-contain" />
                <span>Poshmark Listing #PM-4819</span>
              </div>
              <span className="text-rose-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Auto-Delisted (0.8s)
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/70 border border-slate-700/50">
              <div className="flex items-center space-x-2">
                <img src="/mercari.png" alt="Mercari" className="w-5 h-5 object-contain" />
                <span>Mercari Listing #MC-9021</span>
              </div>
              <span className="text-rose-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Auto-Delisted (1.1s)
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/70 border border-slate-700/50">
              <div className="flex items-center space-x-2">
                <img src="/etsy.png" alt="Etsy" className="w-5 h-5 object-contain" />
                <span>Etsy Listing #ET-3301</span>
              </div>
              <span className="text-rose-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Auto-Delisted (1.4s)
              </span>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'vision',
      tag: 'Vision AI Multimodal',
      title: 'Photo to Live Listing in 1.2 Seconds',
      subtitle: 'Upload product photos. Our custom Vision AI scans the item, extracts brand, condition, category, item specifics, and crafts SEO-optimized descriptions.',
      badge: 'Next-Gen AI',
      badgeColor: 'bg-violet-500/10 text-violet-700 border-violet-200',
      icon: Sparkles,
      previewComponent: (
        <div className="bg-slate-900 rounded-2xl p-5 md:p-7 text-white shadow-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <span className="text-xs font-mono text-violet-300">Vision AI Extraction Engine</span>
            </div>
            <span className="text-xs font-mono text-slate-400">Confidence: 99.4%</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
              <div className="text-[10px] text-slate-400 uppercase font-mono mb-1">Generated SEO Title</div>
              <div className="text-xs font-semibold text-slate-100 line-clamp-2">
                Apple MacBook Pro 14" M3 Pro 18GB 512GB Space Black Pristine Condition
              </div>
            </div>
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
              <div className="text-[10px] text-slate-400 uppercase font-mono mb-1">Recommended Pricing</div>
              <div className="text-xs font-semibold text-emerald-400">
                $1,499.00 <span className="text-slate-400 text-[10px] font-normal">(Avg sold: $1,475)</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60 space-y-2">
            <div className="text-[10px] text-slate-400 uppercase font-mono">Extracted Item Specifics</div>
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[11px] px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">Brand: Apple</span>
              <span className="text-[11px] px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">Model: M3 Pro</span>
              <span className="text-[11px] px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">RAM: 18GB</span>
              <span className="text-[11px] px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">SSD: 512GB</span>
              <span className="text-[11px] px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">Color: Space Black</span>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'sync',
      tag: 'Continuous Background Sync',
      title: '30-Minute Automated Inventory Sync',
      subtitle: 'Our intelligent server-side background worker polls your inventory every 30 minutes, fuzzy-deduplicates active items, and keeps stock balances accurate.',
      badge: 'Automated 24/7',
      badgeColor: 'bg-blue-500/10 text-blue-700 border-blue-200',
      icon: RefreshCw,
      previewComponent: (
        <div className="bg-slate-900 rounded-2xl p-5 md:p-7 text-white shadow-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
              <span className="text-xs font-mono text-blue-300">30-Min Background Poller</span>
            </div>
            <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
              Next Sync: 14m 20s
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/80 border border-slate-700">
              <div className="flex items-center space-x-3">
                <span className="text-lg">🔄</span>
                <div>
                  <div className="font-semibold text-white">Full Inventory Re-Verification</div>
                  <div className="text-[10px] text-slate-400">Comparing active items across all linked marketplaces</div>
                </div>
              </div>
              <span className="text-emerald-400 font-mono font-bold">100% Synced</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/80 border border-slate-700">
              <div className="flex items-center space-x-3">
                <span className="text-lg">🧠</span>
                <div>
                  <div className="font-semibold text-white">Fuzzy Match Deduplication</div>
                  <div className="text-[10px] text-slate-400">Merging multi-store duplicate products into unified Master Items</div>
                </div>
              </div>
              <span className="text-indigo-400 font-mono font-bold">Auto-Merged</span>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'rules',
      tag: 'Smart Pricing Rules',
      title: 'Automated Platform Pricing & Fee Compensation',
      subtitle: 'Apply dynamic markups per channel to offset commission fees (e.g. +12% on Poshmark, +5% on Mercari) so your profit margins stay protected.',
      badge: 'Margin Maximizer',
      badgeColor: 'bg-amber-500/10 text-amber-700 border-amber-200',
      icon: Sliders,
      previewComponent: (
        <div className="bg-slate-900 rounded-2xl p-5 md:p-7 text-white shadow-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-mono text-amber-300">Custom Business Rules Engine</span>
            </div>
            <span className="text-xs text-slate-400">Base Price: $100.00</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/70 border border-slate-700/60">
              <div className="flex items-center space-x-2">
                <img src="/ebay.png" alt="eBay" className="w-5 h-5 object-contain" />
                <span className="font-medium text-slate-200">eBay Rule (Standard)</span>
              </div>
              <span className="font-mono text-emerald-400 font-semibold">$100.00 (0% Markup)</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/70 border border-slate-700/60">
              <div className="flex items-center space-x-2">
                <img src="/poshmark.png" alt="Poshmark" className="w-5 h-5 object-contain" />
                <span className="font-medium text-slate-200">Poshmark Rule (20% Fee Offset)</span>
              </div>
              <span className="font-mono text-emerald-400 font-semibold">$120.00 (+20%)</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/70 border border-slate-700/60">
              <div className="flex items-center space-x-2">
                <img src="/mercari.png" alt="Mercari" className="w-5 h-5 object-contain" />
                <span className="font-medium text-slate-200">Mercari Rule (10% Fee Offset)</span>
              </div>
              <span className="font-mono text-emerald-400 font-semibold">$110.00 (+10%)</span>
            </div>
          </div>
        </div>
      )
    }
  ];

  // Auto-play slider interval
  useEffect(() => {
    if (!autoPlay) return;
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % heroSlides.length);
    }, 5500);
    return () => clearInterval(interval);
  }, [autoPlay, heroSlides.length]);

  const currentSlideData = heroSlides[activeSlide];

  const fadeUp = (delay = 0) => ({
    initial: reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-80px' },
    transition: { duration: reduceMotion ? 0 : 0.5, delay: reduceMotion ? 0 : delay },
  });

  return (
    <div className="pt-20 space-y-24 bg-white text-slate-800 selection:bg-indigo-500 selection:text-white">
      
      {/* 1. HERO SECTION WITH INTERACTIVE SLIDER */}
      <section className="relative overflow-hidden pt-8 pb-16 lg:pt-14 lg:pb-24">
        {/* Ambient Gradient Backgrounds */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 pointer-events-none">
          <div className="absolute top-[-5%] left-[-10%] w-[45%] h-[45%] bg-indigo-300/20 blur-[130px] rounded-full"></div>
          <div className="absolute top-[20%] right-[-10%] w-[35%] h-[35%] bg-violet-300/20 blur-[130px] rounded-full"></div>
          <div className="absolute bottom-[-10%] left-[20%] w-[30%] h-[30%] bg-blue-200/20 blur-[120px] rounded-full"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Hero Header */}
          <div className="text-center max-w-4xl mx-auto space-y-5">
            <motion.div
              initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.4 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold bg-indigo-50 border border-indigo-200/80 text-indigo-700 shadow-sm"
            >
              <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
              <span>All-In-One AI Multi-Channel Cross-Listing & Auto-Delist Suite</span>
            </motion.div>

            <motion.h1
              initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.5, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.12]"
            >
              List Across Every Marketplace.<br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600">
                Zero Double-Sales. 100% Automated.
              </span>
            </motion.h1>

            <motion.p
              initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.5, delay: 0.2 }}
              className="text-lg sm:text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed"
            >
              The ultimate eCommerce powerhouse for high-volume resellers. Generate listings in seconds with Vision AI, sync inventory across eBay, Poshmark, Mercari, Etsy, Amazon, and Depop, and let our background engine auto-delist sold items 24/7.
            </motion.p>

            {/* Hero CTAs */}
            <motion.div
              initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2"
            >
              <Link
                to="/register"
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 rounded-xl text-base font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transform hover:-translate-y-0.5 transition-all duration-200"
              >
                <span>Start Free Trial</span>
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>

              <Link
                to="/pricing"
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 rounded-xl text-base font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/90 shadow-sm hover:border-slate-300 transition-all duration-200"
              >
                <span>View Pricing Plans</span>
              </Link>
            </motion.div>

            {/* Trust badge */}
            <div className="pt-2 flex items-center justify-center gap-6 text-xs sm:text-sm text-slate-500">
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-500" /> No credit card required</span>
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-500" /> Free 10 AI listings</span>
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-500" /> 24/7 Sold Protection</span>
            </div>
          </div>

          {/* INTERACTIVE HERO SLIDER */}
          <div 
            className="mt-14 max-w-5xl mx-auto"
            onMouseEnter={() => setAutoPlay(false)}
            onMouseLeave={() => setAutoPlay(true)}
          >
            {/* Slider Navigation Tabs */}
            <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
              {heroSlides.map((slide, idx) => {
                const IconComponent = slide.icon;
                const isSelected = idx === activeSlide;
                return (
                  <button
                    key={slide.id}
                    onClick={() => setActiveSlide(idx)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
                      isSelected
                        ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10 scale-105'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                    }`}
                  >
                    <IconComponent className={`w-4 h-4 ${isSelected ? 'text-indigo-400' : 'text-slate-500'}`} />
                    <span>{slide.tag}</span>
                  </button>
                );
              })}
            </div>

            {/* Slide Body Card */}
            <div className="relative bg-slate-950 rounded-3xl p-6 sm:p-8 md:p-10 shadow-2xl border border-slate-800 text-white overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                {/* Left: Info Text */}
                <div className="lg:col-span-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-3 py-1 rounded-full font-bold border ${currentSlideData.badgeColor}`}>
                      {currentSlideData.badge}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">Slide {activeSlide + 1} of {heroSlides.length}</span>
                  </div>

                  <h3 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
                    {currentSlideData.title}
                  </h3>

                  <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                    {currentSlideData.subtitle}
                  </p>

                  <div className="pt-2 flex items-center gap-4">
                    <Link
                      to="/register"
                      className="inline-flex items-center gap-2 text-sm font-bold text-indigo-400 hover:text-indigo-300 group"
                    >
                      <span>Explore this feature</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </div>

                {/* Right: Dynamic Interactive Preview */}
                <div className="lg:col-span-6">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentSlideData.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.35 }}
                    >
                      {currentSlideData.previewComponent}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              {/* Slider Controls Bottom */}
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-800/80 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Interactive Live Engine Demo</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveSlide((prev) => (prev === 0 ? heroSlides.length - 1 : prev - 1))}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                    aria-label="Previous Slide"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setActiveSlide((prev) => (prev + 1) % heroSlides.length)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                    aria-label="Next Slide"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. PLATFORMS ECOSYSTEM GRID (eBay Live + Coming Soon) */}
      <section className="py-12 bg-slate-50 border-y border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider bg-indigo-100/60 px-3 py-1 rounded-full">
              Omnichannel Marketplace Hub
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Connect Every Major Marketplace
            </h2>
            <p className="text-slate-600 text-base sm:text-lg">
              Manage your entire reselling empire from a unified master hub. eBay is fully live with 2-way sync, with 5 major channels unlocking soon.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {platforms.map((p, idx) => (
              <motion.div
                key={p.name}
                {...fadeUp(idx * 0.08)}
                className={`bg-white rounded-2xl p-6 border transition-all duration-300 shadow-sm hover:shadow-md flex flex-col justify-between ${
                  p.isLive 
                    ? 'border-indigo-300 ring-2 ring-indigo-500/20 shadow-indigo-100' 
                    : 'border-slate-200/80 hover:border-slate-300'
                }`}
              >
                <div className="space-y-4">
                  {/* Platform Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 p-2 flex items-center justify-center border border-slate-200/60">
                        <img src={p.logo} alt={p.name} className="w-full h-full object-contain" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">{p.name}</h3>
                        <span className="text-xs text-slate-400">Marketplace Integration</span>
                      </div>
                    </div>

                    <div>
                      {p.isLive ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          Live & Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <Clock className="w-3 h-3 text-amber-600" />
                          Coming Soon
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-slate-600 leading-relaxed">
                    {p.desc}
                  </p>

                  {/* Feature checklist */}
                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    {p.features.map((feat, fIdx) => (
                      <div key={fIdx} className="flex items-center text-xs text-slate-600 gap-2">
                        <Check className={`w-3.5 h-3.5 ${p.isLive ? 'text-emerald-600' : 'text-slate-400'}`} />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-5 mt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">
                    {p.isLive ? 'Full API & Delist Active' : 'Joining ecosystem soon'}
                  </span>
                  {p.isLive ? (
                    <Link
                      to="/login"
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    >
                      <span>Connect Now</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  ) : (
                    <span className="text-xs font-semibold text-slate-400">In Development</span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. CORE PLATFORM CAPABILITIES - WHAT'S HAPPENING IN ELISTER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-3 py-1 rounded-full">
            Under The Hood
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Everything Happening Inside Elister.ai
          </h2>
          <p className="text-slate-600 text-base sm:text-lg">
            A comprehensive, autonomous operating system built specifically to eliminate tedious reseller manual labor.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Card 1 */}
          <motion.div {...fadeUp(0.1)} className="bg-white p-7 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-5 font-bold">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Master Cross-Listing Hub</h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Maintain one single master catalog. Edit title, photos, price, or description once, and push updates to multiple linked stores instantly.
            </p>
            <ul className="text-xs text-slate-500 space-y-2">
              <li className="flex items-center gap-2">✓ Unified Master SKU management</li>
              <li className="flex items-center gap-2">✓ Multi-marketplace status tracking</li>
              <li className="flex items-center gap-2">✓ 1-Click bulk publishing</li>
            </ul>
          </motion.div>

          {/* Card 2 */}
          <motion.div {...fadeUp(0.2)} className="bg-white p-7 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-5 font-bold">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Instant Auto-Delisting</h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Never cancel an order or get penalized for out-of-stock items again. The second an item sells anywhere, it is automatically removed elsewhere.
            </p>
            <ul className="text-xs text-slate-500 space-y-2">
              <li className="flex items-center gap-2">✓ Sub-60 second sold detection</li>
              <li className="flex items-center gap-2">✓ Zero double-selling guarantee</li>
              <li className="flex items-center gap-2">✓ Audit logs & auto-delist history</li>
            </ul>
          </motion.div>

          {/* Card 3 */}
          <motion.div {...fadeUp(0.3)} className="bg-white p-7 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center mb-5 font-bold">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Vision AI Generator</h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Upload photos and let AI analyze the product visually. Automatically fills brand, model, specifics, item condition, and SEO-friendly titles.
            </p>
            <ul className="text-xs text-slate-500 space-y-2">
              <li className="flex items-center gap-2">✓ Multimodal vision analysis</li>
              <li className="flex items-center gap-2">✓ Marketplace category auto-matcher</li>
              <li className="flex items-center gap-2">✓ Competitive market pricing estimate</li>
            </ul>
          </motion.div>

          {/* Card 4 */}
          <motion.div {...fadeUp(0.4)} className="bg-white p-7 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-5 font-bold">
              <RefreshCw className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">30-Min Automated Sync</h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Hands-free background cron workers run every 30 minutes, keeping your master inventory perfectly balanced across all connected accounts.
            </p>
            <ul className="text-xs text-slate-500 space-y-2">
              <li className="flex items-center gap-2">✓ Automated scheduled syncs</li>
              <li className="flex items-center gap-2">✓ Smart duplicate detection & merge</li>
              <li className="flex items-center gap-2">✓ Real-time status re-verification</li>
            </ul>
          </motion.div>

          {/* Card 5 */}
          <motion.div {...fadeUp(0.5)} className="bg-white p-7 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-5 font-bold">
              <Sliders className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Smart Rules & Fee Adjuster</h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Set automated business formulas: automatically add +15% on high-fee platforms, round up prices to .99, or auto-apply shipping policies.
            </p>
            <ul className="text-xs text-slate-500 space-y-2">
              <li className="flex items-center gap-2">✓ Channel-specific pricing markups</li>
              <li className="flex items-center gap-2">✓ Automated shipping & return rules</li>
              <li className="flex items-center gap-2">✓ Smart inventory thresholds</li>
            </ul>
          </motion.div>

          {/* Card 6 */}
          <motion.div {...fadeUp(0.6)} className="bg-white p-7 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center mb-5 font-bold">
              <Laptop className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Browser Extension Importer</h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Import active listings directly from your browser with our companion extension. Scrapes photos, specs, and details in one click.
            </p>
            <ul className="text-xs text-slate-500 space-y-2">
              <li className="flex items-center gap-2">✓ 1-Click web listing scraper</li>
              <li className="flex items-center gap-2">✓ Instant import to Master Catalog</li>
              <li className="flex items-center gap-2">✓ Fast draft creation</li>
            </ul>
          </motion.div>
        </div>
      </section>

      {/* 4. COMPARISON: THE OLD WAY VS ELISTER.AI */}
      <section className="py-16 bg-slate-900 text-white rounded-3xl max-w-7xl mx-auto px-6 sm:px-10 lg:px-12">
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
          <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider bg-indigo-500/20 px-3 py-1 rounded-full border border-indigo-500/30">
            Why Resellers Switch
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Stop Wasting 20+ Hours Every Week
          </h2>
          <p className="text-slate-400 text-base sm:text-lg">
            See how Elister transforms the chaotic manual reselling grind into a streamlined autopilot machine.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Old Way */}
          <div className="bg-slate-800/60 p-6 sm:p-8 rounded-2xl border border-rose-500/20 space-y-4">
            <div className="flex items-center space-x-2 text-rose-400 font-bold text-lg">
              <AlertTriangle className="w-5 h-5" />
              <span>The Old Manual Way</span>
            </div>
            <ul className="space-y-3 text-sm text-slate-300">
              <li className="flex items-start gap-2.5">
                <span className="text-rose-400 font-bold">✕</span>
                <span>Copy-pasting titles, images, and descriptions into 4 different apps manually.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-rose-400 font-bold">✕</span>
                <span>Constant fear of double-selling when an item sells while you're asleep or away.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-rose-400 font-bold">✕</span>
                <span>Account penalties and defects due to out-of-stock order cancellations.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-rose-400 font-bold">✕</span>
                <span>Writing item descriptions and looking up category codes for 15 minutes per item.</span>
              </li>
            </ul>
          </div>

          {/* Elister Way */}
          <div className="bg-indigo-950/40 p-6 sm:p-8 rounded-2xl border border-indigo-500/40 space-y-4 shadow-xl">
            <div className="flex items-center space-x-2 text-emerald-400 font-bold text-lg">
              <CheckCircle2 className="w-5 h-5" />
              <span>The Elister.ai Autopilot Way</span>
            </div>
            <ul className="space-y-3 text-sm text-slate-200">
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Create once in Master Catalog and cross-list to all 6 marketplaces with 1 click.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>24/7 background Sold Tracker auto-delists across all stores in under 60 seconds.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Protect seller metrics and maintain 100% Top-Rated status effortlessly.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Vision AI creates professional, keyword-stuffed listings from photos in 1.2s.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 5. STATS COUNTER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="text-3xl sm:text-4xl font-extrabold text-indigo-600 mb-1">
              <CountUp value={100} duration={1.5} />k+
            </div>
            <div className="text-xs sm:text-sm font-semibold text-slate-600">Listings Synced</div>
          </div>

          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="text-3xl sm:text-4xl font-extrabold text-emerald-600 mb-1">
              &lt;<CountUp value={60} duration={1.5} />s
            </div>
            <div className="text-xs sm:text-sm font-semibold text-slate-600">Auto-Delist Speed</div>
          </div>

          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="text-3xl sm:text-4xl font-extrabold text-violet-600 mb-1">
              <CountUp value={99} duration={1.5} />.9%
            </div>
            <div className="text-xs sm:text-sm font-semibold text-slate-600">Double-Sale Prevention</div>
          </div>

          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="text-3xl sm:text-4xl font-extrabold text-blue-600 mb-1">
              <CountUp value={10} duration={1.5} />x
            </div>
            <div className="text-xs sm:text-sm font-semibold text-slate-600">Faster Listing Workflow</div>
          </div>
        </div>
      </section>

      {/* 6. HOW IT WORKS - 3 SIMPLE STEPS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-3 py-1 rounded-full">
            Quick Setup
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            How Elister Works in 3 Steps
          </h2>
          <p className="text-slate-600 text-base">
            Get your stores connected and automated in less than two minutes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-7 rounded-2xl border border-slate-200/90 shadow-sm relative">
            <div className="text-3xl font-extrabold text-indigo-200 mb-3">01</div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Connect Your Accounts</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Authorize your eBay store and connect your reselling accounts in one secure click via official OAuth.
            </p>
          </div>

          <div className="bg-white p-7 rounded-2xl border border-slate-200/90 shadow-sm relative">
            <div className="text-3xl font-extrabold text-indigo-200 mb-3">02</div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Import & Generate with AI</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Import existing listings or snap new photos. Vision AI formats titles, item specifics, and descriptions automatically.
            </p>
          </div>

          <div className="bg-white p-7 rounded-2xl border border-slate-200/90 shadow-sm relative">
            <div className="text-3xl font-extrabold text-indigo-200 mb-3">03</div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Sit Back & Sell</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Elister synchronizes stock every 30 minutes and auto-delists items across all other platforms the instant they sell.
            </p>
          </div>
        </div>
      </section>

      {/* 7. PRE-FOOTER FINAL CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-950 text-white p-8 sm:p-12 lg:p-16 shadow-2xl border border-indigo-800/40 text-center space-y-6">
          <div className="max-w-3xl mx-auto space-y-4">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">
              Ready to Scale Your Reselling Business on Autopilot?
            </h2>
            <p className="text-base sm:text-lg text-indigo-200 max-w-2xl mx-auto">
              Join hundreds of high-volume sellers saving 20+ hours a week. Start your 14-day free trial today.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link
              to="/register"
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 rounded-xl text-base font-bold text-indigo-950 bg-white hover:bg-indigo-50 shadow-lg hover:shadow-white/20 transform hover:-translate-y-0.5 transition-all duration-200"
            >
              <span>Get Started Free</span>
              <ArrowRight className="w-5 h-5 ml-2 text-indigo-900" />
            </Link>

            <Link
              to="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 rounded-xl text-base font-semibold text-white bg-indigo-800/40 hover:bg-indigo-800/60 border border-indigo-500/30 transition-all duration-200"
            >
              <span>Sign In to Dashboard</span>
            </Link>
          </div>

          <p className="text-xs text-indigo-300 pt-2">
            Free trial includes 10 AI listings & full auto-delist protection. No credit card required.
          </p>
        </div>
      </section>

    </div>
  );
};

export default Home;

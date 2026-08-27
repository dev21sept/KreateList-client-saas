import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Globe, ShieldCheck, Clock } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-white border-t border-slate-100 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="col-span-1 md:col-span-1 space-y-6">
            <Link to="/" className="flex items-center">
              <img src="/logo.png" alt="Elister.ai" className="h-8 w-auto object-contain" />
            </Link>
            <p className="text-slate-500 text-sm leading-relaxed">
              Automating eBay listings for modern sellers. Scale your business with our AI-powered platform.
            </p>
            <div className="flex space-x-3">
              <span className="w-9 h-9 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                <Globe size={16} />
              </span>
              <span className="w-9 h-9 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                <ShieldCheck size={16} />
              </span>
              <span className="w-9 h-9 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                <Clock size={16} />
              </span>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 mb-6 text-sm tracking-tight">Product</h4>
            <ul className="space-y-3.5 text-sm text-slate-500 font-medium">
              <li><Link to="/features" className="hover:text-indigo-600 transition-colors">Features</Link></li>
              <li><Link to="/pricing" className="hover:text-indigo-600 transition-colors">Pricing</Link></li>
              <li><Link to="/listings" className="hover:text-indigo-600 transition-colors">Rule Engine</Link></li>
              <li><Link to="/signup" className="hover:text-indigo-600 transition-colors">Free Trial</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 mb-6 text-sm tracking-tight">Company</h4>
            <ul className="space-y-3.5 text-sm text-slate-500 font-medium">
              <li><Link to="/privacy-policy" className="hover:text-indigo-600 transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms-conditions" className="hover:text-indigo-600 transition-colors">Terms of Service</Link></li>
              <li><Link to="/refund-policy" className="hover:text-indigo-600 transition-colors">Refund Policy</Link></li>
              <li><Link to="/shipping-policy" className="hover:text-indigo-600 transition-colors">Shipping & Delivery Policy</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 mb-6 text-sm tracking-tight">Contact</h4>
            <ul className="space-y-3.5 text-sm text-slate-500 font-medium">
              <li>
                <a href="mailto:support@elister.ai" className="flex items-center gap-2 hover:text-indigo-600 transition-colors">
                  <Mail size={14} className="text-slate-400" /> support@elister.ai
                </a>
              </li>
              <li className="text-xs text-slate-400 italic">Response within 24 hours</li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center text-xs text-slate-400 gap-4">
          <p>
            © 2026{' '}
            <a href="https://www.elister.ai/" className="hover:text-indigo-600 transition-colors">
              Elister.ai
            </a>{' '}
            By Kreatelist Infotech Private Limited. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

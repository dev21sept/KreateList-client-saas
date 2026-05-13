import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Globe, Shield, Info } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-white border-t border-slate-100 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="col-span-1 md:col-span-1 space-y-6">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <span className="text-white font-bold text-lg">K</span>
              </div>
              <span className="text-xl font-bold text-slate-900 tracking-tight">KreateList</span>
            </Link>
            <p className="text-slate-500 text-sm leading-relaxed">
              Automating eBay listings for modern sellers. Scale your business with our AI-powered platform.
            </p>
            <div className="flex space-x-4">
              <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                <Globe size={18} />
              </div>
              <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                <Shield size={18} />
              </div>
              <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                <Info size={18} />
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 mb-6">Product</h4>
            <ul className="space-y-4 text-sm text-slate-500">
              <li><Link to="#features" className="hover:text-indigo-600 transition-colors">Features</Link></li>
              <li><Link to="#pricing" className="hover:text-indigo-600 transition-colors">Pricing</Link></li>
              <li><Link to="/listings" className="hover:text-indigo-600 transition-colors">Rule Engine</Link></li>
              <li><Link to="/signup" className="hover:text-indigo-600 transition-colors">Free Trial</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 mb-6">Company</h4>
            <ul className="space-y-4 text-sm text-slate-500">
              <li><a href="#" className="hover:text-indigo-600 transition-colors">About Us</a></li>
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Careers</a></li>
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Terms of Service</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 mb-6">Contact</h4>
            <ul className="space-y-4 text-sm text-slate-500">
              <li className="flex items-center text-xs"><Mail size={14} className="mr-2" /> support@kreatelist.com</li>
              <li className="text-xs italic">Response within 24 hours</li>
            </ul>
          </div>
        </div>
        
        <div className="pt-8 border-t border-slate-50 flex flex-col md:flex-row justify-between items-center text-xs text-slate-400 space-y-4 md:space-y-0">
          <p>© 2024 KreateList Inc. All rights reserved.</p>
          <div className="flex space-x-6">
            <a href="#" className="hover:text-slate-600 transition-colors">Cookies</a>
            <a href="#" className="hover:text-slate-600 transition-colors">Security</a>
            <a href="#" className="hover:text-slate-600 transition-colors">Sitemap</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Menu, X, ChevronRight } from 'lucide-react';

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Features', href: '/features', isHash: false },
    { name: 'Pricing', href: '/pricing', isHash: false },
    { name: 'Testimonials', href: '/testimonials', isHash: false },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-white/80 backdrop-blur-lg shadow-sm py-3'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <span className="text-white font-bold text-xl">K</span>
            </div>
            <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
              KreateList
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              link.isHash ? (
                <a
                  key={link.name}
                  href={link.href}
                  className="text-slate-600 hover:text-indigo-600 font-medium transition-colors"
                >
                  {link.name}
                </a>
              ) : (
                <Link
                  key={link.name}
                  to={link.href}
                  className="text-slate-600 hover:text-indigo-600 font-medium transition-colors"
                >
                  {link.name}
                </Link>
              )
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            <Link
              to="/login"
              className="text-slate-600 hover:text-indigo-600 font-medium px-4 py-2"
            >
              Log in
            </Link>
            <Link
              to="/signup"
              className="btn-primary flex items-center"
            >
              Get Started <ChevronRight className="ml-1 w-4 h-4" />
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-slate-600"
            >
              {isMobileMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden bg-white border-b border-slate-100 py-4 px-4 space-y-4"
        >
          {navLinks.map((link) => (
            link.isHash ? (
              <a
                key={link.name}
                href={link.href}
                className="block text-slate-600 hover:text-indigo-600 font-medium"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.name}
              </a>
            ) : (
              <Link
                key={link.name}
                to={link.href}
                className="block text-slate-600 hover:text-indigo-600 font-medium"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.name}
              </Link>
            )
          ))}
          <div className="pt-4 border-t border-slate-100 flex flex-col space-y-3">
            <Link
              to="/login"
              className="text-center text-slate-600 font-medium py-2"
            >
              Log in
            </Link>
            <Link
              to="/signup"
              className="btn-primary text-center"
            >
              Get Started
            </Link>
          </div>
        </motion.div>
      )}
    </nav>
  );
};

export default Navbar;

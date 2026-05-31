import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const NotificationContext = createContext(null);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

// Toast Component
const Toast = ({ id, message, type, onClose }) => {
  const [progress, setProgress] = useState(100);
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef(null);
  const startTimeRef = useRef(Date.now());
  const remainingTimeRef = useRef(4000); // 4 seconds default

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      onClose(id);
    }, remainingTimeRef.current);
  }, [id, onClose]);

  const pauseTimer = useCallback(() => {
    clearTimeout(timerRef.current);
    remainingTimeRef.current -= Date.now() - startTimeRef.current;
  }, []);

  useEffect(() => {
    startTimer();
    
    // Progress bar animation interval
    const progressInterval = setInterval(() => {
      if (!isHovered) {
        setProgress((prev) => {
          const step = (100 / 4000) * 50; // based on 50ms interval and 4000ms duration
          const next = prev - step;
          return next <= 0 ? 0 : next;
        });
      }
    }, 50);

    return () => {
      clearTimeout(timerRef.current);
      clearInterval(progressInterval);
    };
  }, [isHovered, startTimer]);

  const handleMouseEnter = () => {
    setIsHovered(true);
    pauseTimer();
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    startTimer();
  };

  // Icon mapping
  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-rose-500 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />;
      case 'info':
      default:
        return <Info className="w-5 h-5 text-indigo-500 shrink-0" />;
    }
  };

  // Color mapping
  const getStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-emerald-50/95 border-emerald-100 shadow-emerald-50';
      case 'error':
        return 'bg-rose-50/95 border-rose-100 shadow-rose-50';
      case 'warning':
        return 'bg-amber-50/95 border-amber-100 shadow-amber-50';
      case 'info':
      default:
        return 'bg-indigo-50/95 border-indigo-100 shadow-indigo-50';
    }
  };

  const getProgressBarColor = () => {
    switch (type) {
      case 'success':
        return 'bg-emerald-500';
      case 'error':
        return 'bg-rose-500';
      case 'warning':
        return 'bg-amber-500';
      case 'info':
      default:
        return 'bg-indigo-500';
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 100, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.9, transition: { duration: 0.2 } }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative w-80 p-4 rounded-2xl border backdrop-blur-md shadow-lg flex gap-3 items-start overflow-hidden pointer-events-auto ${getStyles()}`}
    >
      {getIcon()}
      <div className="flex-1 text-slate-800 text-xs font-semibold leading-relaxed pr-2 break-words">
        {message}
      </div>
      <button 
        onClick={() => onClose(id)}
        className="p-1 hover:bg-black/5 rounded-lg text-slate-400 hover:text-slate-600 transition-colors shrink-0"
      >
        <X size={14} />
      </button>

      {/* Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/5">
        <div 
          className={`h-full transition-all duration-75 ${getProgressBarColor()}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </motion.div>
  );
};

export const NotificationProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    message: '',
    resolve: null,
    options: {}
  });

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const toast = {
    success: useCallback((msg) => showToast(msg, 'success'), [showToast]),
    error: useCallback((msg) => showToast(msg, 'error'), [showToast]),
    warning: useCallback((msg) => showToast(msg, 'warning'), [showToast]),
    info: useCallback((msg) => showToast(msg, 'info'), [showToast]),
  };

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const confirm = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        message,
        resolve,
        options
      });
    });
  }, []);

  const handleConfirmClose = (choice) => {
    if (confirmState.resolve) {
      confirmState.resolve(choice);
    }
    setConfirmState({
      isOpen: false,
      message: '',
      resolve: null,
      options: {}
    });
  };

  // Global override for window.alert
  useEffect(() => {
    window.alert = (message) => {
      showToast(String(message), 'info');
    };
  }, [showToast]);

  return (
    <NotificationContext.Provider value={{ toast, confirm }}>
      {children}

      {/* Toast List Container */}
      <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence mode="pop-layout">
          {toasts.map((t) => (
            <Toast 
              key={t.id}
              id={t.id}
              message={t.message}
              type={t.type}
              onClose={removeToast}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmState.isOpen && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => handleConfirmClose(false)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            />
            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white p-6 rounded-[2rem] border border-slate-100 shadow-2xl max-w-sm w-full space-y-6 z-10 font-sans"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 border border-amber-100">
                  <AlertTriangle className="w-6 h-6 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-black text-slate-900">
                    {confirmState.options.title || 'Confirm Action'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    {confirmState.message}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handleConfirmClose(false)}
                  className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95"
                >
                  {confirmState.options.cancelText || 'Cancel'}
                </button>
                <button
                  onClick={() => handleConfirmClose(true)}
                  className={`flex-1 py-3 text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-lg ${
                    confirmState.options.destructive 
                      ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20' 
                      : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'
                  }`}
                >
                  {confirmState.options.confirmText || 'Confirm'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </NotificationContext.Provider>
  );
};

import React from 'react';
import CreateEtsyListing from '../pages/CreateEtsyListing';
import CreateEbayListing from '../pages/CreateEbayListing';
import CreatePoshmarkListing from '../pages/CreatePoshmarkListing';
import CreateDepopListing from '../pages/CreateDepopListing';

const CrosslistingModal = ({ isOpen, onClose, listing, platform, onSyncSuccess, isEditMode = false }) => {
  if (!isOpen || !listing || !platform) return null;

  const handleClose = () => {
    if (onSyncSuccess) onSyncSuccess();
    onClose();
  };

  const renderContent = () => {
    switch (platform) {
      case 'etsy':
        return (
          <CreateEtsyListing 
            isModal={true} 
            editId={listing._id || listing.id} 
            onClose={handleClose} 
          />
        );
      case 'ebay':
        return (
          <CreateEbayListing 
            isModal={true} 
            editId={listing._id || listing.id} 
            onClose={handleClose} 
          />
        );
      case 'poshmark':
        return (
          <CreatePoshmarkListing 
            isModal={true} 
            editId={listing._id || listing.id} 
            onClose={handleClose} 
          />
        );
      case 'depop':
        return (
          <CreateDepopListing 
            isModal={true} 
            editId={listing._id || listing.id} 
            onClose={handleClose} 
          />
        );
      default:
        return (
          <div className="p-8 text-center">
            <p className="text-slate-500 font-bold text-sm">Unsupported platform: {platform}</p>
            <button 
              onClick={onClose} 
              className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
            >
              Close
            </button>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0f172a]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-[94vw] max-h-[94vh] overflow-y-auto scrollbar-thin shadow-2xl flex flex-col p-6 border border-[#e2e8f0]">
        {renderContent()}
      </div>
    </div>
  );
};

export default CrosslistingModal;

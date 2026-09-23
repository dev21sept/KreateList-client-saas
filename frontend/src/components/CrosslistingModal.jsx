import React, { useEffect } from 'react';
import CreateMasterListing from '../pages/CreateMasterListing';

const CrosslistingModal = ({ isOpen, onClose, listing, platform, onSyncSuccess, isEditMode = false }) => {
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen || !listing) return null;

  const handleClose = () => {
    if (onSyncSuccess) onSyncSuccess();
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={handleClose}
    >
      <div 
        className="bg-white rounded-3xl w-full max-w-[96vw] xl:max-w-[1440px] max-h-[92vh] overflow-y-auto shadow-2xl p-4 sm:p-6 border border-slate-200 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <CreateMasterListing 
          isModal={true} 
          editId={listing._id || listing.id}
          initialListing={listing}
          initialPlatform={platform || listing.platform || 'ebay'}
          isEditMode={isEditMode || Boolean(listing._id || listing.id)}
          onClose={handleClose} 
          onSyncSuccess={onSyncSuccess}
        />
      </div>
    </div>
  );
};

export default CrosslistingModal;

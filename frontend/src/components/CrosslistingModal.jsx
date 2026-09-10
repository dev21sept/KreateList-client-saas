import React from 'react';
import CreateEtsyListing from '../pages/CreateEtsyListing';
import CreateEbayListing from '../pages/CreateEbayListing';
import CreatePoshmarkListing from '../pages/CreatePoshmarkListing';
// import CreateDepopListing from '../pages/CreateDepopListing';
import CreateMercariListing from '../pages/CreateMercariListing';
import CreateAmazonListing from '../pages/CreateAmazonListing';

const stripHtmlToText = (html) => {
  if (!html) return '';
  if (!/<[a-z][\s\S]*>/i.test(html)) return html;
  let text = html
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return text.replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
};

const mapToPoshmarkCondition = (raw) => {
  if (!raw) return 'Good';
  const str = String(raw).toLowerCase();
  if (str.includes('nwt') || str.includes('new with tag') || str.includes('brand new') || str === 'new' || str === '1000') {
    return 'NWT (New With Tags)';
  }
  if (str.includes('like new') || str.includes('excellent') || str.includes('mint') || str === '2750' || str === '3000') {
    return 'Like New';
  }
  if (str.includes('fair') || str.includes('poor') || str.includes('flaw') || str === '6000' || str === '7000') {
    return 'Fair';
  }
  return 'Good';
};

const mapToMercariCondition = (raw) => {
  if (!raw) return '3'; // Good
  const str = String(raw).toLowerCase();
  if (str.includes('nwt') || str.includes('new with tag') || str.includes('brand new') || str === 'new' || str === '1000' || str === '1') {
    return '1';
  }
  if (str.includes('like new') || str.includes('excellent') || str.includes('mint') || str === '2750' || str === '3000' || str === '2') {
    return '2';
  }
  if (str.includes('fair') || str === '6000' || str === '4') {
    return '4';
  }
  if (str.includes('poor') || str === '7000' || str === '5') {
    return '5';
  }
  return '3'; // Good
};

const mapToDepopCondition = (raw) => {
  if (!raw) return 'Used - Good';
  const str = String(raw).toLowerCase();
  if (str.includes('nwt') || str.includes('new with tag') || str.includes('brand new') || str === 'new' || str === '1000') {
    return 'Brand new';
  }
  if (str.includes('like new') || str.includes('mint') || str === '2750') {
    return 'Like new';
  }
  if (str.includes('excellent') || str === '3000') {
    return 'Used - Excellent';
  }
  if (str.includes('fair') || str.includes('poor') || str === '6000' || str === '7000') {
    return 'Used - Fair';
  }
  return 'Used - Good';
};

const CrosslistingModal = ({ isOpen, onClose, listing, platform, onSyncSuccess, isEditMode = false }) => {
  if (!isOpen || !listing || !platform) return null;

  const handleClose = () => {
    if (onSyncSuccess) onSyncSuccess();
    onClose();
  };

  const getPlatformSpecificListing = (plat) => {
    if (!listing) return null;
    const platData = listing.platformData?.[plat] || (listing.listingsMap?.[plat] ? listing.listingsMap[plat] : null) || {};

    const rawCondition = platData.condition || platData.selectedCondition || (listing.platform === plat ? (listing.selectedCondition || listing.condition) : (listing.selectedCondition || listing.condition || ''));
    
    let resolvedCondition = rawCondition;
    if (plat === 'poshmark') {
      resolvedCondition = mapToPoshmarkCondition(rawCondition);
    } else if (plat === 'mercari') {
      resolvedCondition = mapToMercariCondition(rawCondition);
    } else if (plat === 'depop') {
      resolvedCondition = mapToDepopCondition(rawCondition);
    }

    // Description: if converting for a non-eBay platform and only eBay HTML exists, strip HTML
    let resolvedDesc = platData.description || (listing.platform === plat ? listing.description : '');
    if (!resolvedDesc && listing.description) {
      resolvedDesc = plat === 'ebay' ? listing.description : stripHtmlToText(listing.description);
    } else if (resolvedDesc && plat !== 'ebay') {
      resolvedDesc = stripHtmlToText(resolvedDesc);
    }

    // Category: only take category if from same platform or platData
    const resolvedCategory = platData.category || (listing.platform === plat ? listing.category : '');
    const resolvedCategoryId = platData.categoryId || (listing.platform === plat ? listing.categoryId : '');

    return {
      ...listing,
      ...platData,
      title: platData.title || listing.title,
      description: resolvedDesc,
      price: platData.price !== undefined && platData.price !== null ? platData.price : listing.price,
      originalPrice: platData.originalPrice || (listing.platform === plat ? listing.originalPrice : ''),
      brand: platData.brand || listing.brand || '',
      size: platData.size || listing.size || '',
      color: platData.color || listing.color || '',
      category: resolvedCategory,
      categoryId: resolvedCategoryId,
      departmentId: platData.departmentId || '',
      subcategoryIds: platData.subcategoryIds || [],
      selectedCondition: resolvedCondition,
      condition: resolvedCondition,
      conditionId: platData.conditionId || '',
      itemSpecifics: plat === 'ebay' ? (platData.itemSpecifics || (listing.platform === 'ebay' ? listing.itemSpecifics : {})) : (platData.itemSpecifics || {}),
      images: (platData.images && platData.images.length > 0) ? platData.images : listing.images,
      thumbnail: platData.thumbnail || listing.thumbnail
    };
  };

  const renderContent = () => {
    const targetListing = getPlatformSpecificListing(platform);

    switch (platform) {
      case 'etsy':
        return (
          <CreateEtsyListing 
            isModal={true} 
            editId={targetListing._id || targetListing.id}
            initialListing={targetListing}
            onClose={handleClose} 
          />
        );
      case 'ebay':
        return (
          <CreateEbayListing 
            isModal={true} 
            editId={targetListing._id || targetListing.id}
            initialListing={targetListing}
            onClose={handleClose} 
          />
        );
      case 'poshmark':
        return (
          <CreatePoshmarkListing 
            isModal={true} 
            editId={targetListing._id || targetListing.id}
            initialListing={targetListing}
            onClose={handleClose} 
          />
        );
      /* case 'depop':
        return (
          <CreateDepopListing 
            isModal={true} 
            editId={targetListing._id || targetListing.id}
            initialListing={targetListing}
            onClose={handleClose} 
          />
        ); */
      case 'mercari':
        return (
          <CreateMercariListing 
            isModal={true} 
            editId={targetListing._id || targetListing.id}
            initialListing={targetListing}
            onClose={handleClose} 
          />
        );
      case 'amazon':
        return (
          <CreateAmazonListing 
            isModal={true} 
            editId={targetListing._id || targetListing.id}
            initialListing={targetListing}
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

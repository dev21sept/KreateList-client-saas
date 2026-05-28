import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { listingService } from '../services/api';
import { Loader2 } from 'lucide-react';

const CreateListing = () => {
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const queryPlatform = searchParams.get('platform');
  const navigate = useNavigate();

  useEffect(() => {
    if (editId) {
      listingService.getOne(editId)
        .then(res => {
          if (res.data.success) {
            const platform = res.data.data.platform || 'ebay';
            navigate(`/create-${platform}-listing?edit=${editId}`, { replace: true });
          } else {
            navigate('/create-ebay-listing', { replace: true });
          }
        })
        .catch(() => {
          navigate('/create-ebay-listing', { replace: true });
        });
    } else {
      const targetPlatform = queryPlatform === 'poshmark' ? 'poshmark' : 'ebay';
      navigate(`/create-${targetPlatform}-listing`, { replace: true });
    }
  }, [editId, queryPlatform, navigate]);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-4" />
        <p className="text-slate-500 text-sm font-semibold">Loading listing page...</p>
      </div>
    </div>
  );
};

export default CreateListing;

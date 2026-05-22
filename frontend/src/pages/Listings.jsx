import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  MoreVertical, 
  ExternalLink, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Download,
  Trash2,
  Edit
} from 'lucide-react';
import { listingService } from '../services/api';

const Listings = () => {
  const navigate = useNavigate();
  const [selectedListings, setSelectedListings] = useState([]);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchListings();
  }, []);

  const fetchListings = async () => {
    try {
      const [listingsRes, statsRes] = await Promise.all([
        listingService.getAll(),
        listingService.getStats()
      ]);
      setListings(listingsRes.data.data);
      setStats(statsRes.data.data.stats);
    } catch (error) {
      console.error("Error fetching listings:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'published':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100"><CheckCircle2 size={12} className="mr-1" /> Published</span>;
      case 'draft':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-50 text-slate-600 border border-slate-200"><Clock size={12} className="mr-1" /> Draft</span>;
      case 'scheduled':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-600 border border-amber-100"><Clock size={12} className="mr-1" /> Scheduled</span>;
      case 'failed':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-600 border border-rose-100"><AlertCircle size={12} className="mr-1" /> Failed</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Listings</h1>
          <p className="text-slate-500">Manage and track your eBay inventory.</p>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={() => navigate('/create-listing')}
            className="btn-primary"
          >
            Create Listing
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by title, eBay ID..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
          />
        </div>
        <div className="flex space-x-2 w-full md:w-auto">
          <button className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-all flex items-center shrink-0">
            <Filter size={16} className="mr-2" /> Status
          </button>
          <button className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-all flex items-center shrink-0">
            Category
          </button>
        </div>
      </div>

      {/* Listings Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4">
                  <input type="checkbox" className="rounded text-indigo-600" />
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Product</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">eBay ID</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Price</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-10 text-center text-slate-400">Loading listings...</td>
                </tr>
              ) : listings.length > 0 ? (
                listings.map((listing) => (
                  <tr key={listing._id} className="hover:bg-slate-50/50 transition-all group">
                    <td className="px-6 py-4">
                      <input type="checkbox" className="rounded text-indigo-600" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-lg shrink-0 overflow-hidden">
                          {listing.images && listing.images[0] && (
                            <img src={listing.images[0]} alt="" className="w-full h-full object-cover" />
                          )}
                        </div>
                        <span className="font-bold text-slate-900 text-sm line-clamp-1">{listing.title}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(listing.status)}</td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">{listing.ebayListingId || '-'}</td>
                    <td className="px-6 py-4 font-bold text-slate-900 text-sm">
                      ${(typeof listing.price === 'number' ? listing.price : parseFloat(listing.price) || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">{new Date(listing.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-2">
                        <button className="p-2 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-slate-400 transition-all"><Edit size={16} /></button>
                        {listing.ebayUrl && (
                          <a href={listing.ebayUrl} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-slate-100 hover:text-slate-900 rounded-lg text-slate-400 transition-all">
                            <ExternalLink size={16} />
                          </a>
                        )}
                        <button className="p-2 hover:bg-rose-50 hover:text-rose-600 rounded-lg text-slate-400 transition-all"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-6 py-10 text-center text-slate-400">No listings found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs font-bold text-slate-500 uppercase">Showing {listings.length} of {stats?.total || 0} listings</p>
          <div className="flex space-x-2">
            <button className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold disabled:opacity-50">Prev</button>
            <button className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold hover:bg-slate-100">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Listings;

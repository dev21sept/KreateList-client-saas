import React, { useState } from 'react';
import { Search, ChevronDown, Calendar, ShoppingBag, DollarSign, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

const MOCK_ORDERS = [
  {
    id: "ORD-9982",
    item: "Nike Air Max 90 White Men's Size 10",
    platform: "ebay",
    buyer: "Alice Johnson",
    price: 110.00,
    status: "Shipped",
    date: "2026-07-02",
    logo: "/ebay.png"
  },
  {
    id: "ORD-9983",
    item: "Vintage Levi's Denim Jacket Large",
    platform: "poshmark",
    buyer: "David Miller",
    price: 75.00,
    status: "Pending",
    date: "2026-07-03",
    logo: "/poshmark.png"
  },
  {
    id: "ORD-9984",
    item: "Apple AirPods Pro 2nd Gen",
    platform: "depop",
    buyer: "Emma Stone",
    price: 180.00,
    status: "Delivered",
    date: "2026-07-04",
    logo: "/depop.png"
  }
];

const Orders = () => {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      
      {/* STATS BANNER */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-[#f1f3f9] shadow-sm flex flex-col justify-between h-32">
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Sales</span>
          <div>
            <p className="text-2xl font-black text-[#111827] mt-1">$365.00</p>
            <p className="text-[10px] text-emerald-600 font-extrabold mt-1">↑ 14% vs last week</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-[#f1f3f9] shadow-sm flex flex-col justify-between h-32">
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Orders Received</span>
          <div>
            <p className="text-2xl font-black text-[#111827] mt-1">3</p>
            <p className="text-[10px] text-emerald-600 font-extrabold mt-1">↑ 8% vs last week</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-[#f1f3f9] shadow-sm flex flex-col justify-between h-32">
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Awaiting Shipment</span>
          <div>
            <p className="text-2xl font-black text-[#111827] mt-1">1</p>
            <p className="text-[10px] text-amber-500 font-extrabold mt-1">Action required</p>
          </div>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white p-4 rounded-3xl border border-[#f1f3f9] shadow-sm flex flex-col sm:flex-row items-center gap-4">
        <div className="relative flex-grow w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
          <input 
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search orders..."
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
          />
        </div>
        <button className="flex items-center gap-2 pl-4 pr-10 py-2.5 bg-white border border-[#e5e7eb] rounded-2xl text-xs font-bold text-slate-750 relative w-full sm:w-auto shrink-0">
          Filter: All Status
          <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* ORDERS LIST */}
      <div className="bg-white rounded-3xl border border-[#f1f3f9] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#fcfcff] border-b border-[#f3f4f6]">
                <th className="px-6 py-4.5 text-xs font-black text-slate-400 uppercase tracking-wider">Order ID</th>
                <th className="px-6 py-4.5 text-xs font-black text-slate-400 uppercase tracking-wider">Item Purchased</th>
                <th className="px-6 py-4.5 text-xs font-black text-slate-400 uppercase tracking-wider">Platform</th>
                <th className="px-6 py-4.5 text-xs font-black text-slate-400 uppercase tracking-wider">Buyer</th>
                <th className="px-6 py-4.5 text-xs font-black text-slate-400 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-4.5 text-xs font-black text-slate-400 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4.5 text-xs font-black text-slate-400 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f8fafc]">
              {MOCK_ORDERS.filter(o => o.item.toLowerCase().includes(searchTerm.toLowerCase())).map((order) => (
                <tr key={order.id} className="hover:bg-[#fafbfe]/40 transition-colors">
                  <td className="px-6 py-4.5 font-mono text-xs font-bold text-slate-700">{order.id}</td>
                  <td className="px-6 py-4.5 font-extrabold text-slate-800 text-xs">{order.item}</td>
                  <td className="px-6 py-4.5">
                    <div className="flex items-center gap-2">
                      <img src={order.logo} className="w-5 h-5 object-contain" alt="" />
                      <span className="text-xs font-bold text-slate-600 capitalize">{order.platform}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4.5 text-xs font-bold text-slate-700">{order.buyer}</td>
                  <td className="px-6 py-4.5 font-black text-slate-800 text-xs">${order.price.toFixed(2)}</td>
                  <td className="px-6 py-4.5 text-xs text-slate-400 font-semibold">{order.date}</td>
                  <td className="px-6 py-4.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                      order.status === 'Delivered' ? 'bg-emerald-50 text-emerald-600' :
                      order.status === 'Pending' ? 'bg-amber-50 text-amber-500' : 'bg-blue-50 text-blue-600'
                    }`}>
                      {order.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default Orders;

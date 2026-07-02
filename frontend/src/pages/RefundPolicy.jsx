import React from 'react';

const RefundPolicy = () => {
  return (
    <div className="bg-gray-50 min-h-screen pt-28 pb-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm p-8 md:p-12">
          {/* Header */}
          <div className="mb-8 border-b pb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Refunds & Cancellations Policies</h1>
            <p className="text-gray-600">Last updated: {new Date().toLocaleDateString()}</p>
          </div>

          <div className="space-y-6 text-gray-700 leading-relaxed">
            <p>
              Here are the Refunds and Cancellations Policies to use the Elister By Kreatelist Infotech Private Limited Platform:
            </p>

            {/* Satisfaction Guarantee */}
            <div className="bg-indigo-50 border-l-4 border-indigo-500 p-6 my-6 rounded-r-lg">
              <h2 className="text-xl font-semibold text-indigo-900 mb-2">7-Day Money-Back Guarantee</h2>
              <p className="text-indigo-800">
                If you are not fully satisfied with Elister for any reason, you can request a full refund of your initial subscription fee within <strong>7 days</strong> of purchase.
              </p>
            </div>

            {/* Subscription Plans & Billing Policy */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-900">Subscription Plans & Billing</h2>
              <p>
                Elister operates on a monthly or yearly recurring billing cycle. The plans and pricing are structured as follows:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
                <div className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm">
                  <h3 className="font-bold text-gray-900 text-md">BASIC Plan</h3>
                  <p className="text-indigo-600 font-black text-xl my-1">$79<span className="text-gray-400 text-xs font-normal">/mo</span></p>
                  <ul className="text-xs text-gray-500 space-y-1 mt-2">
                    <li>• 500 AI Listings / month</li>
                    <li>• 1 eBay Account</li>
                  </ul>
                </div>
                <div className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm border-indigo-200 ring-1 ring-indigo-500/10">
                  <h3 className="font-bold text-gray-900 text-md">PRO Plan</h3>
                  <p className="text-indigo-600 font-black text-xl my-1">$149<span className="text-gray-400 text-xs font-normal">/mo</span></p>
                  <ul className="text-xs text-gray-500 space-y-1 mt-2">
                    <li>• 3,000 AI Listings / month</li>
                    <li>• 5 eBay Accounts</li>
                  </ul>
                </div>
                <div className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm">
                  <h3 className="font-bold text-gray-900 text-md">ENTERPRISE Plan</h3>
                  <p className="text-indigo-600 font-black text-xl my-1">$299<span className="text-gray-400 text-xs font-normal">/mo</span></p>
                  <ul className="text-xs text-gray-500 space-y-1 mt-2">
                    <li>• 10,000 AI Listings / month</li>
                    <li>• Unlimited eBay Accounts</li>
                  </ul>
                </div>
              </div>
            </div>

            <hr className="my-8 border-gray-200" />

            {/* Refund & Cancellation Conditions */}
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Refund & Cancellation Policy</h2>

            <div className="space-y-6">
              {/* Cancellation */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-2">Subscription Cancellation</h3>
                <p className="text-gray-600 text-sm">
                  You can cancel your subscription at any time through your Account Billing dashboard. 
                  On cancellation, your subscription will remain active, and you will retain full access to all features and listing tools, until the end of your current billing period. 
                  No future recurring charges will be made.
                </p>
              </div>

              {/* Refund Policy */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-2">Refund Policy</h3>
                <ul className="list-disc pl-5 space-y-2 text-gray-600 text-sm">
                  <li>
                    Refunds are only eligible within the first <strong>7 days</strong> of your very first subscription purchase.
                  </li>
                  <li>
                    Subsequent renewals or upgrades/downgrades are non-refundable.
                  </li>
                  <li>
                    Refunded amounts will be processed back to your original payment method (Stripe, Razorpay, or Cards) in <strong>5 to 7 working days</strong>.
                  </li>
                  <li className="text-rose-600 font-medium">
                    No partial refunds or pro-rated credits are provided for unused portions of the monthly or yearly billing cycles.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RefundPolicy;

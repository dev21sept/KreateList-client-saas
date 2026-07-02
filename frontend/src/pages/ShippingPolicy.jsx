import React from 'react';

const ShippingPolicy = () => {
  return (
    <div className="bg-gray-50 min-h-screen pt-28 pb-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm p-8 md:p-12">
          {/* Header */}
          <div className="mb-8 border-b pb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Shipping & Delivery Policies</h1>
            <p className="text-gray-600">Last updated: {new Date().toLocaleDateString()}</p>
          </div>

          <div className="space-y-6 text-gray-700 leading-relaxed">
            <p>
              Here are the Shipping and Delivery Policies to use the Elister By Kreatelist Infotech Private Limited Platform:
            </p>

            <div className="bg-indigo-50 border-l-4 border-indigo-500 p-6 my-6 rounded-r-lg">
              <h2 className="text-xl font-semibold text-indigo-900 mb-2">Instant Digital Delivery</h2>
              <p className="text-indigo-800">
                Elister is a SaaS (Software-as-a-Service) platform. All features, tools, and subscription plans are delivered digitally. There are no physical shipping requirements.
              </p>
            </div>

            <hr className="my-8 border-gray-200" />

            {/* Services Detailed List */}
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Service Provisioning & Access</h2>

            <div className="space-y-6">
              {/* Account Provisioning */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-2">Instant Account Setup</h3>
                <p className="text-gray-600 text-sm">
                  Upon payment confirmation for any of our subscription plans (BASIC, PRO, or ENTERPRISE), your account features are provisioned and unlocked <strong>instantly</strong>. You will receive immediate access to connect your channels and begin listing.
                </p>
              </div>

              {/* Data Sync & API Timelines */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-2">AI Optimization & Publishing Timelines</h3>
                <ul className="list-disc pl-5 space-y-2 text-gray-600 text-sm">
                  <li>
                    <strong>AI Optimizations:</strong> Generated within <strong>seconds</strong> directly in your browser.
                  </li>
                  <li>
                    <strong>Channel Sync & Imports:</strong> Triggered immediately and completed in the background within a few minutes depending on platform queue sizes.
                  </li>
                </ul>
              </div>

              {/* Support SLA by Tiers */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Support & Service Delivery SLAs</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="font-bold text-sm text-gray-800">BASIC Plan Support</span>
                    <span className="text-xs text-gray-500 font-semibold">24 - 48 Hours Email Response</span>
                  </div>
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="font-bold text-sm text-gray-800">PRO Plan Support</span>
                    <span className="text-xs text-gray-500 font-semibold">12 - 24 Hours Priority Support</span>
                  </div>
                  <div className="flex justify-between items-center pb-1">
                    <span className="font-bold text-sm text-gray-800">ENTERPRISE Plan Support</span>
                    <span className="text-xs text-gray-500 font-semibold">24/7 Dedicated Account Manager Support</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShippingPolicy;

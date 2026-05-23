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
              Here are the Refunds and Cancellations Policies to use the Elister By I & B Platform:
            </p>

            {/* Satisfaction Guarantee */}
            <div className="bg-indigo-50 border-l-4 border-indigo-500 p-6 my-6 rounded-r-lg">
              <h2 className="text-xl font-semibold text-indigo-900 mb-2">Satisfaction Guarantee</h2>
              <p className="text-indigo-800">
                If you are not fully satisfied with the quality of our work for whatever reason, we will refund the initial deposit.
              </p>
            </div>

            {/* Wallet Policy */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-900">Wallet Refunds</h2>
              <p>
                For Services there will be initial refunds possible under the following conditions:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  Wallet amount can be initially refunded in <strong>7 working days</strong>.
                </li>
                <li>
                  <span className="text-rose-600 font-semibold">*Please Note:</span> Referral and Bonus Credits are non-refundable and excluded from wallet refunds.
                </li>
              </ul>
            </div>

            <hr className="my-8 border-gray-200" />

            {/* Services Detailed List */}
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Refund Conditions by Service Type</h2>

            <div className="space-y-6">
              {/* Listing/Posting */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4 gap-2">
                  <h3 className="text-lg font-bold text-gray-900">Listing / Posting Services</h3>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-indigo-100 text-indigo-800 self-start">
                    $1.00 Per Item
                  </span>
                </div>
                <ul className="list-disc pl-5 space-y-2 text-gray-600">
                  <li>
                    Refunds are only possible when an item is in <strong className="text-gray-900">New</strong> status.
                  </li>
                  <li>
                    The user can delete the item in <strong className="text-gray-900">New</strong> status, and it will be fully refunded in the next <strong>7 working days</strong> back into the user wallet.
                  </li>
                  <li className="text-rose-600 font-medium">
                    No refund will be initiated for items in <strong>Submitted</strong>, <strong>Drafted</strong>, or <strong>Listed</strong> status. The user will not be able to delete these items.
                  </li>
                </ul>
              </div>

              {/* Cross-listing */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4 gap-2">
                  <h3 className="text-lg font-bold text-gray-900">Cross-listing / Cross-posting</h3>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-indigo-100 text-indigo-800 self-start">
                    $0.50 Per Item / Platform (Except eBay)
                  </span>
                </div>
                <ul className="list-disc pl-5 space-y-2 text-gray-600">
                  <li>
                    Refunds are only possible when an item is in <strong className="text-gray-900">New</strong> status.
                  </li>
                  <li>
                    The user can delete the item in <strong className="text-gray-900">New</strong> status, and it will be fully refunded in the next <strong>7 working days</strong> back into the user wallet.
                  </li>
                  <li className="text-rose-600 font-medium">
                    No refund will be initiated for items in <strong>Submitted</strong>, <strong>Drafted</strong>, or <strong>Listed</strong> status. The user will not be able to delete these items.
                  </li>
                </ul>
              </div>

              {/* Amazon FBA */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4 gap-2">
                  <h3 className="text-lg font-bold text-gray-900">Amazon FBA & Account Management</h3>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-indigo-100 text-indigo-800 self-start">
                    $10.00 Per Hour
                  </span>
                </div>
                <ul className="list-disc pl-5 space-y-2 text-gray-600">
                  <li>
                    A <strong>50% refund</strong> of the remaining service package will be possible upon service cancellation.
                  </li>
                  <li>
                    Refunded amounts will be processed in the next <strong>7 working days</strong> directly into the customer's bank account or PayPal account.
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

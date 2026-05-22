import React from 'react';

const ShippingPolicy = () => {
  return (
    <div className="bg-gray-50 min-h-screen py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm p-8 md:p-12">
          {/* Header */}
          <div className="mb-8 border-b pb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Shipping & Delivery Policies</h1>
            <p className="text-gray-600">Last updated: {new Date().toLocaleDateString()}</p>
          </div>

          <div className="space-y-6 text-gray-700 leading-relaxed">
            <p>
              Here are the Shipping and Delivery Policies to use the KreateList Platform:
            </p>

            <div className="bg-indigo-50 border-l-4 border-indigo-500 p-6 my-6 rounded-r-lg">
              <h2 className="text-xl font-semibold text-indigo-900 mb-2">Service Delivery Timelines</h2>
              <p className="text-indigo-800">
                Timelines for delivering our listing and management services to our platform users.
              </p>
            </div>

            <hr className="my-8 border-gray-200" />

            {/* Services Detailed List */}
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Delivery Timelines by Service Type</h2>

            <div className="space-y-6">
              {/* Listing/Posting */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4 gap-2">
                  <h3 className="text-lg font-bold text-gray-900">Listing / Posting Services</h3>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-indigo-100 text-indigo-800 self-start">
                    $1.00 Per Item
                  </span>
                </div>
                <div className="space-y-2 text-gray-600">
                  <p>
                    Delivery window: It can be up to <strong>48 Hours</strong> time to Draft or List the items.
                  </p>
                  <p className="text-sm italic text-gray-500">
                    *Working days except for Sundays, Festivals, and National Holidays.
                  </p>
                </div>
              </div>

              {/* Cross-listing */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4 gap-2">
                  <h3 className="text-lg font-bold text-gray-900">Cross-listing / Cross-posting</h3>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-indigo-100 text-indigo-800 self-start">
                    $0.50 Per Item
                  </span>
                </div>
                <div className="space-y-2 text-gray-600">
                  <p>
                    Delivery window: It can take up to <strong>48 Hours</strong> time to Draft or List the items.
                  </p>
                  <p className="text-sm italic text-gray-500">
                    *Working days except for Sundays, Festivals, and National Holidays.
                  </p>
                </div>
              </div>

              {/* Amazon FBA */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4 gap-2">
                  <h3 className="text-lg font-bold text-gray-900">Amazon FBA & Account Management</h3>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-indigo-100 text-indigo-800 self-start">
                    $10.00 Per Hour
                  </span>
                </div>
                <div className="space-y-2 text-gray-600">
                  <p>
                    Delivery window: It can take up to <strong>7 working days</strong> to start the accounting task.
                  </p>
                  <p className="text-sm italic text-gray-500">
                    *Working days except for Sundays, Festivals, and National Holidays.
                  </p>
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

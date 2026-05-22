import React from 'react';

const TermsConditions = () => {
  return (
    <div className="bg-gray-50 min-h-screen py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm p-8 md:p-12">
          <div className="mb-8 border-b pb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">User Terms & Conditions</h1>
            <p className="text-gray-600">Last updated: {new Date().toLocaleDateString()}</p>
          </div>

          <div className="space-y-6 text-gray-700 leading-relaxed">
            <p>
              These terms and conditions are a type of contract between You (As User) and <strong>KreateList Infotech Private Limited</strong> (Service Provider Company) to access the Website or Web Application or Mobile Application (Android and IOS Both) of KreateList.
            </p>

            <div className="bg-indigo-50 border-l-4 border-indigo-500 p-4 my-6">
              <p className="font-medium text-indigo-900">
                By Agree Submission in Sign Up with the terms and conditions you are agreeing that you have read, understood, and agreed to all the conditions written below:
              </p>
            </div>

            <ul className="list-disc pl-5 space-y-6">
              <li>
                <span className="font-semibold text-gray-900">1. Service Scope:</span> I have chosen KreateList to automate and scale my eBay listing process. I understand the platform provides tools like the Smart Rule Engine, eBay Taxonomy Category Lookup, AI Listing Optimizer, and Bulk Publishing features.
              </li>
              
              <li>
                <span className="font-semibold text-gray-900">2. Pricing & Subscription Plans:</span> I have understood the pricing model and agree to pay the subscription price prior to using the platform. KreateList operates on a monthly or yearly subscription basis (with a 5% discount on annual billing):
                <ul className="list-circle pl-5 mt-3 space-y-2 text-gray-600">
                  <li><strong>BASIC Plan ($79/mo):</strong> Includes up to 500 AI Listings per month and support for 1 eBay Account.</li>
                  <li><strong>PRO Plan ($149/mo):</strong> Includes up to 3,000 AI Listings per month and support for 5 eBay Accounts.</li>
                  <li><strong>ENTERPRISE Plan ($299/mo):</strong> Includes up to 10,000 AI Listings per month and support for Unlimited eBay Accounts.</li>
                </ul>
              </li>

              <li>
                <span className="font-semibold text-gray-900">3. Billing & Payments:</span>
                <ul className="list-circle pl-5 mt-2 space-y-2 text-gray-600">
                  <li>Subscriptions are billed in advance on a monthly or annual cycle depending on my selection.</li>
                  <li>I am responsible for maintaining an active payment method to avoid service interruption.</li>
                </ul>
              </li>

              <li>
                <span className="font-semibold text-gray-900">4. User Information & Privacy:</span> I am sharing my contact info with KreateList as accurately as my government documents and KreateList can use the info to contact me regarding my account or subscription.
              </li>
              
              <li>
                <span className="font-semibold text-gray-900">5. Account Restriction:</span> I am creating an account with KreateList and the company reserves the right to restrict or terminate my account at any point in time in case of negligence, unauthorized use of eBay integrations, or violation of any term or condition.
              </li>
              
              <li>
                <span className="font-semibold text-gray-900">6. Intellectual Property:</span> I will not use, copy, reverse engineer, or replicate the same business idea, features (like Rule Engine, AI Optimizer, Taxonomy API), or software logic of KreateList at any point.
              </li>
            </ul>

            <div className="mt-8 p-4 bg-rose-50 border-l-4 border-rose-500 rounded-r-lg">
              <p className="text-rose-800 font-medium">
                **If I commit any negligence of Company Norms or Intellectual Property theft, the Company (KreateList Infotech Private Limited) can take legal action against me.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsConditions;

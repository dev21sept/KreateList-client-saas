import React from 'react';

const PrivacyPolicy = () => {
  return (
    <div className="bg-gray-50 min-h-screen py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm p-8 md:p-12">
          <div className="mb-8 border-b pb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">User Data Security & Policy</h1>
            <p className="text-gray-600">Last updated: {new Date().toLocaleDateString()}</p>
          </div>

          <div className="space-y-6 text-gray-700 leading-relaxed">
            <p>
              As a Company we promise the following data privacy and security terms:
            </p>

            <ul className="list-disc pl-5 space-y-3">
              <li>We will not use your account information for anyone else.</li>
              <li>We will not pass or share your personal information and data with anyone else.</li>
              <li>We will not use your account for any transaction on our end. All the transactions will be authorized by the user itself.</li>
              <li>On account cancellation, we will block all transactions on your account.</li>
              <li>We will not do any unauthorized transactions with your payment methods.</li>
              <li>We will do transactions with the authorized methods (Razorpay, Paypal, or Cards).</li>
              <li>We will not deduct any of the amounts after the cancellation of the Subscription.</li>
              <li>User can delete their account and we will delete all the user info on our end.</li>
              <li>On the negligence of Terms & Conditions company can delete the user account and Data.</li>
              <li>If your account does not have any activity in 3 months, your account will be deactivated from our system and you can reactivate it. For reactivation you have to send an email to "admin@kreatelist.com".</li>
            </ul>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Approval To Use Software & Security Policy</h2>
            <p>
              The Company allows the nonexclusive use of the software in relation to the Service (hereinafter referred to as the “Software” and includes software that is newly provided due to future upgrades) provided by the Company for users who download the Software for the use of the Service under the condition that the user abides by the Terms and Conditions. The copyright to the Software and any associated rights will belong to the Company.
            </p>
            <p>
              The Company cannot guarantee that the Software is free of any actual or legal defects (including but not limited to stability, reliability, accuracy, completeness, validity, suitability for a specific purpose, security-related defects, errors, or bugs, infringement of rights, etc.).
            </p>

            <div className="bg-indigo-50 border-l-4 border-indigo-500 p-4 my-6">
              <p className="font-medium text-indigo-900">
                The user must not conduct the following actions when using the Software unless the user has separately obtained evident approval from the Company:
              </p>
            </div>

            <ul className="list-disc pl-5 space-y-3">
              <li>Copy the whole or part of the Software.</li>
              <li>Modify the whole or part of the Software’s features, text, and/or program source code.</li>
              <li>Disassemble or decompile the whole or part of the Software, or attempt to decipher the whole or part of the Software.</li>
              <li>Assign, lend or licence the Software to a third party.</li>
              <li>Use the Software for advertising, commercial purposes, or solicitation.</li>
              <li>Violate a law, judgement, judicial ruling, court order, or binding regulation.</li>
              <li>Violate the rights of the Company or of any third party (including, copyright, trademark, patent, or similar intellectual property rights, right of reputation, right to privacy, or any other right arising at law or by contract).</li>
              <li>Interfere with or obstruct the Company’s operation of the Service or other users’ use of the Service.</li>
              <li>Aid or encourage any of the actions mentioned above.</li>
              <li>Any other use of the Service that the Company deems inappropriate.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
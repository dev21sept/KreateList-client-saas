const AffiliateProfile = require('../models/AffiliateProfile');
const AffiliateCommission = require('../models/AffiliateCommission');
const User = require('../models/User');

const COMMISSION_RATE = 0.10;

/**
 * Generates a short, unique, URL-safe code from the affiliate's own name plus a random number -
 * always, not just on a collision. A bare name (e.g. "RAMAYALI") is easy to guess from the person's
 * name alone, which anyone could then try typing in at signup to self-attribute a referral that
 * never actually went through that affiliate's link.
 */
async function generateAffiliateCode(user) {
  const base = (user.firstName || user.email.split('@')[0] || 'AFF')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8) || 'AFF';
  for (let attempt = 0; attempt < 20; attempt++) {
    const suffix = String(Math.floor(100 + Math.random() * 900));
    const candidate = `${base}${suffix}`;
    const exists = await AffiliateProfile.findOne({ code: candidate });
    if (!exists) return candidate;
  }
  // Fallback: astronomically unlikely to be reached given the loop above, but never leave this unhandled.
  return `${base}${Date.now().toString().slice(-6)}`;
}

/**
 * Records which affiliate code a brand-new user signed up through. Called once, at registration -
 * never overwritten afterward (first-click-wins attribution, no separate click-tracking table for
 * this MVP since attribution only needs to survive from signup-page-visit to the same signup form
 * submission, not a multi-day window).
 */
async function attributeSignup(newUser, rawCode) {
  if (!rawCode) return;
  const code = String(rawCode).trim().toUpperCase();
  if (!code) return;

  const affiliate = await AffiliateProfile.findOne({ code, status: 'approved' });
  if (!affiliate) return; // invalid/unapproved code: signup proceeds normally, just unattributed

  // Self-referral guard, per the guide's fraud-prevention rule.
  if (String(affiliate.user) === String(newUser._id)) return;

  newUser.referredByAffiliateCode = code;
  await newUser.save();
}

/**
 * Records one commission ledger entry for a qualifying payment, if the paying user was referred by
 * an approved affiliate. Safe to call on every successful payment webhook (Stripe checkout, Razorpay
 * verify, subscription renewals) - the unique (affiliate, sourceRef) index makes a webhook retry a
 * no-op instead of a duplicate credit.
 */
async function recordCommission({ userId, plan, paymentAmount, currency = 'usd', sourceRef }) {
  if (!paymentAmount || paymentAmount <= 0 || !sourceRef) return null;

  const user = await User.findById(userId).select('firstName lastName email referredByAffiliateCode');
  if (!user?.referredByAffiliateCode) return null;

  const affiliate = await AffiliateProfile.findOne({ code: user.referredByAffiliateCode, status: 'approved' });
  if (!affiliate) return null;

  const commissionAmount = Math.round(paymentAmount * COMMISSION_RATE * 100) / 100;
  const referredUserName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;

  try {
    const entry = await AffiliateCommission.create({
      affiliate: affiliate._id,
      affiliateUser: affiliate.user,
      referredUser: user._id,
      referredUserName,
      referredUserEmail: user.email,
      plan,
      paymentAmount,
      commissionRate: COMMISSION_RATE,
      commissionAmount,
      currency,
      sourceRef
    });

    await AffiliateProfile.updateOne(
      { _id: affiliate._id },
      { $inc: { totalCommissionEarned: commissionAmount } }
    );
    // totalReferred counts distinct referredUser values, not commission entries (one user can renew
    // and earn multiple entries) - recomputed here rather than $inc'd to stay correct on retries.
    const distinctReferred = await AffiliateCommission.distinct('referredUser', { affiliate: affiliate._id });
    await AffiliateProfile.updateOne({ _id: affiliate._id }, { $set: { totalReferred: distinctReferred.length } });

    return entry;
  } catch (err) {
    if (err.code === 11000) return null; // duplicate sourceRef: already credited, not an error
    console.error('[Affiliate] Failed to record commission:', err.message);
    return null;
  }
}

module.exports = { COMMISSION_RATE, generateAffiliateCode, attributeSignup, recordCommission };

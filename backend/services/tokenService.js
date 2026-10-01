const User = require('../models/User');
const TokenLog = require('../models/TokenLog');

const PLAN_TOKEN_LIMITS = {
  free: 25,
  basic: 500,
  pro: 3000,
  enterprise: 10000
};

/**
 * Checks and resets tokens if billing month has rolled over.
 */
async function checkMonthlyTokenRenewal(user) {
  if (!user.subscription) {
    user.subscription = {
      plan: 'free',
      status: 'active'
    };
  }

  const plan = user.subscription.plan || 'basic';
  const planLimit = PLAN_TOKEN_LIMITS[plan] || 500;
  
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  let resetNeeded = false;
  if (!user.subscription.tokensResetAt) {
    user.subscription.tokensTotal = planLimit;
    user.subscription.tokensUsed = user.subscription.tokensUsed || 0;
    user.subscription.tokensResetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    resetNeeded = true;
  } else if (now >= new Date(user.subscription.tokensResetAt)) {
    // New billing month: Reset tokens
    user.subscription.tokensTotal = planLimit;
    user.subscription.tokensUsed = 0;
    user.subscription.tokensResetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    resetNeeded = true;
  }

  // Ensure tokensTotal matches plan limit if not set or plan upgraded
  if (!user.subscription.tokensTotal || user.subscription.tokensTotal < planLimit) {
    user.subscription.tokensTotal = planLimit;
    resetNeeded = true;
  }

  if (resetNeeded) {
    await user.save();
  }

  const total = user.subscription.tokensTotal || planLimit;
  const used = user.subscription.tokensUsed || 0;
  const remaining = Math.max(total - used, 0);

  return {
    currentMonthStr,
    total,
    used,
    remaining
  };
}

/**
 * Deducts token(s) for genuine AI usage and records audit log.
 */
async function deductTokens(userId, { action, feature, itemTitle = '', sku = '', platform = 'universal', count = 1 }) {
  const user = await User.findById(userId);
  if (!user) return { success: false, message: 'User not found' };

  const { currentMonthStr, total, used, remaining } = await checkMonthlyTokenRenewal(user);
  const plan = user.subscription?.plan || 'basic';

  if (plan !== 'enterprise' && used + count > total) {
    return {
      success: false,
      error: 'TOKEN_LIMIT_REACHED',
      message: `Monthly AI token limit reached (${used}/${total}). Please upgrade your subscription plan or wait for the next billing cycle.`,
      tokensRemaining: remaining,
      tokensUsed: used,
      tokensTotal: total
    };
  }

  const newUsed = used + count;
  const newRemaining = Math.max(total - newUsed, 0);

  user.subscription.tokensUsed = newUsed;
  user.subscription.tokensTotal = total;
  await user.save();

  const log = await TokenLog.create({
    user: userId,
    action: action || 'ai_fetch',
    feature: feature || 'AI Listing Generation',
    itemTitle: itemTitle || 'Untitled Product',
    sku: sku || '',
    platform: platform || 'universal',
    tokensDeducted: count,
    tokensRemaining: newRemaining,
    billingMonth: currentMonthStr,
    createdAt: new Date()
  });

  return {
    success: true,
    tokensRemaining: newRemaining,
    tokensUsed: newUsed,
    tokensTotal: total,
    log
  };
}

/**
 * Gets token balance and monthly history.
 */
async function getTokenHistory(userId, monthFilter = null) {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  const { currentMonthStr, total, used, remaining } = await checkMonthlyTokenRenewal(user);
  const plan = user.subscription?.plan || 'basic';

  const query = { user: userId };
  if (monthFilter && monthFilter !== 'all') {
    query.billingMonth = monthFilter;
  }

  const logs = await TokenLog.find(query).sort({ createdAt: -1 }).limit(300);

  // Available billing months for dropdown filter
  const allMonths = await TokenLog.distinct('billingMonth', { user: userId });
  if (!allMonths.includes(currentMonthStr)) {
    allMonths.unshift(currentMonthStr);
  }

  return {
    currentMonth: currentMonthStr,
    tokensTotal: total,
    tokensUsed: used,
    tokensRemaining: remaining,
    renewalDate: user.subscription?.tokensResetAt || user.subscription?.expiresAt || null,
    plan: plan,
    months: allMonths,
    logs
  };
}

module.exports = {
  PLAN_TOKEN_LIMITS,
  deductTokens,
  getTokenHistory,
  checkMonthlyTokenRenewal
};

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const logEmailLocal = (to, subject, text, html) => {
  const logDir = path.join(__dirname, '../logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  const logPath = path.join(logDir, 'emails.log');
  const logEntry = `
========================================
[EMAIL LOG] ${new Date().toISOString()}
TO: ${to}
SUBJECT: ${subject}
TEXT: ${text}
----------------------------------------
HTML CONTENT:
${html}
========================================
\n`;
  fs.appendFileSync(logPath, logEntry);
  console.log(`[Email Service] SMTP not configured or failed. Logged email to ${to} in backend/logs/emails.log`);
};

// Check if SMTP credentials are set
const hasCredentials = process.env.SMTP_HOST && process.env.SMTP_PASSWORD;

let transporter = null;

if (hasCredentials) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER || 'support@elister.ai',
      pass: process.env.SMTP_PASSWORD
    }
  });
}

const sendEmail = async ({ to, subject, text, html }) => {
  const from = process.env.SMTP_USER || 'support@elister.ai';
  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"Elister.ai Support" <${from}>`,
        to,
        subject,
        text,
        html
      });
      console.log(`[Email Service] Email sent successfully to ${to}`);
      return true;
    } catch (err) {
      console.error(`[Email Service] SMTP send failed: ${err.message}. Logging fallback...`);
      logEmailLocal(to, subject, text, html);
      return false;
    }
  } else {
    logEmailLocal(to, subject, text, html);
    return true;
  }
};

/**
 * Send OTP Verification email
 */
exports.sendOtpEmail = async (email, otp, name = '') => {
  const subject = `Verify Your Elister.ai Account - OTP: ${otp}`;
  const text = `Hi ${name || 'User'},\n\nThank you for choosing Elister.ai! To complete your verification, please enter the One-Time Password (OTP) below:\n\n${otp}\n\nThis OTP is valid for 15 minutes. For security reasons, please do not share this code with anyone.\n\nThank you,\nElister.ai Team`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <img src="https://app.elister.ai/logo.png" alt="Elister.ai Logo" style="height: 40px; margin-bottom: 8px;" />
        <p style="color: #64748b; font-size: 14px; margin-top: 4px; margin-bottom: 0; font-weight: 500;">Your AI-Powered Listing Assistant</p>
      </div>
      <div style="background-color: #f8fafc; padding: 24px; border-radius: 12px; margin-bottom: 20px;">
        <p style="font-size: 16px; color: #1e293b; margin-top: 0;">Hi <strong>${name || 'User'}</strong>,</p>
        <p style="font-size: 15px; color: #334155; line-height: 1.5;">Thank you for signing up for Elister.ai! To complete your registration and verify your account, please enter the following One-Time Password (OTP):</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #4f46e5; background: #e0e7ff; padding: 12px 24px; border-radius: 8px; border: 1px dashed #818cf8;">${otp}</span>
        </div>
        <p style="font-size: 13px; color: #64748b; margin-bottom: 0;">This OTP is valid for <strong>15 minutes</strong>. For security reasons, please do not share this code with anyone.</p>
      </div>
      <p style="font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-bottom: 0;">
        If you did not request this email, you can safely ignore it.<br>
        &copy; ${new Date().getFullYear()} Elister.ai. All rights reserved.
      </p>
    </div>
  `;
  return await sendEmail({ to: email, subject, text, html });
};

/**
 * Send Subscription Confirmation email
 */
exports.sendSubscriptionEmail = async (email, plan, amount, expiresAt, name = '') => {
  const subject = `Subscription Activated - Welcome to Elister.ai!`;
  const formattedDate = expiresAt ? new Date(expiresAt).toLocaleDateString() : 'Unlimited';
  const text = `Hi ${name || 'User'},\n\nYour subscription to the ${plan.toUpperCase()} plan has been successfully activated!\n\nPlan Details:\nPlan: ${plan.toUpperCase()}\nAmount Paid: $${amount} USD\nExpiry Date: ${formattedDate}\n\nGo to Dashboard: ${process.env.FRONTEND_URL || 'https://elister.ai'}/dashboard\n\nThank you for choosing Elister.ai!`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <img src="https://app.elister.ai/logo.png" alt="Elister.ai Logo" style="height: 40px; margin-bottom: 8px;" />
        <p style="color: #64748b; font-size: 14px; margin-top: 4px; margin-bottom: 0; font-weight: 500;">Your AI-Powered Listing Assistant</p>
      </div>
      <div style="background-color: #f0fdf4; padding: 24px; border-radius: 12px; border: 1px solid #bbf7d0; margin-bottom: 20px;">
        <p style="font-size: 16px; color: #14532d; margin-top: 0; font-weight: bold;">Hi ${name || 'User'},</p>
        <p style="font-size: 15px; color: #166534; line-height: 1.5;">Your subscription has been successfully activated! Here are your plan details:</p>
        
        <table style="width: 100%; margin-top: 20px; font-size: 14px; color: #1e293b; border-collapse: collapse;">
          <tr style="border-bottom: 1px solid #dcfce7;">
            <td style="padding: 10px 0; font-weight: bold; color: #4b5563;">Plan Type</td>
            <td style="padding: 10px 0; text-align: right; font-weight: bold; color: #10b981;">${plan.toUpperCase()}</td>
          </tr>
          <tr style="border-bottom: 1px solid #dcfce7;">
            <td style="padding: 10px 0; font-weight: bold; color: #4b5563;">Amount Paid</td>
            <td style="padding: 10px 0; text-align: right; font-weight: bold;">$${amount} USD</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; font-weight: bold; color: #4b5563;">Expiry Date</td>
            <td style="padding: 10px 0; text-align: right; font-weight: bold;">${formattedDate}</td>
          </tr>
        </table>
      </div>
      <p style="font-size: 14px; color: #334155; line-height: 1.5; text-align: center; margin-bottom: 24px;">
        You can now log in to your dashboard to start creating your listings!
      </p>
      <div style="text-align: center; margin-bottom: 20px;">
        <a href="${process.env.FRONTEND_URL || 'https://elister.ai'}/dashboard" style="background-color: #10b981; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block;">Go to Dashboard</a>
      </div>
      <p style="font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-bottom: 0;">
        Need help? Contact support at support@elister.ai<br>
        &copy; ${new Date().getFullYear()} Elister.ai. All rights reserved.
      </p>
    </div>
  `;
  return await sendEmail({ to: email, subject, text, html });
};

/**
 * Send Subscription Expiry Reminder
 */
exports.sendExpiryReminderEmail = async (email, plan, daysLeft, name = '') => {
  const subject = `Urgent: Renew Your Elister.ai Subscription - ${daysLeft} Days Left`;
  const text = `Hi ${name || 'User'},\n\nYour Elister.ai ${plan.toUpperCase()} plan is expiring in ${daysLeft} days. Please renew to keep using our AI lister service.\n\nThank you,\nElister.ai Team`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <img src="https://app.elister.ai/logo.png" alt="Elister.ai Logo" style="height: 40px; margin-bottom: 8px;" />
        <p style="color: #64748b; font-size: 14px; margin-top: 4px; margin-bottom: 0; font-weight: 500;">Your AI-Powered Listing Assistant</p>
      </div>
      <div style="background-color: #fffbeb; padding: 24px; border-radius: 12px; border: 1px solid #fef3c7; margin-bottom: 20px;">
        <p style="font-size: 16px; color: #78350f; margin-top: 0; font-weight: bold;">Hi ${name || 'User'},</p>
        <p style="font-size: 15px; color: #92400e; line-height: 1.5;">
          Your Elister.ai **${plan.toUpperCase()}** plan is expiring in **${daysLeft} days**.
        </p>
        <p style="font-size: 14px; color: #b45309; margin-bottom: 0;">
          Please renew your plan to ensure uninterrupted access to your active workspace and rule automation engine.
        </p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'https://elister.ai'}/subscription" style="background-color: #f59e0b; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block;">Renew Subscription Now</a>
      </div>
      <p style="font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-bottom: 0;">
        If you have already renewed, please ignore this email.<br>
        &copy; ${new Date().getFullYear()} Elister.ai. All rights reserved.
      </p>
    </div>
  `;
  return await sendEmail({ to: email, subject, text, html });
};

/**
 * Send Usage Limit Warning email
 */
exports.sendUsageWarningEmail = async (email, plan, currentUsage, limit, type = 'ai_fetch', name = '') => {
  const percent = Math.floor((currentUsage / limit) * 100);
  const typeText = type === 'ai_fetch' ? 'AI Fetches' : 'API Listings';
  const subject = `Elister.ai: ${typeText} Limit Warning (${percent}% Used)`;
  const text = `Hi ${name || 'User'},\n\nYou have used ${currentUsage} out of ${limit} ${typeText} under your ${plan.toUpperCase()} plan (${percent}%). Please upgrade/renew to get more limits.\n\nThank you,\nElister.ai Team`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <img src="https://app.elister.ai/logo.png" alt="Elister.ai Logo" style="height: 40px; margin-bottom: 8px;" />
        <p style="color: #64748b; font-size: 14px; margin-top: 4px; margin-bottom: 0; font-weight: 500;">Your AI-Powered Listing Assistant</p>
      </div>
      <div style="background-color: #fef2f2; padding: 24px; border-radius: 12px; border: 1px solid #fee2e2; margin-bottom: 20px;">
        <p style="font-size: 16px; color: #991b1b; margin-top: 0; font-weight: bold;">Hi ${name || 'User'},</p>
        <p style="font-size: 15px; color: #b91c1c; line-height: 1.5;">
          You have utilized **${percent}%** of the **${typeText}** limit under your **${plan.toUpperCase()}** plan:
        </p>
        <div style="background: white; border-radius: 8px; padding: 16px; margin: 20px 0; border: 1px solid #fecaca; text-align: center;">
          <p style="margin: 0; font-size: 14px; color: #4b5563;">Current Usage</p>
          <p style="margin: 8px 0; font-size: 28px; font-weight: bold; color: #dc2626;">${currentUsage} / ${limit}</p>
          <div style="background: #fee2e2; border-radius: 4px; height: 10px; overflow: hidden; width: 100%;">
            <div style="background: #dc2626; height: 100%; width: ${percent}%;"></div>
          </div>
        </div>
        <p style="font-size: 13px; color: #991b1b; margin-bottom: 0;">
          Once your limits are fully exhausted, you will not be able to analyze or publish new listings. Please upgrade your plan to continue.
        </p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'https://elister.ai'}/subscription" style="background-color: #dc2626; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block;">Upgrade My Plan</a>
      </div>
      <p style="font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-bottom: 0;">
        &copy; ${new Date().getFullYear()} Elister.ai. All rights reserved.
      </p>
    </div>
  `;
  return await sendEmail({ to: email, subject, text, html });
};

/**
 * Send Password Reset email
 */
exports.sendResetPasswordEmail = async (email, resetUrl, name = '') => {
  const subject = 'Reset Your Elister.ai Password';
  const text = `Hi ${name || 'User'},\n\nA password reset request was received for your Elister.ai account. Please reset your password by clicking this link: ${resetUrl}\n\nThis link is valid for 30 minutes. If you did not request this, please ignore this email.`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <img src="https://app.elister.ai/logo.png" alt="Elister.ai Logo" style="height: 40px; margin-bottom: 8px;" />
        <p style="color: #64748b; font-size: 14px; margin-top: 4px; margin-bottom: 0; font-weight: 500;">Your AI-Powered Listing Assistant</p>
      </div>
      <div style="background-color: #f8fafc; padding: 24px; border-radius: 12px; margin-bottom: 20px;">
        <p style="font-size: 16px; color: #1e293b; margin-top: 0; font-weight: bold;">Hi ${name || 'User'},</p>
        <p style="font-size: 15px; color: #334155; line-height: 1.5;">
          We received a request to reset the password for your Elister.ai account. Please click the button below to reset your password:
        </p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block;">Reset My Password</a>
      </div>
      <p style="font-size: 13px; color: #64748b; text-align: center; margin-bottom: 20px;">
        This link is valid for <strong>30 minutes</strong>.
      </p>
      <p style="font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-bottom: 0;">
        If you did not request a password reset, you can safely ignore this email. Your password will remain secure.<br>
        &copy; ${new Date().getFullYear()} Elister.ai. All rights reserved.
      </p>
    </div>
  `;
  return await sendEmail({ to: email, subject, text, html });
};

/**
 * Send Password Reset OTP email
 */
exports.sendResetPasswordOtpEmail = async (email, otp, name = '') => {
  const subject = `Reset Your Elister.ai Password - OTP: ${otp}`;
  const text = `Hi ${name || 'User'},\n\nYour OTP for resetting your password is: ${otp}. It is valid for 15 minutes.\n\nThank you,\nElister.ai Team`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <img src="https://app.elister.ai/logo.png" alt="Elister.ai Logo" style="height: 40px; margin-bottom: 8px;" />
        <p style="color: #64748b; font-size: 14px; margin-top: 4px; margin-bottom: 0; font-weight: 500;">Your AI-Powered Listing Assistant</p>
      </div>
      <div style="background-color: #f8fafc; padding: 24px; border-radius: 12px; margin-bottom: 20px;">
        <p style="font-size: 16px; color: #1e293b; margin-top: 0;">Hi <strong>${name || 'User'}</strong>,</p>
        <p style="font-size: 15px; color: #334155; line-height: 1.5;">We received a request to reset your Elister.ai password. Please enter the following One-Time Password (OTP) to proceed:</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #4f46e5; background: #e0e7ff; padding: 12px 24px; border-radius: 8px; border: 1px dashed #818cf8;">${otp}</span>
        </div>
        <p style="font-size: 13px; color: #64748b; margin-bottom: 0;">This OTP is valid for <strong>15 minutes</strong>. For security reasons, please do not share this code with anyone.</p>
      </div>
      <p style="font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-bottom: 0;">
        If you did not request this, you can safely ignore this email.<br>
        &copy; ${new Date().getFullYear()} Elister.ai. All rights reserved.
      </p>
    </div>
  `;
  return await sendEmail({ to: email, subject, text, html });
};

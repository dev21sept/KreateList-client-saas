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
  const text = `Hi ${name || 'User'},\n\nYour OTP for verification is: ${otp}. It is valid for 15 minutes.\n\nThank you,\nElister.ai Team`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #4f46e5; margin: 0;">Elister.ai</h2>
        <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Premium AI Listing Companion</p>
      </div>
      <div style="background-color: #f8fafc; padding: 24px; border-radius: 12px; margin-bottom: 20px;">
        <p style="font-size: 16px; color: #1e293b; margin-top: 0;">Hi <strong>${name || 'User'}</strong>,</p>
        <p style="font-size: 15px; color: #334155; line-height: 1.5;">Elister.ai par signup karne ke liye dhanyawad! Apne account ko verify karne ke liye niche diya gaya OTP (One-Time Password) enter karein:</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #4f46e5; background: #e0e7ff; padding: 12px 24px; border-radius: 8px; border: 1px dashed #818cf8;">${otp}</span>
        </div>
        <p style="font-size: 13px; color: #64748b;">Ye OTP agle <strong>15 minutes</strong> ke liye hi valid hai. Kripya ise kisi ke sath share na karein.</p>
      </div>
      <p style="font-size: 12px; color: #94a3b8; text-align: center; border-t: 1px solid #f1f5f9; padding-top: 16px;">
        Agar aapne ye request nahi ki thi, toh kripya is email ko ignore karein.<br>
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
  const text = `Hi ${name || 'User'},\n\nYour subscription to the ${plan.toUpperCase()} plan was activated successfully!\nAmount paid: $${amount}\nExpiry date: ${formattedDate}\n\nThank you for choosing Elister.ai!`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #10b981; margin: 0;">Payment Successful</h2>
        <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Subscription Confirmation</p>
      </div>
      <div style="background-color: #f0fdf4; padding: 24px; border-radius: 12px; border: 1px solid #bbf7d0; margin-bottom: 20px;">
        <p style="font-size: 16px; color: #14532d; margin-top: 0; font-weight: bold;">Hi ${name || 'User'},</p>
        <p style="font-size: 15px; color: #166534; line-height: 1.5;">Aapki subscription safaltapoorvak activate ho chuki hai! Details niche di gayi hain:</p>
        
        <table style="width: 100%; margin-top: 20px; font-size: 14px; color: #1e293b; border-collapse: collapse;">
          <tr style="border-bottom: 1px solid #dcfce7; padding: 8px 0;">
            <td style="padding: 10px 0; font-weight: bold; color: #4b5563;">Plan Type</td>
            <td style="padding: 10px 0; text-align: right; font-weight: bold; color: #10b981;">${plan.toUpperCase()}</td>
          </tr>
          <tr style="border-bottom: 1px solid #dcfce7; padding: 8px 0;">
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
        Ab aap dashboard par jakar listings create karna start kar sakte hain!
      </p>
      <div style="text-align: center; margin-bottom: 20px;">
        <a href="${process.env.FRONTEND_URL || 'https://elister.ai'}/dashboard" style="background-color: #10b981; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block;">Go to Dashboard</a>
      </div>
      <p style="font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 16px;">
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
        <h2 style="color: #f59e0b; margin: 0;">Subscription Expiring</h2>
        <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Action Required</p>
      </div>
      <div style="background-color: #fffbeb; padding: 24px; border-radius: 12px; border: 1px solid #fef3c7; margin-bottom: 20px;">
        <p style="font-size: 16px; color: #78350f; margin-top: 0; font-weight: bold;">Hi ${name || 'User'},</p>
        <p style="font-size: 15px; color: #92400e; line-height: 1.5;">
          Aapki Elister.ai **${plan.toUpperCase()}** plan ki subscription agle **${daysLeft} days** me expire hone wali hai.
        </p>
        <p style="font-size: 14px; color: #b45309; margin-bottom: 0;">
          Kripya dashboard par jaakar apna plan renew kar lein taaki aapka active workspace aur rules engine block na ho.
        </p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'https://elister.ai'}/subscription" style="background-color: #f59e0b; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block;">Renew Subscription Now</a>
      </div>
      <p style="font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 16px;">
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
        <h2 style="color: #dc2626; margin: 0;">Usage Limit Warning</h2>
        <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Limit Utilization alert</p>
      </div>
      <div style="background-color: #fef2f2; padding: 24px; border-radius: 12px; border: 1px solid #fee2e2; margin-bottom: 20px;">
        <p style="font-size: 16px; color: #991b1b; margin-top: 0; font-weight: bold;">Hi ${name || 'User'},</p>
        <p style="font-size: 15px; color: #b91c1c; line-height: 1.5;">
          Aapke **${plan.toUpperCase()}** plan me **${typeText}** ki consumption limits **${percent}%** tak pahunch chuki hain:
        </p>
        <div style="background: white; border-radius: 8px; padding: 16px; margin: 20px 0; border: 1px solid #fecaca; text-align: center;">
          <p style="margin: 0; font-size: 14px; color: #4b5563;">Current Usage</p>
          <p style="margin: 8px 0; font-size: 28px; font-weight: bold; color: #dc2626;">${currentUsage} / ${limit}</p>
          <div style="background: #fee2e2; border-radius: 4px; height: 10px; overflow: hidden; width: 100%;">
            <div style="background: #dc2626; height: 100%; width: ${percent}%;"></div>
          </div>
        </div>
        <p style="font-size: 13px; color: #991b1b; margin-bottom: 0;">
          Limits pure exhaust (100%) hone par aap aur naye listings analyze ya publish nahi kar payenge. Kripya plan upgrade ya renew kar lein.
        </p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'https://elister.ai'}/subscription" style="background-color: #dc2626; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block;">Upgrade My Plan</a>
      </div>
      <p style="font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 16px;">
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
        <h2 style="color: #4f46e5; margin: 0;">Password Reset Request</h2>
        <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Security & Account Recovery</p>
      </div>
      <div style="background-color: #f8fafc; padding: 24px; border-radius: 12px; margin-bottom: 20px;">
        <p style="font-size: 16px; color: #1e293b; margin-top: 0; font-weight: bold;">Hi ${name || 'User'},</p>
        <p style="font-size: 15px; color: #334155; line-height: 1.5;">
          Aapke Elister.ai account ka password reset karne ke liye ek request mili hai. Apna password reset karne ke liye niche diye gaye button par click karein:
        </p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block;">Reset My Password</a>
      </div>
      <p style="font-size: 13px; color: #64748b; text-align: center; margin-bottom: 20px;">
        Ye link agle **30 minutes** ke liye valid hai.
      </p>
      <p style="font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 16px;">
        Agar aapne ye request nahi ki thi, toh kripya is email ko ignore karein. Aapka password surakshit rahega.<br>
        &copy; ${new Date().getFullYear()} Elister.ai. All rights reserved.
      </p>
    </div>
  `;
  return await sendEmail({ to: email, subject, text, html });
};

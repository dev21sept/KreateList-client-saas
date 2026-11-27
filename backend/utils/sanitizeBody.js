// Removes fields a client must never set directly on a document, so request
// bodies cannot change ownership, identity, timestamps or stored credentials.
const ALWAYS_PROTECTED = ['_id', '__v', 'createdAt', 'updatedAt'];

function stripFields(body = {}, extra = []) {
  const copy = { ...body };
  for (const key of [...ALWAYS_PROTECTED, ...extra]) {
    delete copy[key];
  }
  return copy;
}

// Fields the admin user editor must not write directly (password writes bypass hashing).
const ADMIN_PROTECTED = [
  'user',
  'password',
  'otpCode',
  'otpExpires',
  'otpAttempts',
  'resetPasswordOtp',
  'resetPasswordOtpExpire',
  'resetPasswordOtpAttempts',
  'resetPasswordToken',
  'resetPasswordExpire',
  'trustedDevices'
];

module.exports = { stripFields, ADMIN_PROTECTED };

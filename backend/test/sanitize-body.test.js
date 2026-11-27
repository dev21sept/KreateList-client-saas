const test = require('node:test');
const assert = require('node:assert/strict');
const { stripFields, ADMIN_PROTECTED } = require('../utils/sanitizeBody');

test('stripFields removes identity, ownership and timestamp fields', () => {
  const body = { title: 'Jacket', _id: 'x', __v: 3, user: 'other', createdAt: 'now', updatedAt: 'now' };
  assert.deepEqual(stripFields(body, ['user']), { title: 'Jacket' });
});

test('stripFields does not mutate the original body', () => {
  const body = { user: 'other', price: '10' };
  stripFields(body, ['user']);
  assert.equal(body.user, 'other');
});

test('admin editor cannot write password or OTP fields', () => {
  const body = { role: 'admin', password: 'x', otpCode: '123', resetPasswordToken: 't', email: 'a@b.c' };
  const clean = stripFields(body, ADMIN_PROTECTED);
  assert.deepEqual(clean, { role: 'admin', email: 'a@b.c' });
});

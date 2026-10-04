// Parses a marketplace price string into a number, handling both
// "1,299.00" (US/UK) and "1.299,00" / "12,99" (European) formats.
// Returns null when no usable number is found.
function parsePrice(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) && raw >= 0 ? raw : null;

  let s = String(raw).replace(/[^\d.,]/g, '');
  if (!s) return null;

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');

  if (lastDot !== -1 && lastComma !== -1) {
    // Whichever separator appears last is the decimal separator.
    const decimalSep = lastDot > lastComma ? '.' : ',';
    const thousandsSep = decimalSep === '.' ? ',' : '.';
    s = s.split(thousandsSep).join('').replace(decimalSep, '.');
  } else if (lastComma !== -1) {
    const parts = s.split(',');
    // "12,99" is a decimal comma; "1,299" or "1,299,000" are thousands separators.
    s = parts.length === 2 && parts[1].length <= 2 ? `${parts[0]}.${parts[1]}` : parts.join('');
  } else if (lastDot !== -1 && s.split('.').length > 2) {
    // "1.234.567" is thousands separators only.
    s = s.split('.').join('');
  }

  const value = Number(s);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

// Returns a two-decimal string (the Listing.price field is a String), or null.
function formatPrice(raw) {
  const value = parsePrice(raw);
  return value === null ? null : value.toFixed(2);
}

module.exports = { parsePrice, formatPrice };

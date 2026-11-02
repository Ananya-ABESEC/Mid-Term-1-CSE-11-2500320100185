const { badRequest } = require('./errors');

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;
const isPositiveInt = (v) => Number.isInteger(v) && v > 0;
const isEmail = (v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// Validates a body against a rules object.
// rules: { field: { required: bool, check: fn, message: string } }
// partial = true skips "required" (used for PATCH).
function validateBody(body, rules, partial = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('Request body must be a JSON object');
  }
  const errors = [];
  for (const [field, rule] of Object.entries(rules)) {
    const value = body[field];
    if (value === undefined) {
      if (rule.required && !partial) errors.push(`${field} is required`);
      continue;
    }
    if (!rule.check(value)) errors.push(rule.message);
  }
  if (errors.length) throw badRequest('Validation failed', errors);
}

// Copies only allowed fields from body (trims strings)
const pick = (body, fields) =>
  fields.reduce(
    (acc, f) =>
      body[f] !== undefined
        ? { ...acc, [f]: typeof body[f] === 'string' ? body[f].trim() : body[f] }
        : acc,
    {}
  );

module.exports = { validateBody, pick, isNonEmptyString, isPositiveInt, isEmail };
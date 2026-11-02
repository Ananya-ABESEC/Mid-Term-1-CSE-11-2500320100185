const express = require('express');
const { db, randomUUID, now } = require('../utils/store');
const { notFound, conflict } = require('../utils/errors');
const { validateBody, pick, isNonEmptyString, isEmail } = require('../utils/validate');

const router = express.Router();

const rules = {
  name: { required: true, check: isNonEmptyString, message: 'name must be a non-empty string' },
  email: { required: true, check: isEmail, message: 'email must be a valid email address' },
  phone: {
    required: false,
    check: (v) => typeof v === 'string' && /^\+?[0-9\s-]{7,15}$/.test(v),
    message: 'phone must be 7-15 digits',
  },
};
const FIELDS = Object.keys(rules);

const findMember = (id) => {
  const m = db.members.find((x) => x.id === id);
  if (!m) throw notFound(`Member with id ${id} not found`);
  return m;
};

const emailTaken = (email, ignoreId) =>
  db.members.some((m) => m.email.toLowerCase() === email.toLowerCase() && m.id !== ignoreId);

const activeLoanCount = (memberId) =>
  db.loans.filter((l) => l.memberId === memberId && l.status === 'borrowed').length;

// READ ALL — ?search=
router.get('/', (req, res) => {
  const { search } = req.query;
  let result = [...db.members];
  if (search) {
    const q = search.toLowerCase();
    result = result.filter((m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q));
  }
  res.json({ total: result.length, data: result });
});

// READ ONE (includes their loans)
router.get('/:id', (req, res) => {
  const member = findMember(req.params.id);
  const loans = db.loans.filter((l) => l.memberId === member.id);
  res.json({ ...member, loans });
});

// CREATE
router.post('/', (req, res) => {
  validateBody(req.body, rules);
  const data = pick(req.body, FIELDS);
  if (emailTaken(data.email)) throw conflict(`A member with email ${data.email} already exists`);

  const member = { id: randomUUID(), ...data, createdAt: now(), updatedAt: now() };
  db.members.push(member);
  res.status(201).json(member);
});

function updateMember(req, partial) {
  const member = findMember(req.params.id);
  validateBody(req.body, rules, partial);
  const data = pick(req.body, FIELDS);
  if (data.email && emailTaken(data.email, member.id)) {
    throw conflict(`A member with email ${data.email} already exists`);
  }
  if (!partial) delete member.phone;
  Object.assign(member, data, { updatedAt: now() });
  return member;
}

// UPDATE
router.put('/:id', (req, res) => res.json(updateMember(req, false)));
router.patch('/:id', (req, res) => res.json(updateMember(req, true)));

// DELETE
router.delete('/:id', (req, res) => {
  const member = findMember(req.params.id);
  if (activeLoanCount(member.id) > 0) throw conflict('Cannot delete a member who has books checked out');
  db.members = db.members.filter((m) => m.id !== member.id);
  res.json({ message: 'Member deleted', member });
});

module.exports = router;
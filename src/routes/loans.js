const express = require('express');
const { db, randomUUID, now } = require('../utils/store');
const { notFound, conflict, badRequest } = require('../utils/errors');
const { validateBody, isNonEmptyString, isPositiveInt } = require('../utils/validate');

const router = express.Router();

const MAX_ACTIVE_LOANS_PER_MEMBER = 5;
const DEFAULT_LOAN_DAYS = 14;
const FINE_PER_DAY = 5; // currency units per overdue day

const addDays = (date, days) => new Date(date.getTime() + days * 86400000);

const findLoan = (id) => {
  const loan = db.loans.find((l) => l.id === id);
  if (!loan) throw notFound(`Loan with id ${id} not found`);
  return loan;
};

// Adds a computed "overdue" flag
const withOverdue = (loan) => ({
  ...loan,
  overdue: loan.status === 'borrowed' && new Date(loan.dueDate) < new Date(),
});

// READ ALL — ?status=borrowed|returned&memberId=&bookId=&overdue=true
router.get('/', (req, res) => {
  const { status, memberId, bookId, overdue } = req.query;
  let result = db.loans.map(withOverdue);
  if (status) result = result.filter((l) => l.status === status);
  if (memberId) result = result.filter((l) => l.memberId === memberId);
  if (bookId) result = result.filter((l) => l.bookId === bookId);
  if (overdue === 'true') result = result.filter((l) => l.overdue);
  res.json({ total: result.length, data: result });
});

// READ ONE
router.get('/:id', (req, res) => res.json(withOverdue(findLoan(req.params.id))));

// CREATE — borrow a book
router.post('/', (req, res) => {
  validateBody(req.body, {
    bookId: { required: true, check: isNonEmptyString, message: 'bookId is required' },
    memberId: { required: true, check: isNonEmptyString, message: 'memberId is required' },
    days: {
      required: false,
      check: (v) => isPositiveInt(v) && v <= 60,
      message: 'days must be an integer between 1 and 60',
    },
  });
  const { bookId, memberId, days = DEFAULT_LOAN_DAYS } = req.body;

  const book = db.books.find((b) => b.id === bookId);
  if (!book) throw notFound(`Book with id ${bookId} not found`);
  const member = db.members.find((m) => m.id === memberId);
  if (!member) throw notFound(`Member with id ${memberId} not found`);

  if (book.availableCopies < 1) throw conflict('No copies of this book are currently available');

  const memberActive = db.loans.filter((l) => l.memberId === memberId && l.status === 'borrowed');
  if (memberActive.length >= MAX_ACTIVE_LOANS_PER_MEMBER) {
    throw conflict(`Member has reached the limit of ${MAX_ACTIVE_LOANS_PER_MEMBER} active loans`);
  }
  if (memberActive.some((l) => l.bookId === bookId)) {
    throw conflict('Member has already borrowed this book');
  }

  const issued = new Date();
  const loan = {
    id: randomUUID(),
    bookId,
    memberId,
    status: 'borrowed',
    borrowedAt: issued.toISOString(),
    dueDate: addDays(issued, days).toISOString(),
    returnedAt: null,
    fine: 0,
  };
  book.availableCopies -= 1;
  book.updatedAt = now();
  db.loans.push(loan);
  res.status(201).json(loan);
});

// UPDATE — return a book (calculates fine)
router.post('/:id/return', (req, res) => {
  const loan = findLoan(req.params.id);
  if (loan.status === 'returned') throw conflict('This loan has already been returned');

  const returned = new Date();
  const due = new Date(loan.dueDate);
  const lateDays = returned > due ? Math.ceil((returned - due) / 86400000) : 0;

  loan.status = 'returned';
  loan.returnedAt = returned.toISOString();
  loan.fine = lateDays * FINE_PER_DAY;

  const book = db.books.find((b) => b.id === loan.bookId);
  if (book) {
    book.availableCopies += 1;
    book.updatedAt = now();
  }
  res.json(loan);
});

// UPDATE — renew (extend due date)
router.patch('/:id/renew', (req, res) => {
  const loan = findLoan(req.params.id);
  if (loan.status !== 'borrowed') throw conflict('Only active loans can be renewed');
  if (new Date(loan.dueDate) < new Date()) throw conflict('Overdue loans cannot be renewed. Return the book first.');

  const days = req.body && req.body.days !== undefined ? req.body.days : DEFAULT_LOAN_DAYS;
  if (!isPositiveInt(days) || days > 60) throw badRequest('days must be an integer between 1 and 60');

  loan.dueDate = addDays(new Date(loan.dueDate), days).toISOString();
  res.json(loan);
});

// DELETE — remove a loan record (only if already returned)
router.delete('/:id', (req, res) => {
  const loan = findLoan(req.params.id);
  if (loan.status === 'borrowed') throw conflict('Cannot delete an active loan. Return the book first.');
  db.loans = db.loans.filter((l) => l.id !== loan.id);
  res.json({ message: 'Loan record deleted', loan });
});

module.exports = router;
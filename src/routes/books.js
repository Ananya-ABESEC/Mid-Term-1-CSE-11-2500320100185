const express = require('express');
const { db } = require('../utils/store');
const { notFound, conflict, badRequest } = require('../utils/errors');
const { validateBody, pick, isNonEmptyString, isPositiveInt } = require('../utils/validate');

const router = express.Router();

// Book shape: { id, title, author, category, quantity }
const rules = {
  id: { required: false, check: isPositiveInt, message: 'id must be a positive integer' },
  title: { required: true, check: isNonEmptyString, message: 'title must be a non-empty string' },
  author: { required: true, check: isNonEmptyString, message: 'author must be a non-empty string' },
  category: { required: true, check: isNonEmptyString, message: 'category must be a non-empty string' },
  quantity: {
    required: true,
    check: (v) => Number.isInteger(v) && v >= 0,
    message: 'quantity must be a non-negative integer',
  },
};
const FIELDS = ['title', 'author', 'category', 'quantity'];

const parseId = (raw) => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Book id must be a positive integer');
  return id;
};

const findBook = (rawId) => {
  const id = parseId(rawId);
  const book = db.books.find((b) => b.id === id);
  if (!book) throw notFound(`Book with id ${id} not found`);
  return book;
};

const nextId = () => db.books.reduce((max, b) => Math.max(max, b.id), 0) + 1;

const hasActiveLoans = (bookId) =>
  db.loans.some((l) => l.bookId === bookId && l.status === 'borrowed');

// READ ALL
router.get('/', (req, res) => {
  const { search, author, category, available } = req.query;
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);

  let result = [...db.books];
  if (search) {
    const q = search.toLowerCase();
    result = result.filter((b) => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q));
  }
  if (author) result = result.filter((b) => b.author.toLowerCase().includes(author.toLowerCase()));
  if (category) result = result.filter((b) => b.category.toLowerCase() === category.toLowerCase());
  if (available === 'true') result = result.filter((b) => b.quantity > 0);

  const total = result.length;
  res.json({ total, page, limit, totalPages: Math.ceil(total / limit), data: result.slice((page - 1) * limit, page * limit) });
});

// READ ONE
router.get('/:id', (req, res) => res.json(findBook(req.params.id)));

// CREATE
router.post('/', (req, res) => {
  validateBody(req.body, rules);
  const data = pick(req.body, FIELDS);

  const id = req.body.id !== undefined ? req.body.id : nextId();
  if (db.books.some((b) => b.id === id)) throw conflict(`A book with id ${id} already exists`);

  const book = { id, ...data };
  db.books.push(book);
  res.status(201).json(book);
});

function updateBook(req, partial) {
  const book = findBook(req.params.id);
  validateBody(req.body, rules, partial);
  if (req.body.id !== undefined && req.body.id !== book.id) {
    throw badRequest('id cannot be changed');
  }
  Object.assign(book, pick(req.body, FIELDS));
  return book;
}

// UPDATE
router.put('/:id', (req, res) => res.json(updateBook(req, false)));
router.patch('/:id', (req, res) => res.json(updateBook(req, true)));

// DELETE
router.delete('/:id', (req, res) => {
  const book = findBook(req.params.id);
  if (hasActiveLoans(book.id)) throw conflict('Cannot delete a book that has active loans');
  db.books = db.books.filter((b) => b.id !== book.id);
  res.json({ message: 'Book deleted', book });
});

module.exports = router;
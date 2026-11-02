const express = require('express');
const { notFound, AppError } = require('./utils/errors');
const { db } = require('./utils/store');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Simple request logger
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()}  ${req.method} ${req.originalUrl}`);
  next();
});

// Overview
app.get('/', (_req, res) => {
  res.json({
    name: 'Library Management System API',
    endpoints: ['/api/books', '/api/members', '/api/loans'],
    stats: { books: db.books.length, members: db.members.length, loans: db.loans.length },
  });
});

app.use('/api/books', require('./routes/books'));
app.use('/api/members', require('./routes/members'));
app.use('/api/loans', require('./routes/loans'));

// 404 handler
app.use((req, _res, next) => next(notFound(`Route ${req.method} ${req.originalUrl} not found`)));

// Central error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message, ...(err.details && { details: err.details }) });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Library API running on http://localhost:${PORT}`));
}

module.exports = app;
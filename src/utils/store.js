// In-memory "database". Data resets whenever the server restarts.
const { randomUUID } = require('crypto');

const now = () => new Date().toISOString();

const db = {
  books: [],
  members: [],
  loans: [],
};

// ---------- Seed data ----------
db.books.push(
  { id: 1, title: 'Effective Java', author: 'Joshua Bloch', category: 'Programming', quantity: 20 },
  { id: 2, title: 'Clean Code', author: 'Robert C. Martin', category: 'Programming', quantity: 15 },
  { id: 3, title: 'Introduction to Algorithms', author: 'Thomas H. Cormen', category: 'Computer Science', quantity: 10 }
);

db.members.push({
  id: randomUUID(),
  name: 'Ananya',
  email: 'a1234@example.com',
  phone: '9876543210',
  createdAt: now(),
  updatedAt: now(),
});

module.exports = { db, randomUUID, now };
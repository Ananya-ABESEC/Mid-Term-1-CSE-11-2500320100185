# Library Management System API

REST API built with **Node.js + Express**. No database: all data lives in memory and resets when the server restarts (3 sample books and 1 sample member are seeded on startup).

## Run

```bash
npm install
npm start          # http://localhost:3000
npm run dev        # auto-restart on changes (Node 18+)
```

## Endpoints

### Books `/api/books`
| Method | Path | Description |
|---|---|---|
| GET | `/api/books` | List books. Query: `search`, `author`, `genre`, `available=true`, `page`, `limit` |
| GET | `/api/books/:id` | Get one book |
| POST | `/api/books` | Create (`title`, `author`, `isbn` required; `genre`, `publishedYear`, `totalCopies` optional) |
| PUT | `/api/books/:id` | Full update |
| PATCH | `/api/books/:id` | Partial update |
| DELETE | `/api/books/:id` | Delete (blocked if copies are on loan) |

### Members `/api/members`
| Method | Path | Description |
|---|---|---|
| GET | `/api/members` | List members. Query: `search` |
| GET | `/api/members/:id` | Get member with their loans |
| POST | `/api/members` | Create (`name`, `email` required; `phone` optional) |
| PUT / PATCH | `/api/members/:id` | Full / partial update |
| DELETE | `/api/members/:id` | Delete (blocked if member has active loans) |

### Loans `/api/loans`
| Method | Path | Description |
|---|---|---|
| GET | `/api/loans` | List loans. Query: `status`, `memberId`, `bookId`, `overdue=true` |
| GET | `/api/loans/:id` | Get one loan |
| POST | `/api/loans` | Borrow a book: `{ "bookId": "...", "memberId": "...", "days": 14 }` |
| POST | `/api/loans/:id/return` | Return a book (fine = 5 per overdue day) |
| PATCH | `/api/loans/:id/renew` | Extend due date: `{ "days": 7 }` |
| DELETE | `/api/loans/:id` | Delete a returned loan record |

## Business rules
- ISBNs and member emails must be unique (409 on duplicates)
- A book needs an available copy to be borrowed
- A member can have at most 5 active loans and can't borrow the same book twice at once
- Books/members with active loans can't be deleted
- Overdue loans can't be renewed

## Example

```bash
curl -X POST http://localhost:3000/api/books \
  -H "Content-Type: application/json" \
  -d '{"title":"Refactoring","author":"Martin Fowler","isbn":"9780134757599","totalCopies":2}'
```

## Structure
```
src/
  server.js          app setup, error handling
  routes/            books.js, members.js, loans.js
  utils/             store.js (in-memory data), validate.js, errors.js
```

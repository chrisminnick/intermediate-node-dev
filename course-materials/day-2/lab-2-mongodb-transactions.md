# Lab 2: Advanced MongoDB Operations with Transactions

## Objective
Use MongoDB transactions for reliable multi-document operations in Node.js.

## Instructions

### Part 1: Mongoose Models
1. Create a Node.js project and install `mongoose`.
2. Define models for two related collections (e.g., accounts, transfers).

### Part 2: Transaction Logic
1. Implement multi-document updates (e.g., transfer funds between accounts) using Mongoose transactions.
2. Add error handling and rollback logic.

### Part 3: API Endpoints (Optional)
- Expose endpoints for creating transfers and viewing balances.
- Test with Postman or curl.

### Part 4: Extension (Optional)
- Integrate with authentication for secure transfers
- Add support for multiple currencies
- Implement audit logging

## Deliverables
- Mongoose models and transaction logic code
- Example transaction and rollback
- Brief explanation of transaction benefits

## Resources
- [Mongoose Transactions](https://mongoosejs.com/docs/transactions.html)
- [MongoDB Transactions](https://www.mongodb.com/docs/manual/core/transactions/)

---

**Tip:** Focus on atomic multi-document operations and error handling. Add extensions if time allows.

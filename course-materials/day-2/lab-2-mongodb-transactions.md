# Lab 2: Advanced MongoDB Operations with Transactions

## Learning Objectives

By the end of this lab, you will be able to:

- Understand the importance of ACID transactions in MongoDB
- Implement multi-document transactions using Mongoose
- Handle transaction errors and rollbacks properly
- Design a banking system with atomic money transfers
- Apply transaction best practices for data consistency

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (v4.0 or higher with replica set)
- Basic understanding of MongoDB and Mongoose
- Knowledge of async/await patterns

## Scenario

You'll build a banking system that allows money transfers between accounts. This requires atomic operations to ensure data consistency - if money is debited from one account, it must be credited to another account, or the entire operation should fail.

## Instructions

### Part 1: Project Setup and Mongoose Models

1. **Create a new Node.js project:**

   ```bash
   mkdir mongodb-transactions-lab
   cd mongodb-transactions-lab
   npm init -y
   ```

2. **Install required dependencies:**

   ```bash
   npm install mongoose express dotenv
   npm install --save-dev nodemon
   ```

3. **Create the project structure:**

   ```
   mongodb-transactions-lab/
   ├── models/
   │   ├── Account.js
   │   └── Transfer.js
   ├── services/
   │   └── TransferService.js
   ├── routes/
   │   └── api.js
   ├── config/
   │   └── database.js
   ├── server.js
   ├── .env
   └── package.json
   ```

4. **Define Mongoose models for related collections:**
   - **Account Model**: Store account information (id, userId, balance, currency)
   - **Transfer Model**: Record all transfer transactions (from, to, amount, status, timestamp)

### Part 2: Database Configuration and Connection

1. **Set up MongoDB connection with transactions support:**

   - Configure MongoDB with replica set (required for transactions)
   - Create a database configuration file
   - Handle connection errors and retries

2. **Environment variables setup:**
   - MongoDB connection string
   - Database name
   - Server port configuration

### Part 3: Transaction Logic Implementation

1. **Implement atomic money transfer operations:**

   - Validate account existence and sufficient funds
   - Use Mongoose transactions for multi-document updates
   - Ensure both debit and credit operations succeed or fail together

2. **Add comprehensive error handling:**

   - Transaction rollback on any failure
   - Specific error messages for different failure scenarios
   - Retry logic for transient failures

3. **Transaction features to implement:**
   - Transfer funds between accounts
   - Validate account balances before transfer
   - Record transfer history
   - Handle concurrent transfer attempts
   - Support for different currencies (bonus)

### Part 4: API Endpoints

1. **Create RESTful API endpoints:**

   - `POST /api/accounts` - Create a new account
   - `GET /api/accounts/:id` - Get account details and balance
   - `POST /api/transfers` - Initiate a money transfer
   - `GET /api/transfers/:id` - Get transfer details
   - `GET /api/accounts/:id/transfers` - Get account transfer history

2. **Add request validation:**

   - Validate transfer amounts (positive numbers)
   - Check account existence before transfers
   - Validate currency matching (if multi-currency)

3. **Implement proper HTTP responses:**
   - Success responses with transfer confirmation
   - Error responses with detailed error messages
   - Appropriate HTTP status codes

### Part 5: Testing and Validation

1. **Test transaction scenarios:**

   - Successful transfers between accounts
   - Failed transfers (insufficient funds)
   - Concurrent transfer attempts
   - Database connection failures during transactions

2. **Verify data consistency:**
   - Check that account balances are always accurate
   - Ensure transfer records match account changes
   - Test rollback behavior on failures

### Part 6: Extensions (Time Permitting)

1. **Advanced features:**

   - Multi-currency support with exchange rates
   - Transfer limits and daily spending caps
   - Account freezing/unfreezing functionality
   - Scheduled transfers

2. **Security and audit:**
   - Transaction logging and audit trails
   - User authentication and authorization
   - Rate limiting for transfer endpoints
   - Fraud detection patterns

## Key Concepts to Understand

### ACID Properties in MongoDB

- **Atomicity**: All operations in a transaction succeed or fail together
- **Consistency**: Database remains in a valid state before and after transaction
- **Isolation**: Concurrent transactions don't interfere with each other
- **Durability**: Committed transactions survive system failures

### Transaction Best Practices

- Keep transactions short and simple
- Avoid long-running operations in transactions
- Handle retries for transient failures
- Use appropriate isolation levels
- Monitor transaction performance

## Deliverables

### Required Submissions

1. **Complete working code** with all models, services, and API endpoints
2. **Demonstration of successful transaction** with before/after account balances
3. **Error handling example** showing transaction rollback on failure
4. **Brief documentation** explaining:
   - How transactions ensure data consistency
   - What happens during rollback scenarios
   - Why transactions are critical for financial operations

### Bonus Points

- Multi-currency support implementation
- Comprehensive error handling with specific error messages
- Performance testing with concurrent transactions
- Security features (authentication, rate limiting)

## Testing Your Implementation

### Manual Testing Commands

```bash
# Create two accounts
curl -X POST http://localhost:3000/api/accounts \
  -H "Content-Type: application/json" \
  -d '{"userId": "user1", "initialBalance": 1000, "currency": "USD"}'

curl -X POST http://localhost:3000/api/accounts \
  -H "Content-Type: application/json" \
  -d '{"userId": "user2", "initialBalance": 500, "currency": "USD"}'

# Transfer money
curl -X POST http://localhost:3000/api/transfers \
  -H "Content-Type: application/json" \
  -d '{"fromAccount": "ACCOUNT_ID_1", "toAccount": "ACCOUNT_ID_2", "amount": 100}'

# Check account balances
curl http://localhost:3000/api/accounts/ACCOUNT_ID_1
curl http://localhost:3000/api/accounts/ACCOUNT_ID_2
```

### Test Scenarios to Verify

1. **Normal transfer**: Transfer money between accounts with sufficient funds
2. **Insufficient funds**: Try to transfer more money than available
3. **Invalid accounts**: Transfer to/from non-existent accounts
4. **Concurrent transfers**: Multiple simultaneous transfers from same account
5. **Database failure**: Simulate connection loss during transaction

## Resources

### Documentation

- [Mongoose Transactions](https://mongoosejs.com/docs/transactions.html)
- [MongoDB Transactions](https://www.mongodb.com/docs/manual/core/transactions/)
- [MongoDB ACID Transactions](https://www.mongodb.com/docs/manual/core/transactions-production-consideration/)

### Additional Reading

- [Transaction Best Practices](https://www.mongodb.com/docs/manual/core/transactions-production-consideration/)
- [Mongoose Session Management](https://mongoosejs.com/docs/transactions.html#sessions)
- [Error Handling in Transactions](https://www.mongodb.com/docs/manual/core/transactions/#transactions-and-atomicity)

---

**Important Notes:**

- MongoDB transactions require a replica set, even for development
- Keep transactions short to avoid performance issues
- Always handle transaction errors and implement proper rollback
- Test edge cases thoroughly, especially concurrent operations

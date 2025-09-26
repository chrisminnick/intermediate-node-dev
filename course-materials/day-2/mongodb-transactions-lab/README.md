# MongoDB Transactions Lab

A complete banking system implementation demonstrating MongoDB transactions for atomic money transfers using Node.js, Express, and Mongoose.

## Features

- ✅ **Atomic Money Transfers** - Multi-document operations with full ACID compliance
- ✅ **Account Management** - Create, update, and manage bank accounts
- ✅ **Transaction Safety** - Automatic rollback on any failure
- ✅ **Transfer History** - Complete audit trail of all transactions
- ✅ **Daily Limits** - Configurable daily transfer limits per account
- ✅ **Multi-Currency Support** - Support for different currencies (USD, EUR, GBP, etc.)
- ✅ **Account Status Management** - Active, frozen, and closed account states
- ✅ **Comprehensive Error Handling** - Detailed error messages and proper HTTP status codes
- ✅ **Transfer Cancellation** - Cancel pending transfers with automatic reversals
- ✅ **Statistics and Reporting** - Account and transfer analytics

## Quick Start

### Prerequisites

1. **MongoDB with Replica Set** (required for transactions)

   ```bash
   # Start MongoDB with replica set
   mongod --replSet rs0 --port 27017 --dbpath /path/to/data

   # Initialize replica set (first time only)
   mongosh
   rs.initiate()
   ```

2. **Node.js** (v14 or higher)

### Installation

1. **Clone and setup:**

   ```bash
   cd mongodb-transactions-lab
   npm install
   ```

2. **Configure environment:**

   ```bash
   cp .env.example .env
   # Edit .env with your MongoDB connection string
   ```

3. **Start the server:**

   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm start
   ```

4. **Test the API:**
   - Server runs on `http://localhost:3000`
   - Visit `http://localhost:3000` for API documentation
   - Health check: `GET /api/health`

## API Endpoints

### Account Management

| Method | Endpoint                      | Description                  |
| ------ | ----------------------------- | ---------------------------- |
| POST   | `/api/accounts`               | Create a new account         |
| GET    | `/api/accounts/:id`           | Get account details          |
| GET    | `/api/accounts/user/:userId`  | Get all accounts for a user  |
| PATCH  | `/api/accounts/:id/status`    | Update account status        |
| GET    | `/api/accounts/:id/transfers` | Get account transfer history |
| GET    | `/api/accounts/:id/stats`     | Get account statistics       |

### Transfer Operations

| Method | Endpoint                            | Description           |
| ------ | ----------------------------------- | --------------------- |
| POST   | `/api/transfers`                    | Create a new transfer |
| GET    | `/api/transfers/:transferId`        | Get transfer details  |
| POST   | `/api/transfers/:transferId/cancel` | Cancel a transfer     |

### System

| Method | Endpoint      | Description                      |
| ------ | ------------- | -------------------------------- |
| GET    | `/`           | API documentation                |
| GET    | `/api/health` | Health check and database status |

## Usage Examples

### 1. Create Accounts

```bash
# Create first account
curl -X POST http://localhost:3000/api/accounts \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "alice",
    "initialBalance": 1000,
    "currency": "USD",
    "accountType": "checking"
  }'

# Create second account
curl -X POST http://localhost:3000/api/accounts \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "bob",
    "initialBalance": 500,
    "currency": "USD",
    "accountType": "savings"
  }'
```

### 2. Transfer Money

```bash
# Transfer $100 from Alice to Bob
curl -X POST http://localhost:3000/api/transfers \
  -H "Content-Type: application/json" \
  -d '{
    "fromAccount": "ALICE_ACCOUNT_ID",
    "toAccount": "BOB_ACCOUNT_ID",
    "amount": 100,
    "description": "Payment for services",
    "initiatedBy": "alice"
  }'
```

### 3. Check Account Balance

```bash
# Get Alice's account details
curl http://localhost:3000/api/accounts/ALICE_ACCOUNT_ID

# Get Bob's account details
curl http://localhost:3000/api/accounts/BOB_ACCOUNT_ID
```

### 4. View Transfer History

```bash
# Get Alice's transfer history
curl http://localhost:3000/api/accounts/ALICE_ACCOUNT_ID/transfers

# Get specific transfer details
curl http://localhost:3000/api/transfers/TRANSFER_ID
```

## Transaction Implementation

### How Transactions Work

The lab demonstrates MongoDB transactions using the following pattern:

```javascript
const session = await mongoose.startSession();

try {
  const result = await session.withTransaction(async () => {
    // 1. Fetch and lock both accounts
    const [fromAccount, toAccount] = await Promise.all([
      Account.findById(fromAccountId).session(session),
      Account.findById(toAccountId).session(session),
    ]);

    // 2. Validate transfer conditions
    if (!fromAccount.canTransfer(amount)) {
      throw new Error('Transfer not allowed');
    }

    // 3. Update balances atomically
    fromAccount.balance -= amount;
    toAccount.balance += amount;

    // 4. Save all changes in transaction
    await fromAccount.save({ session });
    await toAccount.save({ session });
    await transfer.save({ session });

    return { success: true, transfer };
  });

  return result;
} catch (error) {
  // Transaction automatically rolled back
  return { success: false, error: error.message };
} finally {
  await session.endSession();
}
```

### Key Transaction Benefits

1. **Atomicity**: All operations succeed or fail together
2. **Consistency**: Database remains in valid state
3. **Isolation**: Concurrent transactions don't interfere
4. **Durability**: Committed changes survive system failures

## Testing Transaction Scenarios

### 1. Successful Transfer

```bash
# Should succeed and update both account balances
curl -X POST http://localhost:3000/api/transfers \
  -H "Content-Type: application/json" \
  -d '{"fromAccount": "ID1", "toAccount": "ID2", "amount": 50, "initiatedBy": "test"}'
```

### 2. Insufficient Funds

```bash
# Should fail and leave balances unchanged
curl -X POST http://localhost:3000/api/transfers \
  -H "Content-Type: application/json" \
  -d '{"fromAccount": "ID1", "toAccount": "ID2", "amount": 999999, "initiatedBy": "test"}'
```

### 3. Invalid Account

```bash
# Should fail with account not found error
curl -X POST http://localhost:3000/api/transfers \
  -H "Content-Type: application/json" \
  -d '{"fromAccount": "invalid_id", "toAccount": "ID2", "amount": 50, "initiatedBy": "test"}'
```

### 4. Concurrent Transfers

```bash
# Run multiple transfers simultaneously to test transaction isolation
for i in {1..5}; do
  curl -X POST http://localhost:3000/api/transfers \
    -H "Content-Type: application/json" \
    -d '{"fromAccount": "ID1", "toAccount": "ID2", "amount": 10, "initiatedBy": "test'$i'"}' &
done
wait
```

## Data Models

### Account Schema

- `userId`: User identifier
- `accountNumber`: Unique account number (auto-generated)
- `balance`: Account balance (stored as cents for precision)
- `currency`: Account currency (USD, EUR, GBP, etc.)
- `status`: Account status (active, frozen, closed)
- `dailyTransferLimit`: Maximum daily transfer amount
- `accountType`: Type of account (checking, savings, business)

### Transfer Schema

- `transferId`: Unique transfer identifier
- `fromAccount`: Source account reference
- `toAccount`: Destination account reference
- `amount`: Transfer amount (stored as cents)
- `status`: Transfer status (pending, completed, failed, cancelled)
- `balanceBefore`/`balanceAfter`: Audit trail of balance changes
- `fees`: Transfer and exchange fees
- `metadata`: Additional transfer information

## Error Handling

The API provides comprehensive error handling with specific error codes:

- `ACCOUNT_NOT_FOUND`: Account doesn't exist
- `INSUFFICIENT_FUNDS`: Not enough balance for transfer
- `ACCOUNT_INACTIVE`: Account is frozen or closed
- `DAILY_LIMIT_EXCEEDED`: Transfer exceeds daily limit
- `CURRENCY_MISMATCH`: Currency conversion not supported
- `VALIDATION_ERROR`: Invalid input parameters
- `TRANSACTION_ERROR`: Database transaction failed

## Development Notes

### MongoDB Replica Set Setup

Transactions require a MongoDB replica set. For development:

```bash
# Start MongoDB with replica set
mongod --replSet rs0 --port 27017

# Connect and initialize (first time only)
mongosh
rs.initiate({
  _id: "rs0",
  members: [{ _id: 0, host: "localhost:27017" }]
})
```

### Performance Considerations

- Keep transactions short and simple
- Avoid long-running operations in transactions
- Use appropriate indexes for query performance
- Monitor transaction retry patterns
- Consider sharding implications for large deployments

## Extension Ideas

- **Multi-currency transfers** with real-time exchange rates
- **Scheduled transfers** with cron job processing
- **Fraud detection** with pattern analysis
- **Account notifications** via email/SMS
- **Mobile API** with authentication
- **Admin dashboard** for monitoring
- **Backup and recovery** procedures

## License

MIT License - Feel free to use this code for educational purposes.

---

**Important**: This is a educational lab implementation. For production use, additional security, monitoring, and compliance features would be required.

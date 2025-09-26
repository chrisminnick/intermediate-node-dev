const express = require('express');
const Account = require('../models/Account');
const Transfer = require('../models/Transfer');
const TransferService = require('../services/TransferService');
const { checkDatabaseHealth, getDatabaseStats } = require('../config/database');

const router = express.Router();

// Middleware for request validation
const validateAccount = (req, res, next) => {
  const { userId, initialBalance, currency } = req.body;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'userId is required and must be a string',
    });
  }

  if (
    initialBalance !== undefined &&
    (typeof initialBalance !== 'number' || initialBalance < 0)
  ) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'initialBalance must be a non-negative number',
    });
  }

  next();
};

const validateTransfer = (req, res, next) => {
  const { fromAccount, toAccount, amount } = req.body;

  if (!fromAccount || !toAccount) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'fromAccount and toAccount are required',
    });
  }

  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'amount must be a positive number',
    });
  }

  if (fromAccount === toAccount) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Cannot transfer to the same account',
    });
  }

  next();
};

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    const dbHealth = await checkDatabaseHealth();
    const dbStats = await getDatabaseStats();

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      api: 'MongoDB Transactions Lab API',
      version: '1.0.0',
      database: {
        ...dbHealth,
        ...dbStats,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'HEALTH_CHECK_FAILED',
      message: error.message,
    });
  }
});

// Account endpoints

/**
 * Create a new account
 * POST /api/accounts
 */
router.post('/accounts', validateAccount, async (req, res) => {
  try {
    const {
      userId,
      initialBalance = 0,
      currency = 'USD',
      accountType = 'checking',
    } = req.body;

    const account = new Account({
      userId,
      balance: initialBalance,
      currency: currency.toUpperCase(),
      accountType,
      metadata: {
        createdBy: req.ip,
        notes: req.body.notes || '',
      },
    });

    await account.save();

    console.log(
      `✅ Created account ${account.accountNumber} for user ${userId}`
    );

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      account: {
        id: account._id,
        accountNumber: account.accountNumber,
        userId: account.userId,
        balance: account.balance,
        currency: account.currency,
        accountType: account.accountType,
        status: account.status,
        formattedBalance: account.formattedBalance,
        createdAt: account.createdAt,
      },
    });
  } catch (error) {
    console.error('Account creation error:', error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'DUPLICATE_ACCOUNT',
        message: 'Account number already exists',
      });
    }

    res.status(500).json({
      success: false,
      error: 'ACCOUNT_CREATION_FAILED',
      message: error.message,
    });
  }
});

/**
 * Get account by ID
 * GET /api/accounts/:id
 */
router.get('/accounts/:id', async (req, res) => {
  try {
    const account = await Account.findById(req.params.id);

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'ACCOUNT_NOT_FOUND',
        message: 'Account not found',
      });
    }

    res.json({
      success: true,
      account: {
        id: account._id,
        accountNumber: account.accountNumber,
        userId: account.userId,
        balance: account.balance,
        currency: account.currency,
        accountType: account.accountType,
        status: account.status,
        formattedBalance: account.formattedBalance,
        dailyTransferLimit: account.dailyTransferLimit,
        totalTransferredToday: account.totalTransferredToday,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get account error:', error);
    res.status(500).json({
      success: false,
      error: 'ACCOUNT_FETCH_FAILED',
      message: error.message,
    });
  }
});

/**
 * Get accounts by user ID
 * GET /api/accounts/user/:userId
 */
router.get('/accounts/user/:userId', async (req, res) => {
  try {
    const accounts = await Account.findByUserId(req.params.userId);

    res.json({
      success: true,
      accounts: accounts.map((account) => ({
        id: account._id,
        accountNumber: account.accountNumber,
        balance: account.balance,
        currency: account.currency,
        accountType: account.accountType,
        status: account.status,
        formattedBalance: account.formattedBalance,
        createdAt: account.createdAt,
      })),
      count: accounts.length,
    });
  } catch (error) {
    console.error('Get user accounts error:', error);
    res.status(500).json({
      success: false,
      error: 'ACCOUNTS_FETCH_FAILED',
      message: error.message,
    });
  }
});

/**
 * Update account status
 * PATCH /api/accounts/:id/status
 */
router.patch('/accounts/:id/status', async (req, res) => {
  try {
    const { status } = req.body;

    if (!['active', 'frozen', 'closed'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Invalid status. Must be: active, frozen, or closed',
      });
    }

    const account = await Account.findByIdAndUpdate(
      req.params.id,
      { status, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'ACCOUNT_NOT_FOUND',
        message: 'Account not found',
      });
    }

    console.log(
      `✅ Updated account ${account.accountNumber} status to ${status}`
    );

    res.json({
      success: true,
      message: `Account status updated to ${status}`,
      account: {
        id: account._id,
        accountNumber: account.accountNumber,
        status: account.status,
        updatedAt: account.updatedAt,
      },
    });
  } catch (error) {
    console.error('Update account status error:', error);
    res.status(500).json({
      success: false,
      error: 'STATUS_UPDATE_FAILED',
      message: error.message,
    });
  }
});

// Transfer endpoints

/**
 * Create a new transfer
 * POST /api/transfers
 */
router.post('/transfers', validateTransfer, async (req, res) => {
  try {
    const { fromAccount, toAccount, amount, description, reference } = req.body;

    const result = await TransferService.transferFunds({
      fromAccountId: fromAccount,
      toAccountId: toAccount,
      amount: amount,
      description: description,
      reference: reference,
      initiatedBy: req.body.initiatedBy || 'api-user',
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date(),
      },
    });

    if (result.success) {
      res.status(201).json({
        success: true,
        message: 'Transfer completed successfully',
        transfer: {
          id: result.transfer._id,
          transferId: result.transfer.transferId,
          amount: result.transfer.amount,
          currency: result.transfer.currency,
          status: result.transfer.status,
          formattedAmount: result.transfer.formattedAmount,
          fees: result.transfer.fees,
          createdAt: result.transfer.createdAt,
          processedAt: result.transfer.processedAt,
        },
        balances: result.balances,
      });
    } else {
      const statusCode =
        result.errorCode === 'INSUFFICIENT_FUNDS'
          ? 400
          : result.errorCode === 'ACCOUNT_NOT_FOUND'
          ? 404
          : 500;

      res.status(statusCode).json({
        success: false,
        error: result.errorCode,
        message: result.error,
        transferId: result.transferId,
      });
    }
  } catch (error) {
    console.error('Transfer creation error:', error);
    res.status(500).json({
      success: false,
      error: 'TRANSFER_FAILED',
      message: error.message,
    });
  }
});

/**
 * Get transfer by ID
 * GET /api/transfers/:transferId
 */
router.get('/transfers/:transferId', async (req, res) => {
  try {
    const result = await TransferService.getTransferById(req.params.transferId);

    if (result.success) {
      res.json({
        success: true,
        transfer: result.transfer,
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'TRANSFER_NOT_FOUND',
        message: result.error,
      });
    }
  } catch (error) {
    console.error('Get transfer error:', error);
    res.status(500).json({
      success: false,
      error: 'TRANSFER_FETCH_FAILED',
      message: error.message,
    });
  }
});

/**
 * Get account transfer history
 * GET /api/accounts/:id/transfers
 */
router.get('/accounts/:id/transfers', async (req, res) => {
  try {
    const { limit = 50, status, startDate, endDate } = req.query;
    const options = {
      limit: parseInt(limit),
      status,
      startDate,
      endDate,
    };

    const result = await TransferService.getTransferHistory(
      req.params.id,
      options
    );

    if (result.success) {
      res.json({
        success: true,
        transfers: result.transfers,
        count: result.count,
        filters: options,
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'TRANSFER_HISTORY_FAILED',
        message: result.error,
      });
    }
  } catch (error) {
    console.error('Get transfer history error:', error);
    res.status(500).json({
      success: false,
      error: 'TRANSFER_HISTORY_FAILED',
      message: error.message,
    });
  }
});

/**
 * Cancel a transfer
 * POST /api/transfers/:transferId/cancel
 */
router.post('/transfers/:transferId/cancel', async (req, res) => {
  try {
    const result = await TransferService.cancelTransfer(
      req.params.transferId,
      req.body.cancelledBy || 'api-user'
    );

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        transfer: {
          transferId: result.transfer.transferId,
          status: result.transfer.status,
          processedAt: result.transfer.processedAt,
        },
      });
    } else {
      const statusCode = result.error.includes('not found') ? 404 : 400;
      res.status(statusCode).json({
        success: false,
        error: result.error.includes('not found')
          ? 'TRANSFER_NOT_FOUND'
          : 'CANCELLATION_FAILED',
        message: result.error,
      });
    }
  } catch (error) {
    console.error('Cancel transfer error:', error);
    res.status(500).json({
      success: false,
      error: 'CANCELLATION_FAILED',
      message: error.message,
    });
  }
});

/**
 * Get transfer statistics for an account
 * GET /api/accounts/:id/stats
 */
router.get('/accounts/:id/stats', async (req, res) => {
  try {
    const { period = 30 } = req.query;
    const result = await TransferService.getTransferStats(
      req.params.id,
      parseInt(period)
    );

    if (result.success) {
      res.json({
        success: true,
        stats: result.stats,
        period: result.period,
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'STATS_FETCH_FAILED',
        message: result.error,
      });
    }
  } catch (error) {
    console.error('Get transfer stats error:', error);
    res.status(500).json({
      success: false,
      error: 'STATS_FETCH_FAILED',
      message: error.message,
    });
  }
});

module.exports = router;

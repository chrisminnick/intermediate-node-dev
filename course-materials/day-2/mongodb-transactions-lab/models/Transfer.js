const mongoose = require('mongoose');

const transferSchema = new mongoose.Schema(
  {
    transferId: {
      type: String,
      required: true,
      unique: true,
      default: () =>
        `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    },
    fromAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
      index: true,
    },
    toAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, 'Transfer amount must be greater than 0'],
      // Store as cents to avoid floating point precision issues
      get: (value) => value / 100,
      set: (value) => Math.round(value * 100),
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      default: 'USD',
    },
    exchangeRate: {
      type: Number,
      default: 1.0,
      min: 0.001,
    },
    convertedAmount: {
      type: Number,
      // Amount in destination account's currency
      get: (value) => (value ? value / 100 : undefined),
      set: (value) => (value ? Math.round(value * 100) : undefined),
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'cancelled', 'refunded'],
      default: 'pending',
      index: true,
    },
    type: {
      type: String,
      enum: ['transfer', 'deposit', 'withdrawal', 'refund'],
      default: 'transfer',
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    reference: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    initiatedBy: {
      type: String,
      required: true,
      trim: true,
    },
    processedAt: {
      type: Date,
      default: null,
    },
    failureReason: {
      type: String,
      trim: true,
    },
    metadata: {
      ipAddress: String,
      userAgent: String,
      apiVersion: String,
      clientId: String,
    },
    fees: {
      transferFee: {
        type: Number,
        default: 0,
        get: (value) => value / 100,
        set: (value) => Math.round(value * 100),
      },
      exchangeFee: {
        type: Number,
        default: 0,
        get: (value) => value / 100,
        set: (value) => Math.round(value * 100),
      },
      totalFees: {
        type: Number,
        default: 0,
        get: (value) => value / 100,
        set: (value) => Math.round(value * 100),
      },
    },
    // Balances before and after for audit trail
    balanceBefore: {
      fromAccount: {
        type: Number,
        get: (value) => value / 100,
        set: (value) => Math.round(value * 100),
      },
      toAccount: {
        type: Number,
        get: (value) => value / 100,
        set: (value) => Math.round(value * 100),
      },
    },
    balanceAfter: {
      fromAccount: {
        type: Number,
        get: (value) => value / 100,
        set: (value) => Math.round(value * 100),
      },
      toAccount: {
        type: Number,
        get: (value) => value / 100,
        set: (value) => Math.round(value * 100),
      },
    },
  },
  {
    timestamps: true,
    toJSON: {
      getters: true,
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
    toObject: { getters: true },
  }
);

// Compound indexes for performance
transferSchema.index({ fromAccount: 1, createdAt: -1 });
transferSchema.index({ toAccount: 1, createdAt: -1 });
transferSchema.index({ status: 1, createdAt: -1 });
transferSchema.index({ transferId: 1 }, { unique: true });
transferSchema.index({ initiatedBy: 1, createdAt: -1 });

// Virtual for formatted amount
transferSchema.virtual('formattedAmount').get(function () {
  return `${this.currency} ${this.amount.toFixed(2)}`;
});

// Virtual for total amount including fees
transferSchema.virtual('totalAmount').get(function () {
  return this.amount + (this.fees.totalFees || 0);
});

// Instance methods
transferSchema.methods.markCompleted = function (fromBalance, toBalance) {
  this.status = 'completed';
  this.processedAt = new Date();
  this.balanceAfter = {
    fromAccount: fromBalance,
    toAccount: toBalance,
  };
  this.failureReason = undefined;
};

transferSchema.methods.markFailed = function (reason) {
  this.status = 'failed';
  this.processedAt = new Date();
  this.failureReason = reason;
};

transferSchema.methods.calculateFees = function () {
  // Simple fee calculation - could be more complex in real system
  let transferFee = 0;
  let exchangeFee = 0;

  // Transfer fee: $1 for amounts over $100
  if (this.amount > 100) {
    transferFee = 1.0;
  }

  // Exchange fee: 1% for currency conversion
  if (this.exchangeRate !== 1.0) {
    exchangeFee = this.amount * 0.01;
  }

  this.fees = {
    transferFee,
    exchangeFee,
    totalFees: transferFee + exchangeFee,
  };

  return this.fees.totalFees;
};

// Static methods
transferSchema.statics.findByAccount = function (accountId, options = {}) {
  const { limit = 50, status, startDate, endDate } = options;

  let query = {
    $or: [{ fromAccount: accountId }, { toAccount: accountId }],
  };

  if (status) {
    query.status = status;
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  return this.find(query)
    .populate('fromAccount', 'accountNumber userId currency')
    .populate('toAccount', 'accountNumber userId currency')
    .sort({ createdAt: -1 })
    .limit(limit);
};

transferSchema.statics.findByTransferId = function (transferId) {
  return this.findOne({ transferId })
    .populate('fromAccount', 'accountNumber userId balance currency status')
    .populate('toAccount', 'accountNumber userId balance currency status');
};

transferSchema.statics.getTransferStats = function (accountId, period = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - period);

  return this.aggregate([
    {
      $match: {
        $or: [{ fromAccount: accountId }, { toAccount: accountId }],
        createdAt: { $gte: startDate },
        status: 'completed',
      },
    },
    {
      $group: {
        _id: null,
        totalTransfers: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        avgAmount: { $avg: '$amount' },
        totalFees: { $sum: '$fees.totalFees' },
      },
    },
  ]);
};

// Pre-save middleware
transferSchema.pre('save', function (next) {
  if (this.isNew) {
    // Calculate fees for new transfers
    this.calculateFees();

    // Set converted amount if different currency
    if (this.exchangeRate && this.exchangeRate !== 1.0) {
      this.convertedAmount = this.amount * this.exchangeRate;
    } else {
      this.convertedAmount = this.amount;
    }
  }
  next();
});

module.exports = mongoose.model('Transfer', transferSchema);

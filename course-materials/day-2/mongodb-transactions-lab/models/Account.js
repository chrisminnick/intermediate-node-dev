const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    accountNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    accountType: {
      type: String,
      enum: ['checking', 'savings', 'business'],
      default: 'checking',
    },
    balance: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      // Store as cents to avoid floating point precision issues
      get: (value) => value / 100,
      set: (value) => Math.round(value * 100),
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      default: 'USD',
      enum: ['USD', 'EUR', 'GBP', 'JPY', 'CAD'],
    },
    status: {
      type: String,
      enum: ['active', 'frozen', 'closed'],
      default: 'active',
    },
    dailyTransferLimit: {
      type: Number,
      default: 500000, // $5000 in cents
      get: (value) => value / 100,
      set: (value) => Math.round(value * 100),
    },
    totalTransferredToday: {
      type: Number,
      default: 0,
      get: (value) => value / 100,
      set: (value) => Math.round(value * 100),
    },
    lastTransferDate: {
      type: Date,
      default: null,
    },
    metadata: {
      createdBy: String,
      notes: String,
      tags: [String],
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

// Indexes for performance
accountSchema.index({ userId: 1, status: 1 });
accountSchema.index({ accountNumber: 1 }, { unique: true });
accountSchema.index({ createdAt: -1 });

// Virtual for formatted balance
accountSchema.virtual('formattedBalance').get(function () {
  return `${this.currency} ${this.balance.toFixed(2)}`;
});

// Instance methods
accountSchema.methods.canTransfer = function (amount) {
  if (this.status !== 'active') {
    return { allowed: false, reason: 'Account is not active' };
  }

  if (this.balance < amount) {
    return { allowed: false, reason: 'Insufficient funds' };
  }

  // Check daily transfer limit
  const today = new Date().toDateString();
  const lastTransferDate = this.lastTransferDate
    ? this.lastTransferDate.toDateString()
    : null;

  let todayTransferred = 0;
  if (lastTransferDate === today) {
    todayTransferred = this.totalTransferredToday;
  }

  if (todayTransferred + amount > this.dailyTransferLimit) {
    return {
      allowed: false,
      reason: `Daily transfer limit exceeded. Limit: ${
        this.currency
      } ${this.dailyTransferLimit.toFixed(2)}, Already transferred today: ${
        this.currency
      } ${todayTransferred.toFixed(2)}`,
    };
  }

  return { allowed: true };
};

accountSchema.methods.updateDailyTransferAmount = function (amount) {
  const today = new Date().toDateString();
  const lastTransferDate = this.lastTransferDate
    ? this.lastTransferDate.toDateString()
    : null;

  if (lastTransferDate !== today) {
    // Reset daily counter for new day
    this.totalTransferredToday = amount;
  } else {
    // Add to existing daily total
    this.totalTransferredToday += amount;
  }

  this.lastTransferDate = new Date();
};

// Static methods
accountSchema.statics.generateAccountNumber = async function () {
  let accountNumber;
  let exists = true;

  while (exists) {
    // Generate 10-digit account number
    accountNumber = Math.floor(
      1000000000 + Math.random() * 9000000000
    ).toString();
    exists = await this.findOne({ accountNumber });
  }

  return accountNumber;
};

accountSchema.statics.findByUserId = function (userId) {
  return this.find({ userId, status: { $ne: 'closed' } }).sort({
    createdAt: -1,
  });
};

// Pre-save middleware
accountSchema.pre('save', async function (next) {
  if (this.isNew && !this.accountNumber) {
    this.accountNumber = await this.constructor.generateAccountNumber();
  }
  next();
});

// Pre-save validation
accountSchema.pre('save', function (next) {
  if (this.balance < 0) {
    next(new Error('Account balance cannot be negative'));
  }
  next();
});

module.exports = mongoose.model('Account', accountSchema);

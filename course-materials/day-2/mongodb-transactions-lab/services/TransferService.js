const mongoose = require('mongoose');
const Account = require('../models/Account');
const Transfer = require('../models/Transfer');

class TransferService {
  /**
   * Transfer funds between two accounts using MongoDB transactions
   * @param {Object} transferData - Transfer details
   * @param {string} transferData.fromAccountId - Source account ID
   * @param {string} transferData.toAccountId - Destination account ID
   * @param {number} transferData.amount - Transfer amount
   * @param {string} transferData.initiatedBy - User initiating the transfer
   * @param {string} transferData.description - Transfer description
   * @param {string} transferData.reference - Transfer reference
   * @returns {Promise<Object>} Transfer result
   */
  async transferFunds(transferData) {
    const session = await mongoose.startSession();

    try {
      console.log(
        `🔄 Starting transfer: ${transferData.amount} from ${transferData.fromAccountId} to ${transferData.toAccountId}`
      );

      const result = await session.withTransaction(
        async () => {
          // Step 1: Fetch and lock both accounts
          const [fromAccount, toAccount] = await Promise.all([
            Account.findById(transferData.fromAccountId).session(session),
            Account.findById(transferData.toAccountId).session(session),
          ]);

          // Step 2: Validate accounts exist
          if (!fromAccount) {
            throw new Error(
              `Source account not found: ${transferData.fromAccountId}`
            );
          }

          if (!toAccount) {
            throw new Error(
              `Destination account not found: ${transferData.toAccountId}`
            );
          }

          // Step 3: Validate account status and transfer eligibility
          const canTransfer = fromAccount.canTransfer(transferData.amount);
          if (!canTransfer.allowed) {
            throw new Error(`Transfer not allowed: ${canTransfer.reason}`);
          }

          if (toAccount.status !== 'active') {
            throw new Error(
              `Destination account is not active: ${toAccount.status}`
            );
          }

          // Step 4: Check currency compatibility
          if (fromAccount.currency !== toAccount.currency) {
            throw new Error(
              `Currency mismatch: ${fromAccount.currency} to ${toAccount.currency}. Multi-currency transfers not implemented.`
            );
          }

          // Step 5: Create transfer record
          const transfer = new Transfer({
            fromAccount: fromAccount._id,
            toAccount: toAccount._id,
            amount: transferData.amount,
            currency: fromAccount.currency,
            description:
              transferData.description ||
              `Transfer to ${toAccount.accountNumber}`,
            reference: transferData.reference,
            initiatedBy: transferData.initiatedBy,
            balanceBefore: {
              fromAccount: fromAccount.balance,
              toAccount: toAccount.balance,
            },
            metadata: transferData.metadata || {},
          });

          // Step 6: Calculate total amount including fees
          const totalFees = transfer.calculateFees();
          const totalAmount = transferData.amount + totalFees;

          // Verify sufficient funds including fees
          if (fromAccount.balance < totalAmount) {
            throw new Error(
              `Insufficient funds including fees. Required: ${totalAmount.toFixed(
                2
              )}, Available: ${fromAccount.balance.toFixed(2)}`
            );
          }

          // Step 7: Update account balances
          fromAccount.balance -= totalAmount;
          toAccount.balance += transferData.amount; // Fees are deducted from sender only

          // Update daily transfer tracking
          fromAccount.updateDailyTransferAmount(totalAmount);

          // Step 8: Save all changes within transaction
          await transfer.save({ session });
          await fromAccount.save({ session });
          await toAccount.save({ session });

          // Step 9: Mark transfer as completed
          transfer.markCompleted(fromAccount.balance, toAccount.balance);
          await transfer.save({ session });

          console.log(`✅ Transfer completed: ${transfer.transferId}`);

          return {
            success: true,
            transfer: transfer,
            balances: {
              fromAccount: {
                id: fromAccount._id,
                balance: fromAccount.balance,
                currency: fromAccount.currency,
              },
              toAccount: {
                id: toAccount._id,
                balance: toAccount.balance,
                currency: toAccount.currency,
              },
            },
          };
        },
        {
          // Transaction options
          readPreference: 'primary',
          readConcern: { level: 'local' },
          writeConcern: { w: 'majority' },
          maxCommitTimeMS: 1000,
        }
      );

      return result;
    } catch (error) {
      console.error(`❌ Transfer failed: ${error.message}`);

      // Try to create a failed transfer record for audit purposes
      try {
        const failedTransfer = new Transfer({
          fromAccount: transferData.fromAccountId,
          toAccount: transferData.toAccountId,
          amount: transferData.amount,
          currency: 'USD', // Default currency for failed transfers
          description: transferData.description,
          reference: transferData.reference,
          initiatedBy: transferData.initiatedBy,
          status: 'failed',
          failureReason: error.message,
          metadata: transferData.metadata || {},
        });

        await failedTransfer.save(); // Save outside transaction

        return {
          success: false,
          error: error.message,
          transferId: failedTransfer.transferId,
          errorCode: this.getErrorCode(error.message),
        };
      } catch (recordError) {
        console.error('Failed to record failed transfer:', recordError.message);

        return {
          success: false,
          error: error.message,
          errorCode: this.getErrorCode(error.message),
        };
      }
    } finally {
      await session.endSession();
    }
  }

  /**
   * Get transfer history for an account
   * @param {string} accountId - Account ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Transfer history
   */
  async getTransferHistory(accountId, options = {}) {
    try {
      const transfers = await Transfer.findByAccount(accountId, options);
      return {
        success: true,
        transfers,
        count: transfers.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get transfer by ID
   * @param {string} transferId - Transfer ID
   * @returns {Promise<Object>} Transfer details
   */
  async getTransferById(transferId) {
    try {
      const transfer = await Transfer.findByTransferId(transferId);

      if (!transfer) {
        return {
          success: false,
          error: 'Transfer not found',
        };
      }

      return {
        success: true,
        transfer,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Cancel a pending transfer
   * @param {string} transferId - Transfer ID
   * @param {string} cancelledBy - User cancelling the transfer
   * @returns {Promise<Object>} Cancellation result
   */
  async cancelTransfer(transferId, cancelledBy) {
    const session = await mongoose.startSession();

    try {
      const result = await session.withTransaction(async () => {
        const transfer = await Transfer.findOne({ transferId }).session(
          session
        );

        if (!transfer) {
          throw new Error('Transfer not found');
        }

        if (transfer.status !== 'pending') {
          throw new Error(
            `Cannot cancel transfer with status: ${transfer.status}`
          );
        }

        // If transfer was actually processed, we need to reverse it
        if (
          transfer.balanceAfter &&
          transfer.balanceAfter.fromAccount !== undefined
        ) {
          // Reverse the transfer
          const [fromAccount, toAccount] = await Promise.all([
            Account.findById(transfer.fromAccount).session(session),
            Account.findById(transfer.toAccount).session(session),
          ]);

          if (fromAccount && toAccount) {
            fromAccount.balance +=
              transfer.amount + (transfer.fees.totalFees || 0);
            toAccount.balance -= transfer.amount;

            await fromAccount.save({ session });
            await toAccount.save({ session });
          }
        }

        transfer.status = 'cancelled';
        transfer.processedAt = new Date();
        transfer.failureReason = `Cancelled by ${cancelledBy}`;

        await transfer.save({ session });

        return {
          success: true,
          transfer,
          message: 'Transfer cancelled successfully',
        };
      });

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    } finally {
      await session.endSession();
    }
  }

  /**
   * Get transfer statistics for an account
   * @param {string} accountId - Account ID
   * @param {number} period - Period in days
   * @returns {Promise<Object>} Transfer statistics
   */
  async getTransferStats(accountId, period = 30) {
    try {
      const stats = await Transfer.getTransferStats(accountId, period);
      return {
        success: true,
        stats: stats[0] || {
          totalTransfers: 0,
          totalAmount: 0,
          avgAmount: 0,
          totalFees: 0,
        },
        period,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Batch transfer (multiple transfers in one transaction)
   * @param {Array} transfers - Array of transfer objects
   * @returns {Promise<Object>} Batch transfer result
   */
  async batchTransfer(transfers) {
    const session = await mongoose.startSession();

    try {
      const results = await session.withTransaction(async () => {
        const transferResults = [];

        for (const transferData of transfers) {
          // Process each transfer within the same transaction
          const result = await this.processSingleTransfer(
            transferData,
            session
          );
          transferResults.push(result);
        }

        return transferResults;
      });

      return {
        success: true,
        transfers: results,
        count: results.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    } finally {
      await session.endSession();
    }
  }

  /**
   * Helper method to process a single transfer within an existing transaction
   * @private
   */
  async processSingleTransfer(transferData, session) {
    // Implementation similar to transferFunds but using existing session
    // This would be used for batch transfers
    throw new Error('Batch transfers not fully implemented in this lab');
  }

  /**
   * Map error messages to error codes
   * @private
   */
  getErrorCode(errorMessage) {
    if (errorMessage.includes('not found')) return 'ACCOUNT_NOT_FOUND';
    if (errorMessage.includes('Insufficient funds'))
      return 'INSUFFICIENT_FUNDS';
    if (errorMessage.includes('not active')) return 'ACCOUNT_INACTIVE';
    if (errorMessage.includes('Daily transfer limit'))
      return 'DAILY_LIMIT_EXCEEDED';
    if (errorMessage.includes('Currency mismatch')) return 'CURRENCY_MISMATCH';
    return 'TRANSFER_ERROR';
  }
}

module.exports = new TransferService();

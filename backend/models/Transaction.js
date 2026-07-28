const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ["Income", "Expense"],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true,
        description: "Custom category for general accounting"
    },
    date: {
        type: Date,
        default: Date.now,
        required: true
    },
    recordedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    }
}, { timestamps: true });

// Indexes for better query performance
transactionSchema.index({ date: -1 });
transactionSchema.index({ category: 1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ recordedBy: 1 });
transactionSchema.index({ date: -1, category: 1, type: 1 });

module.exports = mongoose.model("Transaction", transactionSchema);

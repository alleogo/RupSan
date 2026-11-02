const mongoose = require('mongoose');

// Transaction Model - Stores financial transactions (income/expenses)

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
    },
    // Who the money was received from (income) or paid to (expense)
    party: {
        type: String,
        trim: true,
        default: ""
    },
    paymentType: {
        type: String,
        enum: ["Cash", "Online", "Cheque", "Other"],
        default: "Cash"
    },
    // e.g. UPI, Bank Transfer, Card, Wallet (mainly for online payments)
    paymentMethod: {
        type: String,
        trim: true,
        default: ""
    },
    // Transaction ID / UTR, cheque number or receipt number
    paymentId: {
        type: String,
        trim: true,
        default: ""
    },
    // Cloudinary URL of the receipt / screenshot / PDF
    paymentProof: {
        type: String,
        default: null
    },
    yatra: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Yatra",
        default: null
    },
    notes: {
        type: String,
        trim: true,
        default: ""
    }
}, { timestamps: true });

// Indexes for better query performance
transactionSchema.index({ date: -1 });
transactionSchema.index({ category: 1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ recordedBy: 1 });
transactionSchema.index({ date: -1, category: 1, type: 1 });
transactionSchema.index({ recordedBy: 1, date: -1 });

module.exports = mongoose.model("Transaction", transactionSchema);
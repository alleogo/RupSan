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
    },
    // The centre whose account this entry belongs to (null for entries from before centre accounts)
    centre: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Centre",
        default: null
    },
    // Soft delete: deleted entries are hidden and can be restored by the centre's admins or the Super Admin
    deletedAt: {
        type: Date,
        default: null
    },
    deletedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    // Audit trail: who created, edited, deleted or restored the entry, and what changed
    history: [{
        _id: false,
        action: { type: String, enum: ["created", "edited", "deleted", "restored", "moved"] },
        by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        at: { type: Date, default: Date.now },
        changes: [{ _id: false, field: String, from: mongoose.Schema.Types.Mixed, to: mongoose.Schema.Types.Mixed }]
    }]
}, { timestamps: true });

// Indexes for better query performance
transactionSchema.index({ date: -1 });
transactionSchema.index({ category: 1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ recordedBy: 1 });
transactionSchema.index({ date: -1, category: 1, type: 1 });
transactionSchema.index({ recordedBy: 1, date: -1 });
transactionSchema.index({ centre: 1, deletedAt: 1, date: -1 });

module.exports = mongoose.model("Transaction", transactionSchema);
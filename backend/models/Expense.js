const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
    yatra: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Yatra",
        required: true
    },
    name: {
        type: String,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    paidBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        description: "The user who made the payment."
    },
    splitAmong: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        description: "The users among whom this expense is split."
    }],
    description: {
        type: String
    }
}, { timestamps: true });

module.exports = mongoose.model("Expense", expenseSchema);

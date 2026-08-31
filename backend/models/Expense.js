const mongoose = require('mongoose');

// Expense Model - Stores yatra-related expenses

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

    description: {
        type: String
    }
}, { timestamps: true });

module.exports = mongoose.model("Expense", expenseSchema);
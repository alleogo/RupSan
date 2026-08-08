const mongoose = require('mongoose');

// Expense Model - Stores yatra-related expenses and split tracking

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

// Post-save hook to log expense creation
expenseSchema.post('save', function(doc) {
    console.log(`[Expense Model] Expense recorded: ${doc.name} ₹${doc.amount}`);
});

// Pre-update hook to log updates
expenseSchema.pre('findByIdAndUpdate', function() {
    console.log(`[Expense Model] Updating expense with ID: ${this.getFilter()._id}`);
});

module.exports = mongoose.model("Expense", expenseSchema);

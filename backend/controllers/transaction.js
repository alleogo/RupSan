const Transaction = require("../models/Transaction");

exports.addTransaction = async (req, res) => {
    try {
        const { type, amount, description, category, date } = req.body;

        if (!type || amount === undefined || !description || !category) {
            return res.status(400).json({ success: false, message: "Required fields are missing" });
        }

        const transaction = await Transaction.create({
            type,
            amount,
            description,
            category,
            date: date ? new Date(date) : Date.now(),
            recordedBy: req.user.id
        });

        return res.status(201).json({
            success: true,
            message: "Transaction logged successfully",
            transaction
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.getTransactions = async (req, res) => {
    try {
        const transactions = await Transaction.find()
            .populate("recordedBy", "firstName lastName")
            .sort({ date: -1 });

        return res.status(200).json({
            success: true,
            transactions
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.getLedgerSummary = async (req, res) => {
    try {
        const transactions = await Transaction.find();
        
        let totalIncome = 0;
        let totalExpense = 0;

        transactions.forEach(t => {
            if (t.type === "Income") {
                totalIncome += t.amount;
            } else if (t.type === "Expense") {
                totalExpense += t.amount;
            }
        });

        return res.status(200).json({
            success: true,
            summary: {
                totalIncome,
                totalExpense,
                balance: totalIncome - totalExpense
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

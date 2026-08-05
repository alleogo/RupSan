const Transaction = require("../models/Transaction");

exports.addTransaction = async (req, res) => {
    try {
        const { type, amount, description, category, date } = req.body;

        if (!type || amount === undefined || !description) {
            return res.status(400).json({ success: false, message: "Required fields are missing" });
        }

        if (!["Income", "Expense"].includes(type)) {
            return res.status(400).json({ success: false, message: "Type must be 'Income' or 'Expense'" });
        }

        if (amount <= 0) {
            return res.status(400).json({ success: false, message: "Amount must be greater than 0" });
        }

        const transaction = await Transaction.create({
            type,
            amount,
            description,
            category: category || type,
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
        const { startDate, endDate, category, type, page = 1, limit = 20 } = req.query;
        
        let filter = { recordedBy: req.user.id };

        // Date range filtering
        if (startDate || endDate) {
            filter.date = {};
            if (startDate) {
                filter.date.$gte = new Date(startDate);
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                filter.date.$lte = end;
            }
        }

        // Category filtering
        if (category) {
            filter.category = category;
        }

        // Type filtering
        if (type && ["Income", "Expense"].includes(type)) {
            filter.type = type;
        }

        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;

        const transactions = await Transaction.find(filter)
            .populate("recordedBy", "firstName lastName")
            .sort({ date: -1 })
            .skip(skip)
            .limit(limitNum);

        const total = await Transaction.countDocuments(filter);

        return res.status(200).json({
            success: true,
            transactions,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.getLedgerSummary = async (req, res) => {
    try {
        const { startDate, endDate, category } = req.query;
        
        let filter = { recordedBy: req.user.id };

        if (startDate || endDate) {
            filter.date = {};
            if (startDate) {
                filter.date.$gte = new Date(startDate);
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                filter.date.$lte = end;
            }
        }

        if (category) {
            filter.category = category;
        }

        const transactions = await Transaction.find(filter);
        
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

exports.updateTransaction = async (req, res) => {
    try {
        const { id } = req.params;
        const { type, amount, description, category, date } = req.body;

        const transaction = await Transaction.findById(id);
        if (!transaction) {
            return res.status(404).json({ success: false, message: "Transaction not found" });
        }

        if (type && !["Income", "Expense"].includes(type)) {
            return res.status(400).json({ success: false, message: "Type must be 'Income' or 'Expense'" });
        }

        if (amount && amount <= 0) {
            return res.status(400).json({ success: false, message: "Amount must be greater than 0" });
        }

        const updated = await Transaction.findByIdAndUpdate(
            id,
            { type, amount, description, category, date: date ? new Date(date) : undefined },
            { new: true, runValidators: true }
        ).populate("recordedBy", "firstName lastName");

        return res.status(200).json({
            success: true,
            message: "Transaction updated successfully",
            transaction: updated
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteTransaction = async (req, res) => {
    try {
        const { id } = req.params;

        const transaction = await Transaction.findByIdAndDelete(id);
        if (!transaction) {
            return res.status(404).json({ success: false, message: "Transaction not found" });
        }

        return res.status(200).json({
            success: true,
            message: "Transaction deleted successfully"
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.getCategories = async (req, res) => {
    try {
        let filter = { recordedBy: req.user.id };
        const categories = await Transaction.distinct("category", filter);
        
        return res.status(200).json({
            success: true,
            categories: categories.sort()
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const Expense = require("../models/Expense");
const { loadManageableYatra, loadVisibleYatra } = require("../utils/yatraAccess");

// Expense Controller - Handles expense tracking and splitting

exports.addExpense = async (req, res) => {
    try {
        const { yatraId, name, amount, description } = req.body;
        console.log(`[addExpense] New expense added to Yatra: ${yatraId}, Amount: ${amount}`);

        if (!yatraId || !name || amount === undefined) {
            return res.status(400).json({ success: false, message: "Required fields are missing" });
        }
        if (!(await loadManageableYatra(req, res, yatraId))) return;

        const expense = await Expense.create({
            yatra: yatraId,
            name,
            amount,
            description
        });

        return res.status(201).json({
            success: true,
            message: "Expense added successfully",
            expense
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.getYatraExpenses = async (req, res) => {
    try {
        const { yatraId } = req.params;
        console.log(`[getYatraExpenses] Fetching expenses for Yatra: ${yatraId}`);
        
        if (!(await loadVisibleYatra(req, res, yatraId))) return;
        const expenses = await Expense.find({ yatra: yatraId });
        
        return res.status(200).json({
            success: true,
            expenses
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateExpense = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, amount, description } = req.body;

        const expense = await Expense.findById(id);
        if (!expense) {
            return res.status(404).json({ success: false, message: "Expense not found" });
        }
        if (!(await loadManageableYatra(req, res, expense.yatra))) return;

        if (name !== undefined) expense.name = name;
        if (amount !== undefined) expense.amount = amount;
        if (description !== undefined) expense.description = description;
        await expense.save();

        return res.status(200).json({
            success: true,
            message: "Expense updated successfully",
            expense
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteExpense = async (req, res) => {
    try {
        const { id } = req.params;
        
        const expense = await Expense.findById(id);
        if (!expense) {
            return res.status(404).json({ success: false, message: "Expense not found" });
        }
        if (!(await loadManageableYatra(req, res, expense.yatra))) return;
        await expense.deleteOne();

        return res.status(200).json({
            success: true,
            message: "Expense deleted successfully"
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

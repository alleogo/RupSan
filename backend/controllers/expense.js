const Expense = require("../models/Expense");
const YatraRegistration = require("../models/YatraRegistration");
const Ticket = require("../models/Ticket");

// Expense Controller - Handles expense tracking and splitting

exports.addExpense = async (req, res) => {
    try {
        const { yatraId, name, amount, splitAmong, description } = req.body;
        console.log(`[addExpense] New expense added to Yatra: ${yatraId}, Amount: ${amount}, Paid by: ${req.user.id}`);

        if (!yatraId || !name || amount === undefined) {
            return res.status(400).json({ success: false, message: "Required fields are missing" });
        }

        let usersToSplit = splitAmong;

        // If splitAmong is not provided, split among all registered participants
        if (!usersToSplit || usersToSplit.length === 0) {
            const registrations = await YatraRegistration.find({ yatra: yatraId, status: "Approved" });
            usersToSplit = registrations.map(reg => reg.user);
        }

        const expense = await Expense.create({
            yatra: yatraId,
            name,
            amount,
            paidBy: req.user.id,
            splitAmong: usersToSplit,
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
        
        const expenses = await Expense.find({ yatra: yatraId })
            .populate("paidBy", "firstName lastName")
            .populate("splitAmong", "firstName lastName");
        
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

        const expense = await Expense.findByIdAndUpdate(
            id,
            { name, amount, description },
            { new: true }
        );

        if (!expense) {
            return res.status(404).json({ success: false, message: "Expense not found" });
        }

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
        
        const expense = await Expense.findByIdAndDelete(id);
        
        if (!expense) {
            return res.status(404).json({ success: false, message: "Expense not found" });
        }

        return res.status(200).json({
            success: true,
            message: "Expense deleted successfully"
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

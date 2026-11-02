const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");
const uploadImageToCloudinary = require("../utils/cloudinaryUploader");

// Transaction Controller - Ledger entries, filtering, statistics, monthly tracking and export

const TYPES = ["Income", "Expense"];
const PAYMENT_TYPES = ["Cash", "Online", "Cheque", "Other"];
const SORT_FIELDS = { date: "date", amount: "amount", category: "category", party: "party", createdAt: "createdAt" };
const PROOF_MAX_BYTES = 5 * 1024 * 1024;

const isDay = (d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
const isMonth = (m) => typeof m === "string" && /^\d{4}-\d{2}$/.test(m);
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Entry dates are stored as UTC midnight of the chosen day, so day boundaries are UTC too
const dayStart = (d) => new Date(`${d}T00:00:00.000Z`);
const dayEnd = (d) => new Date(`${d}T23:59:59.999Z`);

// Entries are private to the user who recorded them; admins may also manage any entry
const canModify = (user, transaction) =>
    user.role === "Admin" || transaction.recordedBy.toString() === user.id.toString();

/**
 * Build the MongoDB filter shared by the list, statistics, monthly, breakdown and export endpoints.
 * `includeDates: false` leaves out the period filters (used by the monthly view, which picks its own year).
 */
const buildFilter = (query, userId, { includeDates = true } = {}) => {
    const { startDate, endDate, month, type, category, paymentType, paymentMethod, yatra, minAmount, maxAmount, hasProof, search } = query;
    const filter = { recordedBy: new mongoose.Types.ObjectId(userId) };
    const and = [];

    if (includeDates) {
        if (isMonth(month)) {
            const [y, m] = month.split("-").map(Number);
            filter.date = { $gte: new Date(Date.UTC(y, m - 1, 1)), $lt: new Date(Date.UTC(y, m, 1)) };
        } else if (isDay(startDate) || isDay(endDate)) {
            filter.date = {};
            if (isDay(startDate)) filter.date.$gte = dayStart(startDate);
            if (isDay(endDate)) filter.date.$lte = dayEnd(endDate);
        }
    }

    if (TYPES.includes(type)) filter.type = type;
    if (category) filter.category = category;

    if (PAYMENT_TYPES.includes(paymentType)) {
        // Entries created before payment types existed count as cash
        filter.paymentType = paymentType === "Cash" ? { $in: ["Cash", null] } : paymentType;
    }
    if (paymentMethod) filter.paymentMethod = paymentMethod;
    if (yatra && mongoose.Types.ObjectId.isValid(yatra)) filter.yatra = new mongoose.Types.ObjectId(yatra);

    const min = parseFloat(minAmount);
    const max = parseFloat(maxAmount);
    if (!isNaN(min) || !isNaN(max)) {
        filter.amount = {};
        if (!isNaN(min)) filter.amount.$gte = min;
        if (!isNaN(max)) filter.amount.$lte = max;
    }

    if (hasProof === "yes") filter.paymentProof = { $nin: [null, ""] };
    if (hasProof === "no") and.push({ $or: [{ paymentProof: null }, { paymentProof: "" }] });

    if (search && search.trim()) {
        const regex = new RegExp(escapeRegex(search.trim()), "i");
        const or = ["description", "category", "party", "paymentId", "paymentMethod", "notes"].map(field => ({ [field]: regex }));
        // A numeric keyword also matches the exact amount, e.g. "1500" or "1,500"
        const asNumber = parseFloat(search.replace(/[₹,\s]/g, ""));
        if (!isNaN(asNumber) && /^[₹\d.,\s]+$/.test(search.trim())) or.push({ amount: asNumber });
        and.push({ $or: or });
    }

    if (and.length) filter.$and = and;
    return filter;
};

// Totals, averages and extremes per type for everything matching the filter
const computeStats = async (filter) => {
    const groups = await Transaction.aggregate([
        { $match: filter },
        { $group: { _id: "$type", total: { $sum: "$amount" }, count: { $sum: 1 }, avg: { $avg: "$amount" }, min: { $min: "$amount" }, max: { $max: "$amount" } } }
    ]);
    const empty = { total: 0, count: 0, avg: 0, min: 0, max: 0 };
    const income = { ...empty, ...(groups.find(g => g._id === "Income") || {}) };
    const expense = { ...empty, ...(groups.find(g => g._id === "Expense") || {}) };
    delete income._id;
    delete expense._id;
    return { income, expense, net: income.total - expense.total, count: income.count + expense.count };
};

// Read entry fields from a JSON or multipart body; only fields that were sent are returned
const readEntryFields = (body) => {
    const fields = {};
    ["type", "description", "category", "party", "paymentType", "paymentMethod", "paymentId", "notes"].forEach(key => {
        if (body[key] !== undefined) fields[key] = typeof body[key] === "string" ? body[key].trim() : body[key];
    });
    if (body.amount !== undefined) fields.amount = Number(body.amount);
    if (body.date !== undefined && body.date !== "") fields.date = isDay(body.date) ? dayStart(body.date) : new Date(body.date);
    if (body.yatra !== undefined) fields.yatra = body.yatra && mongoose.Types.ObjectId.isValid(body.yatra) ? body.yatra : null;
    return fields;
};

const validateEntryFields = (fields, { isNew }) => {
    if (isNew && (!fields.type || fields.amount === undefined || !fields.description)) return "Type, amount and description are required";
    if (fields.type !== undefined && !TYPES.includes(fields.type)) return "Type must be 'Income' or 'Expense'";
    if (fields.amount !== undefined && (isNaN(fields.amount) || fields.amount <= 0)) return "Amount must be greater than 0";
    if (fields.description !== undefined && !fields.description) return "Description is required";
    if (fields.paymentType !== undefined && fields.paymentType !== "" && !PAYMENT_TYPES.includes(fields.paymentType)) return "Invalid payment type";
    if (fields.date !== undefined && isNaN(fields.date.getTime())) return "Invalid date";
    return null;
};

// Upload a payment proof (image or PDF) if one was attached; returns the URL or undefined
const uploadProof = async (req) => {
    const file = req.files && req.files.paymentProof;
    if (!file) return undefined;
    if (!(file.mimetype.startsWith("image/") || file.mimetype === "application/pdf")) {
        const error = new Error("Payment proof must be an image or a PDF");
        error.status = 400;
        throw error;
    }
    if (file.size > PROOF_MAX_BYTES) {
        const error = new Error("Payment proof must be smaller than 5MB");
        error.status = 400;
        throw error;
    }
    const result = await uploadImageToCloudinary(file, `${process.env.FOLDER_NAME}/transactions`);
    return result.secure_url;
};

exports.addTransaction = async (req, res) => {
    try {
        const fields = readEntryFields(req.body);
        const invalid = validateEntryFields(fields, { isNew: true });
        if (invalid) {
            return res.status(400).json({ success: false, message: invalid });
        }

        const paymentProof = await uploadProof(req);

        const transaction = await Transaction.create({
            ...fields,
            category: fields.category || fields.type,
            paymentType: fields.paymentType || "Cash",
            date: fields.date || Date.now(),
            paymentProof: paymentProof || null,
            recordedBy: req.user.id
        });
        await transaction.populate([{ path: "recordedBy", select: "firstName lastName" }, { path: "yatra", select: "title" }]);

        return res.status(201).json({
            success: true,
            message: "Transaction logged successfully",
            transaction
        });
    } catch (error) {
        return res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

exports.getTransactions = async (req, res) => {
    try {
        const { sortBy = "date", order = "desc", page = 1, limit = 20 } = req.query;
        const filter = buildFilter(req.query, req.user.id);

        const sortField = SORT_FIELDS[sortBy] || "date";
        const direction = order === "asc" ? 1 : -1;
        const sort = { [sortField]: direction, _id: direction };

        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

        const [transactions, total, stats] = await Promise.all([
            Transaction.find(filter)
                .populate("recordedBy", "firstName lastName")
                .populate("yatra", "title")
                .sort(sort)
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum),
            Transaction.countDocuments(filter),
            computeStats(filter)
        ]);

        return res.status(200).json({
            success: true,
            transactions,
            stats,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.max(1, Math.ceil(total / limitNum))
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.getLedgerSummary = async (req, res) => {
    try {
        const stats = await computeStats(buildFilter(req.query, req.user.id));

        return res.status(200).json({
            success: true,
            summary: {
                totalIncome: stats.income.total,
                totalExpense: stats.expense.total,
                balance: stats.net,
                count: stats.count
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Month-by-month income, expense, net and running balance for one year
exports.getMonthlySummary = async (req, res) => {
    try {
        const year = parseInt(req.query.year) || new Date().getUTCFullYear();
        const baseFilter = buildFilter(req.query, req.user.id, { includeDates: false });
        const yearStart = new Date(Date.UTC(year, 0, 1));
        const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

        const [groups, before, years] = await Promise.all([
            Transaction.aggregate([
                { $match: { ...baseFilter, date: { $gte: yearStart, $lt: yearEnd } } },
                { $group: { _id: { month: { $month: "$date" }, type: "$type" }, total: { $sum: "$amount" }, count: { $sum: 1 } } }
            ]),
            computeStats({ ...baseFilter, date: { $lt: yearStart } }),
            Transaction.aggregate([
                { $match: { recordedBy: baseFilter.recordedBy } },
                { $group: { _id: { $year: "$date" } } },
                { $sort: { _id: -1 } }
            ])
        ]);

        const openingBalance = before.net;
        let running = openingBalance;
        const months = Array.from({ length: 12 }, (_, i) => {
            const pick = (type) => groups.find(g => g._id.month === i + 1 && g._id.type === type) || { total: 0, count: 0 };
            const income = pick("Income");
            const expense = pick("Expense");
            running += income.total - expense.total;
            return {
                month: i + 1,
                income: income.total,
                expense: expense.total,
                net: income.total - expense.total,
                count: income.count + expense.count,
                closingBalance: running
            };
        });

        const totals = months.reduce((acc, m) => ({
            income: acc.income + m.income,
            expense: acc.expense + m.expense,
            net: acc.net + m.net,
            count: acc.count + m.count
        }), { income: 0, expense: 0, net: 0, count: 0 });

        const availableYears = years.map(y => y._id).filter(Boolean);
        if (!availableYears.includes(year)) availableYears.push(year);
        availableYears.sort((a, b) => b - a);

        return res.status(200).json({ success: true, year, openingBalance, closingBalance: running, months, totals, availableYears });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Totals by category and by payment type for everything matching the filters
exports.getBreakdown = async (req, res) => {
    try {
        const filter = buildFilter(req.query, req.user.id);

        const [byCategory, byPaymentType] = await Promise.all([
            Transaction.aggregate([
                { $match: filter },
                { $group: { _id: { category: "$category", type: "$type" }, total: { $sum: "$amount" }, count: { $sum: 1 } } },
                { $sort: { total: -1 } }
            ]),
            Transaction.aggregate([
                { $match: filter },
                { $group: { _id: { paymentType: { $ifNull: ["$paymentType", "Cash"] }, type: "$type" }, total: { $sum: "$amount" }, count: { $sum: 1 } } }
            ])
        ]);

        const categories = (type) => byCategory
            .filter(g => g._id.type === type)
            .map(g => ({ category: g._id.category, total: g.total, count: g.count }));

        const paymentTypes = PAYMENT_TYPES.map(paymentType => {
            const pick = (type) => byPaymentType.find(g => g._id.paymentType === paymentType && g._id.type === type) || { total: 0, count: 0 };
            return { paymentType, income: pick("Income").total, expense: pick("Expense").total, count: pick("Income").count + pick("Expense").count };
        }).filter(p => p.count > 0);

        return res.status(200).json({
            success: true,
            income: categories("Income"),
            expense: categories("Expense"),
            paymentTypes
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// CSV download of everything matching the filters (capped at 10,000 rows)
exports.exportTransactions = async (req, res) => {
    try {
        const { sortBy = "date", order = "desc" } = req.query;
        const filter = buildFilter(req.query, req.user.id);
        const sortField = SORT_FIELDS[sortBy] || "date";
        const direction = order === "asc" ? 1 : -1;

        const transactions = await Transaction.find(filter)
            .populate("recordedBy", "firstName lastName")
            .populate("yatra", "title")
            .sort({ [sortField]: direction, _id: direction })
            .limit(10000)
            .lean();

        // Quote every text cell, and neutralise values that spreadsheets would run as formulas
        const text = (value) => {
            let s = value === undefined || value === null ? "" : String(value);
            if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
            return `"${s.replace(/"/g, '""')}"`;
        };

        const header = ["Date", "Type", "Category", "Description", "Paid To / Received From", "Amount", "Payment Type", "Payment Method", "Payment ID", "Yatra", "Payment Proof", "Notes", "Recorded By"];
        const rows = transactions.map(t => [
            text(new Date(t.date).toISOString().slice(0, 10)),
            text(t.type),
            text(t.category),
            text(t.description),
            text(t.party),
            t.type === "Expense" ? -t.amount : t.amount,
            text(t.paymentType || "Cash"),
            text(t.paymentMethod),
            text(t.paymentId),
            text(t.yatra && t.yatra.title),
            text(t.paymentProof),
            text(t.notes),
            text(t.recordedBy ? `${t.recordedBy.firstName} ${t.recordedBy.lastName}` : "")
        ].join(","));

        const csv = "﻿" + [header.map(text).join(","), ...rows].join("\r\n");
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="ledger-${new Date().toISOString().slice(0, 10)}.csv"`);
        return res.status(200).send(csv);
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateTransaction = async (req, res) => {
    try {
        const { id } = req.params;

        const transaction = await Transaction.findById(id);
        if (!transaction) {
            return res.status(404).json({ success: false, message: "Transaction not found" });
        }
        if (!canModify(req.user, transaction)) {
            return res.status(403).json({ success: false, message: "You can only edit entries you recorded" });
        }

        const fields = readEntryFields(req.body);
        const invalid = validateEntryFields(fields, { isNew: false });
        if (invalid) {
            return res.status(400).json({ success: false, message: invalid });
        }

        const paymentProof = await uploadProof(req);
        if (paymentProof) {
            fields.paymentProof = paymentProof;
        } else if (req.body.removeProof === "true" || req.body.removeProof === true) {
            fields.paymentProof = null;
        }

        Object.assign(transaction, fields);
        await transaction.save();
        await transaction.populate([{ path: "recordedBy", select: "firstName lastName" }, { path: "yatra", select: "title" }]);

        return res.status(200).json({
            success: true,
            message: "Transaction updated successfully",
            transaction
        });
    } catch (error) {
        return res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

exports.deleteTransaction = async (req, res) => {
    try {
        const { id } = req.params;

        const transaction = await Transaction.findById(id);
        if (!transaction) {
            return res.status(404).json({ success: false, message: "Transaction not found" });
        }
        if (!canModify(req.user, transaction)) {
            return res.status(403).json({ success: false, message: "You can only delete entries you recorded" });
        }

        await transaction.deleteOne();

        return res.status(200).json({
            success: true,
            message: "Transaction deleted successfully"
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Delete several of the user's own entries at once
exports.bulkDeleteTransactions = async (req, res) => {
    try {
        const ids = Array.isArray(req.body.ids) ? req.body.ids.filter(id => mongoose.Types.ObjectId.isValid(id)) : [];
        if (!ids.length) {
            return res.status(400).json({ success: false, message: "No entries selected" });
        }

        const filter = { _id: { $in: ids } };
        if (req.user.role !== "Admin") filter.recordedBy = req.user.id;

        const result = await Transaction.deleteMany(filter);

        return res.status(200).json({
            success: true,
            message: `${result.deletedCount} entr${result.deletedCount === 1 ? "y" : "ies"} deleted`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.getCategories = async (req, res) => {
    try {
        const filter = { recordedBy: req.user.id };
        const [categories, paymentMethods] = await Promise.all([
            Transaction.distinct("category", filter),
            Transaction.distinct("paymentMethod", filter)
        ]);

        return res.status(200).json({
            success: true,
            categories: categories.filter(Boolean).sort(),
            paymentMethods: paymentMethods.filter(Boolean).sort()
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

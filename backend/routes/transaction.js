const express = require("express");
const router = express.Router();
const {
    addTransaction, getTransactions, getLedgerSummary, getMonthlySummary, getBreakdown,
    exportTransactions, updateTransaction, deleteTransaction, bulkDeleteTransactions, getCategories,
    getDeletedTransactions, restoreTransaction, getTransactionHistory, getUnassignedEntries, assignUnassignedEntries
} = require("../controllers/transaction");
const { auth, isSuperAdmin } = require("../middlewares/auth");
const { resolveAccount, resolveEntryAccount, requirePermission } = require("../utils/accountAccess");

// Each centre has one account. Access: its admins (full), shared Editors and Viewers, and the
// Super Admin (view + restore). The Super Admin picks a centre with ?centreId=.

// Super Admin: entries from before centre accounts
router.get("/unassigned", auth, isSuperAdmin, getUnassignedEntries);
router.post("/unassigned/assign", auth, isSuperAdmin, assignUnassignedEntries);

router.get("/", auth, resolveAccount, getTransactions);
router.get("/summary", auth, resolveAccount, getLedgerSummary);
router.get("/monthly", auth, resolveAccount, getMonthlySummary);
router.get("/breakdown", auth, resolveAccount, getBreakdown);
router.get("/export", auth, resolveAccount, exportTransactions);
router.get("/categories", auth, resolveAccount, getCategories);
router.get("/deleted", auth, resolveAccount, requirePermission("canRestore", "Only admins can see deleted entries"), getDeletedTransactions);
router.post("/add", auth, resolveAccount, requirePermission("canAdd", "You can view this account but not add entries"), addTransaction);
router.post("/bulk-delete", auth, resolveAccount, requirePermission("canEditOwn", "You can't delete entries in this account"), bulkDeleteTransactions);

router.get("/:id/history", auth, resolveEntryAccount, getTransactionHistory);
router.post("/:id/restore", auth, resolveEntryAccount, requirePermission("canRestore", "Only admins can restore entries"), restoreTransaction);
router.put("/:id", auth, resolveEntryAccount, requirePermission("canEditOwn", "You can't edit entries in this account"), updateTransaction);
router.delete("/:id", auth, resolveEntryAccount, requirePermission("canEditOwn", "You can't delete entries in this account"), deleteTransaction);

module.exports = router;

const express = require("express");
const router = express.Router();
const {
    addTransaction, getTransactions, getLedgerSummary, getMonthlySummary, getBreakdown,
    exportTransactions, updateTransaction, deleteTransaction, bulkDeleteTransactions, getCategories
} = require("../controllers/transaction");
const { auth, isManager } = require("../middlewares/auth");

router.post("/add", auth, isManager, addTransaction);
router.get("/", auth, isManager, getTransactions);
router.get("/summary", auth, isManager, getLedgerSummary);
router.get("/monthly", auth, isManager, getMonthlySummary);
router.get("/breakdown", auth, isManager, getBreakdown);
router.get("/export", auth, isManager, exportTransactions);
router.get("/categories", auth, isManager, getCategories);
router.post("/bulk-delete", auth, isManager, bulkDeleteTransactions);
router.put("/:id", auth, isManager, updateTransaction);
router.delete("/:id", auth, isManager, deleteTransaction);

module.exports = router;

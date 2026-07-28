const express = require("express");
const router = express.Router();
const { addTransaction, getTransactions, getLedgerSummary, updateTransaction, deleteTransaction, getCategories } = require("../controllers/transaction");
const { auth, isManager } = require("../middlewares/auth");

router.post("/add", auth, isManager, addTransaction);
router.get("/", auth, isManager, getTransactions);
router.get("/summary", auth, isManager, getLedgerSummary);
router.get("/categories", auth, isManager, getCategories);
router.put("/:id", auth, isManager, updateTransaction);
router.delete("/:id", auth, isManager, deleteTransaction);

module.exports = router;

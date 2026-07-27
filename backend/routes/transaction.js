const express = require("express");
const router = express.Router();
const { addTransaction, getTransactions, getLedgerSummary } = require("../controllers/transaction");
const { auth, isManager } = require("../middlewares/auth");

router.post("/add", auth, isManager, addTransaction);
router.get("/", auth, isManager, getTransactions);
router.get("/summary", auth, isManager, getLedgerSummary);

module.exports = router;

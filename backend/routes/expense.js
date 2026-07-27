const express = require("express");
const router = express.Router();
const { addExpense, getYatraExpenses, updateExpense, deleteExpense } = require("../controllers/expense");
const { auth, isManager } = require("../middlewares/auth");

router.post("/add", auth, isManager, addExpense);
router.get("/:yatraId", auth, isManager, getYatraExpenses);
router.put("/:id", auth, isManager, updateExpense);
router.delete("/:id", auth, isManager, deleteExpense);

module.exports = router;

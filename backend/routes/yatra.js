const express = require("express");
const router = express.Router();
const { createYatra, getAllYatras, getYatraById, updateYatra, deleteYatra } = require("../controllers/yatra");
const { auth, isManager, isManagerOnly } = require("../middlewares/auth");

router.post("/", auth, isManagerOnly, createYatra);
router.get("/", auth, getAllYatras);
router.get("/:id", auth, getYatraById);
router.put("/:id", auth, isManager, updateYatra);
router.delete("/:id", auth, isManager, deleteYatra);

module.exports = router;


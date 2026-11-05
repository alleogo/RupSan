const express = require("express");
const router = express.Router();
const { createYatra, getAllYatras, searchYatras, getYatraById, updateYatra, deleteYatra } = require("../controllers/yatra");
const { auth, isManager, isSuperAdmin } = require("../middlewares/auth");

router.post("/", auth, isManager, createYatra);
router.get("/", auth, getAllYatras);
router.get("/search", auth, isSuperAdmin, searchYatras);
router.get("/:id", auth, getYatraById);
router.put("/:id", auth, isManager, updateYatra);
router.delete("/:id", auth, isManager, deleteYatra);

module.exports = router;



const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

// Malformed ids in the URL are "not found", not server errors
const validId = (req, res, next, value) => (mongoose.Types.ObjectId.isValid(value) ? next() : res.status(404).json({ success: false, message: "Not found" }));
router.param("userId", validId);
const { getMyAccess, listAccess, grantAccess, revokeAccess } = require("../controllers/accountAccess");
const { auth, isAdmin } = require("../middlewares/auth");

router.get("/me", auth, getMyAccess);
router.get("/", auth, isAdmin, listAccess);
router.put("/", auth, isAdmin, grantAccess);
router.delete("/:userId", auth, isAdmin, revokeAccess);

module.exports = router;

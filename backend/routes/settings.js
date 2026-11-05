const express = require("express");
const router = express.Router();
const { getSettings, updateSettings } = require("../controllers/settings");
const { auth, isAdminOrSuperAdmin } = require("../middlewares/auth");

router.get("/", getSettings);
// Platform-wide branding: admins and the Super Admin only
router.put("/", auth, isAdminOrSuperAdmin, updateSettings);

module.exports = router;


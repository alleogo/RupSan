const express = require("express");
const router = express.Router();
const { getSettings, updateSettings } = require("../controllers/settings");
const { auth, isSuperAdmin } = require("../middlewares/auth");

router.get("/", getSettings);
// Platform-wide branding (navbar logo and title, dashboard images): the Super Admin only
router.put("/", auth, isSuperAdmin, updateSettings);

module.exports = router;


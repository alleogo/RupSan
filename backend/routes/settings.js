const express = require("express");
const router = express.Router();
const { getSettings, updateSettings } = require("../controllers/settings");
const { auth, isManager } = require("../middlewares/auth");
router.get("/", getSettings);

router.put("/", auth, isManager, updateSettings);

module.exports = router;

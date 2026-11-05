const express = require("express");
const router = express.Router();
const { getMyAccess, listAccess, grantAccess, revokeAccess } = require("../controllers/accountAccess");
const { auth, isAdmin } = require("../middlewares/auth");

router.get("/me", auth, getMyAccess);
router.get("/", auth, isAdmin, listAccess);
router.put("/", auth, isAdmin, grantAccess);
router.delete("/:userId", auth, isAdmin, revokeAccess);

module.exports = router;

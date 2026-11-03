const express = require("express");
const router = express.Router();
const { createRequest, getMyRequests, cancelRequest, endMyAccess, listRequests, reviewRequest, revokeAccess } = require("../controllers/roleRequest");
const { auth, isAdmin } = require("../middlewares/auth");

router.post("/", auth, createRequest);
router.get("/mine", auth, getMyRequests);
router.post("/end-access", auth, endMyAccess);
router.post("/:id/cancel", auth, cancelRequest);
router.get("/", auth, isAdmin, listRequests);
router.post("/:id/review", auth, isAdmin, reviewRequest);
router.post("/:id/revoke", auth, isAdmin, revokeAccess);

module.exports = router;

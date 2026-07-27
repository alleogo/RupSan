const express = require("express");
const router = express.Router();
const { addReview, getYatraReviews, updateReview } = require("../controllers/review");
const { auth } = require("../middlewares/auth");

router.post("/add", auth, addReview);
router.get("/:yatraId", auth, getYatraReviews);
router.put("/:id", auth, updateReview);

module.exports = router;

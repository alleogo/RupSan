const Review = require("../models/Review");
const Yatra = require("../models/Yatra");
const YatraRegistration = require("../models/YatraRegistration");

exports.addReview = async (req, res) => {
    try {
        const { yatraId, rating, comment } = req.body;
        
        if (!yatraId || !rating) {
            return res.status(400).json({ success: false, message: "Yatra ID and Rating are required" });
        }

        const yatra = await Yatra.findById(yatraId);
        if (!yatra) {
            return res.status(404).json({ success: false, message: "Yatra not found" });
        }

        // Check if user is a verified participant of this yatra
        const registration = await YatraRegistration.findOne({ user: req.user.id, yatra: yatraId, status: "Approved" });
        if (!registration && req.user.role === "Participant") {
            return res.status(403).json({ success: false, message: "You must have attended this Yatra to leave a review." });
        }

        const existingReview = await Review.findOne({ user: req.user.id, yatra: yatraId });
        if (existingReview) {
            return res.status(400).json({ success: false, message: "You have already reviewed this Yatra." });
        }

        const review = await Review.create({
            user: req.user.id,
            yatra: yatraId,
            rating,
            comment
        });

        return res.status(201).json({ success: true, message: "Review added successfully", review });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.getYatraReviews = async (req, res) => {
    try {
        const { yatraId } = req.params;
        const reviews = await Review.find({ yatra: yatraId }).populate("user", "firstName lastName");
        return res.status(200).json({ success: true, reviews });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateReview = async (req, res) => {
    try {
        const { id } = req.params;
        const { rating, comment } = req.body;

        if (!rating) {
            return res.status(400).json({ success: false, message: "Rating is required" });
        }

        const review = await Review.findById(id);
        if (!review) {
            return res.status(404).json({ success: false, message: "Review not found" });
        }

        if (review.user.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: "You are not authorized to update this review" });
        }

        review.rating = rating;
        review.comment = comment;
        await review.save();

        return res.status(200).json({ success: true, message: "Review updated successfully", review });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

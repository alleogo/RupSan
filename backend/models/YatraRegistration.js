const mongoose = require('mongoose');

const yatraRegistrationSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    yatra: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Yatra",
        required: true
    },
    amountToBePaid: {
        type: Number,
        default: 0
    },
    paidOnline: {
        type: Number,
        default: 0
    },
    paidCash: {
        type: Number,
        default: 0
    },
    paymentScreenshot: {
        type: String,
        default: null
    },
    paymentRefId: {
        type: String,
        default: null
    },
    status: {
        type: String,
        enum: ["Pending", "Approved", "Rejected"],
        default: "Pending" // Starts as Pending until Manager approves the screenshot
    },
    // When the post-yatra review request was emailed (so the daily job never sends it twice)
    reviewEmailSentAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });

module.exports = mongoose.model("YatraRegistration", yatraRegistrationSchema);
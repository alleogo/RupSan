const mongoose = require('mongoose');

const yatraSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        required: true,
    },
    startDate: {
        type: Date,
        required: true,
    },
    endDate: {
        type: Date,
        required: true,
    },
    destination: {
        type: String,
        required: true,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    registrationFee: {
        type: Number,
        required: true,
    },
    status: {
        type: String,
        enum: ["Upcoming", "Ongoing", "Completed"],
        default: "Upcoming"
    },
    thumbnail: {
        type: String,
        default: null
    },
    gallery: {
        type: [String],
        default: []
    },
    bankDetails: {
        type: String,
        default: null
    },
    upiId: {
        type: String,
        default: null
    },
    qrCode: {
        type: String, // path to uploaded QR image
        default: null
    }
}, { timestamps: true });

module.exports = mongoose.model("Yatra", yatraSchema);


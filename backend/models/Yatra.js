const mongoose = require('mongoose');

// Yatra Model - Stores pilgrimage/trip information

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
    // The centre the yatra belongs to (its creator's centre); null for yatras from before centres
    centre: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Centre",
        default: null
    },
    // Which other centres can see it, chosen by the manager
    visibility: {
        allCentres: { type: Boolean, default: false },
        centres: [{ type: mongoose.Schema.Types.ObjectId, ref: "Centre" }]
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

    // bankDetails can also be added but I have removed it for future use
    // bankDetails: {
    //     type: String,
    //     default: null
    // },
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



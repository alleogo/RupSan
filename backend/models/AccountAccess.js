const mongoose = require('mongoose');

// AccountAccess Model - A centre admin shares their centre's account with a member of the same centre.
// Admins and co-admins of the centre have full access without a record here.

const accountAccessSchema = new mongoose.Schema({
    centre: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Centre",
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    // Viewer: see entries and reports. Editor: also add entries and edit or delete their own.
    level: {
        type: String,
        enum: ["Viewer", "Editor"],
        required: true
    },
    grantedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    // Access ends after this moment; null = until removed
    expiresAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });

accountAccessSchema.index({ centre: 1, user: 1 }, { unique: true });

module.exports = mongoose.model("AccountAccess", accountAccessSchema);

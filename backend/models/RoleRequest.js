const mongoose = require('mongoose');

// RoleRequest Model - A participant's request for temporary (or open-ended) manager access

const roleRequestSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    requestedRole: {
        type: String,
        enum: ["Manager"],
        default: "Manager"
    },
    // Access starts at the beginning of startDate and lasts through the end of endDate (UTC days)
    startDate: {
        type: Date,
        required: true
    },
    // null = no end date (until an admin revokes it or the user gives it up)
    endDate: {
        type: Date,
        default: null
    },
    reason: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1000
    },
    status: {
        type: String,
        // Approved = access granted (scheduled or active); Ended = given up by the user;
        // Expired = end date passed; Revoked = ended early by an admin
        enum: ["Pending", "Approved", "Rejected", "Cancelled", "Ended", "Expired", "Revoked"],
        default: "Pending"
    },
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    reviewedAt: {
        type: Date,
        default: null
    },
    reviewNote: {
        type: String,
        trim: true,
        default: ""
    }
}, { timestamps: true });

roleRequestSchema.index({ user: 1, createdAt: -1 });
roleRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("RoleRequest", roleRequestSchema);

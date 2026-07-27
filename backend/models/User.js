const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true,
        trim: true,
    },
    lastName: {
        type: String,
        required: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        required: true,
        enum: ["Admin", "Manager", "Participant"]
    },
    status: {
        type: String,
        enum: ["Pending", "Approved", "Rejected"],
        default: function() {
            // Managers are pending by default. Participants and Admins are approved.
            if (this.role === "Manager") {
                return "Pending";
            }
            return "Approved";
        }
    },
    aadharNumber: {
        type: String,
        trim: true,
        default: null
    },
    phoneNumber: {
        type: String,
        trim: true,
        default: null
    },
    centre: {
        type: String,
        trim: true,
        default: null
    },
    verificationStatus: {
        type: String,
        enum: ["Unverified", "Pending", "Verified"],
        default: function() {
            if (this.role === "Participant") return "Unverified";
            return "Verified"; // Admins and Managers are verified by default
        }
    },
    managerApprovedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    }
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);

const mongoose = require('mongoose');

// Centre Model - A centre that members belong to. Each centre has one admin, optional co-admins,
// and its own account (ledger). Renaming a centre renames it for every member, since they reference it.

const centreSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    // Lower-cased name, so "Vrindavan" and "vrindavan " can't both exist
    nameKey: {
        type: String,
        required: true,
        unique: true
    },
    admin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    coAdmins: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }]
}, { timestamps: true });

centreSchema.pre("validate", function () {
    if (this.name) {
        this.name = this.name.trim().replace(/\s+/g, " ");
        this.nameKey = this.name.toLowerCase();
    }
});

module.exports = mongoose.model("Centre", centreSchema);

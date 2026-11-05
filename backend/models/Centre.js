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
    description: {
        type: String,
        trim: true,
        maxlength: 1000,
        default: ""
    },
    // City, town or village
    place: {
        type: String,
        trim: true,
        maxlength: 100,
        default: ""
    },
    // Address or directions (the app links it to a map search)
    location: {
        type: String,
        trim: true,
        maxlength: 300,
        default: ""
    },
    // Project manager: a contact, who doesn't need an account
    pm: {
        name: { type: String, trim: true, maxlength: 100, default: "" },
        phone: { type: String, trim: true, maxlength: 20, default: "" },
        email: { type: String, trim: true, lowercase: true, maxlength: 100, default: "" }
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

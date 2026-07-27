const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    accountsThumbnail: {
        type: String,
        default: null
    },
    navbarLogo: {
        type: String,
        default: null
    },
    yatraThumbnail: {
        type: String,
        default: null
    },
    navbarTitle: {
        type: String,
        default: "Accounts Management"
    },
    navbarLogoText: {
        type: String,
        default: "AM"
    }
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);

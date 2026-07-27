const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
    yatra: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Yatra",
        required: true
    },
    name: {
        type: String,
        required: true,
        description: "Name of the person who booked"
    },
    from: {
        type: String,
        required: true
    },
    to: {
        type: String,
        required: true
    },
    paymentBy: {
        type: String,
        required: true,
        description: "Name of the person who paid"
    },
    ticketFile: {
        type: String,
        required: true,
        description: "File path/URL to the ticket"
    },
    ticketCancellationFile: {
        type: String,
        description: "File path/URL to the ticket cancellation if applicable"
    }
}, { timestamps: true });

module.exports = mongoose.model("Ticket", ticketSchema);

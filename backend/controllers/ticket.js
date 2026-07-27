const Ticket = require("../models/Ticket");
const uploadImageToCloudinary = require("../utils/cloudinaryUploader");

exports.addTicket = async (req, res) => {
    try {
        const { yatraId, name, from, to, paymentBy } = req.body;

        if (!yatraId || !name || !from || !to || !paymentBy) {
            return res.status(400).json({ success: false, message: "Required fields are missing" });
        }

        let ticketFilePath = null;
        if (req.files && req.files.ticketFile) {
            const result = await uploadImageToCloudinary(req.files.ticketFile, `${process.env.FOLDER_NAME}/tickets`);
            ticketFilePath = result.secure_url;
        } else {
            return res.status(400).json({ success: false, message: "Ticket file is required" });
        }

        let ticketCancellationFilePath = null;
        if (req.files && req.files.ticketCancellationFile) {
            const result = await uploadImageToCloudinary(req.files.ticketCancellationFile, `${process.env.FOLDER_NAME}/tickets`);
            ticketCancellationFilePath = result.secure_url;
        }

        const ticket = await Ticket.create({
            yatra: yatraId,
            name,
            from,
            to,
            paymentBy,
            ticketFile: ticketFilePath,
            ticketCancellationFile: ticketCancellationFilePath
        });

        return res.status(201).json({
            success: true,
            message: "Ticket added successfully",
            ticket
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.getYatraTickets = async (req, res) => {
    try {
        const { yatraId } = req.params;
        const tickets = await Ticket.find({ yatra: yatraId });
        
        return res.status(200).json({
            success: true,
            tickets
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateTicket = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, from, to, paymentBy } = req.body;

        const ticket = await Ticket.findById(id);
        if (!ticket) {
            return res.status(404).json({ success: false, message: "Ticket not found" });
        }

        if (name) ticket.name = name;
        if (from) ticket.from = from;
        if (to) ticket.to = to;
        if (paymentBy) ticket.paymentBy = paymentBy;

        if (req.files && req.files.ticketFile) {
            const result = await uploadImageToCloudinary(req.files.ticketFile, `${process.env.FOLDER_NAME}/tickets`);
            ticket.ticketFile = result.secure_url;
        }

        if (req.files && req.files.ticketCancellationFile) {
            const result = await uploadImageToCloudinary(req.files.ticketCancellationFile, `${process.env.FOLDER_NAME}/tickets`);
            ticket.ticketCancellationFile = result.secure_url;
        }

        await ticket.save();

        return res.status(200).json({
            success: true,
            message: "Ticket updated successfully",
            ticket
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteTicket = async (req, res) => {
    try {
        const { id } = req.params;
        
        const ticket = await Ticket.findByIdAndDelete(id);
        if (!ticket) {
            return res.status(404).json({ success: false, message: "Ticket not found" });
        }

        return res.status(200).json({
            success: true,
            message: "Ticket deleted successfully"
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

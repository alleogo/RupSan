const cron = require('node-cron');
const Yatra = require('../models/Yatra');
const YatraRegistration = require('../models/YatraRegistration');
const mailSender = require('./mailSender');

// Run every day at 8:00 AM
cron.schedule('0 8 * * *', async () => {
    try {
        console.log("Running daily cron job for Yatra reviews...");
        
        // Find yatras that ended yesterday (or recently completed)
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        // Find ongoing yatras whose endDate has passed
        const endedYatras = await Yatra.find({
            status: "Ongoing",
            endDate: { $lt: today }
        });

        for (let yatra of endedYatras) {
            // Update status to Completed
            yatra.status = "Completed";
            await yatra.save();

            // Find all approved registrations
            const registrations = await YatraRegistration.find({
                yatra: yatra._id,
                status: "Approved"
            }).populate('user');

            for (let reg of registrations) {
                if (reg.user && reg.user.email) {
                    await mailSender(
                        reg.user.email,
                        `Please Review Your Yatra: ${yatra.title}`,
                        `<p>Dear ${reg.user.firstName},</p>
                         <p>We hope you had a great time at <b>${yatra.title}</b>.</p>
                         <p>Please log in to your account and leave a review for the Yatra!</p>
                         <p>Thank you!</p>`
                    );
                }
            }
        }
    } catch (error) {
        console.error("Error in cron job:", error);
    }
});

const cron = require('node-cron');
const Yatra = require('../models/Yatra');
const YatraRegistration = require('../models/YatraRegistration');
const mailSender = require('./mailSender');

// Daily job: mark ended yatras as Completed and ask attendees for reviews
const runYatraReviewJob = async () => {
    try {
        const startTime = new Date();
        console.log(`[Cron Job] Daily Yatra review job started at ${startTime.toISOString()}`);
        
        // Find ongoing yatras whose endDate has passed
        const today = new Date();
        const endedYatras = await Yatra.find({
            status: "Ongoing",
            endDate: { $lt: today }
        });
        console.log(`[Cron Job] Found ${endedYatras.length} completed yatras to process`);

        let emailsSent = 0;
        for (let yatra of endedYatras) {
            // Update status to Completed
            yatra.status = "Completed";
            await yatra.save();
            console.log(`[Cron Job] Updated yatra status to Completed: ${yatra.title}`);

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
                    emailsSent++;
                }
            }
        }
        const endTime = new Date();
        const duration = (endTime - startTime) / 1000;
        console.log(`[Cron Job] Daily job completed in ${duration}s - Sent ${emailsSent} review emails`);
    } catch (error) {
        console.error(`[Cron Job] Error in daily Yatra review job:`, error);
    }
};

// On Vercel the job is triggered by Vercel Cron (see vercel.json); locally use node-cron
if (!process.env.VERCEL) {
    // Run every day at 8:00 AM
    cron.schedule('0 8 * * *', runYatraReviewJob);
}

module.exports = { runYatraReviewJob };

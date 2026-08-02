const nodemailer = require("nodemailer");
require("dotenv").config();

const mailSender = async (email, title, body) => {
    try {
        console.log(`[Mail Sender] Attempting to send email to ${email} with subject "${title}"`);
        let transporter = nodemailer.createTransport({
            host: process.env.MAIL_HOST || "smtp.gmail.com",
            auth: {
                user: process.env.MAIL_USER,
                pass: process.env.MAIL_PASS,
            },
        });

        let info = await transporter.sendMail({
            from: 'Accounts Management Platform',
            to: `${email}`,
            subject: `${title}`,
            html: `${body}`,
        });
        console.log(`[Mail Sender] Email successfully sent to ${email}. Message ID: ${info.messageId}`);
        console.log("Email Sent Info: ", info.response);
        return info;
    } catch (error) {
        console.error("Error occurred while sending email: ", error.message);
        return null;
    }
};

module.exports = mailSender;

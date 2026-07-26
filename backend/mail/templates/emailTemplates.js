exports.welcomeEmailTemplate = (name) => {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px; }
                .container { background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
                h1 { color: #333333; }
                p { color: #555555; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Welcome to Accounts Management, ${name}!</h1>
                <p>We are thrilled to have you on board. You can now track yatras, expenses, and manage your accounts seamlessly.</p>
                <p>If you have any questions, feel free to reply to this email.</p>
                <p>Best Regards,<br/>Accounts Management Team</p>
            </div>
        </body>
        </html>
    `;
};

exports.approvalEmailTemplate = (name, status) => {
    const isApproved = status === "Approved";
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px; }
                .container { background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
                h1 { color: ${isApproved ? '#28a745' : '#dc3545'}; }
                p { color: #555555; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Account Status Update</h1>
                <p>Hi ${name},</p>
                <p>Your Manager account request has been <strong>${status}</strong> by an Admin.</p>
                ${isApproved ? '<p>You can now log in and start managing yatras.</p>' : '<p>If you think this was a mistake, please contact support.</p>'}
            </div>
        </body>
        </html>
    `;
};

// Fields left out whenever a user record is sent to the browser: the password hash and private
// Aadhaar details (only whether a card was uploaded, and when, is shared). aadharNumber is no longer
// collected; it stays excluded in case old records still hold one.
const PUBLIC_USER_FIELDS = "-password -aadharNumber -aadharCard.publicId -aadharCard.format";

module.exports = { PUBLIC_USER_FIELDS };

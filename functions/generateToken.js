require("dotenv").config({ path: "../.env" });
const jwt = require("jsonwebtoken");
const functions = require('firebase-functions');
const semApiSecret = functions.config().sem.api_secret;

const token = jwt.sign({ userId: "07584949729" }, semApiSecret, {
  expiresIn: "1h",
});

module.exports = token;
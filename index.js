const express = require('express');
const app = express();
__path = process.cwd()
const bodyParser = require("body-parser");
const PORT = process.env.PORT || 8000;
require('events').EventEmitter.defaultMaxListeners = 500;

// --- Auto ENV Creator ---
const fs = require("fs");

if (!fs.existsSync("./.env")) {
    fs.writeFileSync("./.env",
`MEGA_EMAIL=
MEGA_PASSWORD=
SESSION_ID=
OWNER_NUMBER=
`);
    console.log("⚠️ .env file missing. A new one was created.");
    console.log("➡️ Fill details in .env and restart bot.");
    process.exit();
}

// --- Load ENV ---
require("dotenv").config();

// --- Routes ---
app.use('/code', require('./pair'));

app.get('/', (req, res) => {
    res.sendFile(__path + '/pair.html');
});

// --- Body Parser ---
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`⏩ Server running on http://localhost:` + PORT)
});

module.exports = app;

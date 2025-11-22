const express = require('express');
const app = express();
__path = process.cwd()
const bodyParser = require("body-parser");
const PORT = process.env.PORT || 8000;
let code = require('./pair');
require('events').EventEmitter.defaultMaxListeners = 500;
app.use('/code', code);


const fs = require("fs");

if (!fs.existsSync("./.env")) {
    fs.writeFileSync("./.env",
`MEGA_EMAIL=
MEGA_PASSWORD=
SESSION_ID=
OWNER_NUMBER=
`);
    console.log("⚠️ .env file missing. I created a new one for you.");
    console.log("➡️ Please fill your details in .env and run again.");
    process.exit();
}


app.use('/',async (req, res, next) => {
res.sendFile(__path + '/pair.html')
})

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.listen(PORT, () => {
    console.log(`⏩ Server running on http://localhost:` + PORT)
})

module.exports = app

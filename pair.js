// pair.js
const express = require('express');
const fs = require('fs');
const { exec } = require("child_process");
let router = express.Router()
const pino = require("pino");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser
} = require("@whiskeysockets/baileys");

// MEGA import එක ඉවත් කර ඇත, එය තවදුරටත් අවශ්‍ය නොවේ.
// const { upload } = require('./mega'); 

// Replit Secret වෙතින් OWNER_NUMBER එක ලබා ගනියි.
const OWNER_NUMBER = process.env.OWNER_NUMBER || '';

// OWNER_NUMBER එක ජාත්‍යන්තර ආකෘතියේ JID බවට පත් කරයි
const ownerJid = OWNER_NUMBER ? jidNormalizedUser(OWNER_NUMBER + '@s.whatsapp.net') : null;

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

// randomMegaId function එක Base64 Send කිරීම සඳහා අවශ්‍ය නොවේ, නමුත් කේතයෙන් ඉවත් කළේ නැත.
function randomMegaId(length = 6, numberLength = 4) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    const number = Math.floor(Math.random() * Math.pow(10, numberLength));
    return `${result}${number}`;
}


router.get('/', async (req, res) => {
    let num = req.query.number; 

    async function DanuwaPair() {
        const auth_path = './session/';
        // Session file සාර්ථකව සාදා ගත් පසු එය 'session' folder එකට save වේ.
        const { state, saveCreds } = await useMultiFileAuthState(auth_path); 

        try {
            let DanuwaPairWeb = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: Browsers.macOS("Safari"),
            });

            if (!DanuwaPairWeb.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');

                const code = await DanuwaPairWeb.requestPairingCode(num);

                if (!res.headersSent) {
                    await res.send({ code });
                }
            }

            DanuwaPairWeb.ev.on('creds.update', saveCreds);

            DanuwaPairWeb.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;

                if (connection === "open") {
                    console.log("✅ Device Successfully Paired! Starting Base64 Encoding and Send..."); 
                    try {
                        await delay(5000); // Wait for credentials to save fully
                        
                        // 1. creds.json file එකේ content එක කියවීම
                        const credsJson = fs.readFileSync(auth_path + 'creds.json'); 
                        
                        // 2. එම content එක Base64 String එකක් බවට පත් කිරීම (මෙය ඔබ deploy bot එකට අවශ්‍ය දිගු String එකයි)
                        const finalBase64String = Buffer.from(credsJson).toString('base64');
                        
                        console.log(`✅ Session ID generated and Encoded. Sending to Owner...`);

                        // Session ID එක OWNER_NUMBER එකට යැවීම
                        if (ownerJid) {
                            await DanuwaPairWeb.sendMessage(ownerJid, {
                                text: `⭐ Session ID එක සාර්ථකව Generate විය. *මෙය ඔබගේ Deploy Bot එකේ SESSION_ID ලෙස යොදන්න.*:\n\n*Zanta-MD Base64 Session id👇*\n\n${finalBase64String}` 
                            });
                            console.log(`✅ Confirmation message sent to Owner Number: ${OWNER_NUMBER}`);
                        } else {
                            console.log("⚠️ OWNER_NUMBER configured නැති නිසා Session ID එක WhatsApp හරහා යැවිය නොහැක. Console එකෙන් Base64 String එක ලබා ගන්න.");
                        }
                        
                        // වැඩ අවසන් වූ පසු Bot එක Close කර Session Files ඉවත් කරයි
                        await delay(5000);
                        await DanuwaPairWeb.end('Session sent successfully');
                        removeFile(auth_path); 

                    } catch (e) {
                        console.error("❌ Base64 Encoding or Message send failed:", e);
                        // exec('pm2 restart danuwa'); // අවශ්‍ය නම් pm2 restart
                    } 
                } else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode !== 401) {
                    // 401 (Logged Out) නොවන error එකකදී නැවත සම්බන්ධ වීමට උත්සාහ කරයි
                    await delay(10000);
                    DanuwaPair();
                } else if (connection === "close" && lastDisconnect.error.output.statusCode === 401) {
                    // Logged Out නම් temp session එක delete කරයි
                    console.log("❌ Logged out. Removing session files.");
                    removeFile(auth_path); 
                }
            });
        } catch (err) {
            console.error("❌ Pairing process failed:", err.message);
            // exec('pm2 restart danuwa-md'); // අවශ්‍ය නම් pm2 restart
            await removeFile('./session');
            if (!res.headersSent) {
                await res.send({ code: "Service Unavailable" });
            }
        }
    }
    return await DanuwaPair();
});

process.on('uncaughtException', function (err) {
    console.log('Caught exception: ' + err);
    // exec('pm2 restart danuwa'); // අවශ්‍ය නම් pm2 restart
});


module.exports = router;

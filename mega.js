// mega.js
const mega = require("megajs");

// Replit Secrets වලින් MEGA විස්තර ලබා ගනියි (process.env)
const auth = {
    email: "Nimsaraakash194@gmail.com",
    password: "Akashkavindu12345",
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246'
}

const upload = (data, name) => {
    return new Promise((resolve, reject) => {
        try {
            // MEGA_EMAIL හෝ MEGA_PASSWORD නැත්නම් error එකක් දමයි
            if (!auth.email || !auth.password) {
                return reject(new Error("MEGA_EMAIL or MEGA_PASSWORD is not configured in Replit Secrets."));
            }

            const storage = new mega.Storage(auth, (error) => {
                if (error) {
                    return reject(error);
                }
                
                // ඔබගේ මුල් කේතයේ තිබූ pipe කිරීමේ සහ link කිරීමේ logic එක එලෙසම තබා ඇත.
                data.pipe(storage.upload({name: name, allowUploadBuffering: true}));
                storage.on("add", (file) => {
                    file.link((err, url) => {
                        if (err) {
                            storage.close();
                            return reject(err);
                        }
                        storage.close()
                        resolve(url);
                    });
                });
            });
        } catch (err) {
            reject(err);
        }
    });
};

module.exports = { upload };

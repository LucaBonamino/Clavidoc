const fs = require("fs");
const { readdirSync, writeFileSync } = require("node:fs");
const path = require("node:path");
require("dotenv").config();

const Browsers = {
    Chrome: "chrome",
    Firefox: "firefox",
};
const validBrowsers = Object.values(Browsers);

function parseBrowserArgument() {
    const args = process.argv.slice(2);
    let browser = null;
    for (let i = 0; i < args.length; i++) {
        if (args[i] === "-b" || args[i] == "--browser") {
            browser = args[i + 1];
            break;
        }
    }
    if (!browser || !validBrowsers.includes(browser)) {
        console.error(
            `Usage: node build.js --browser <${validBrowsers.join("|")}>`,
        );
        process.exis(1);
    }
    return browser;
}

const browser = parseBrowserArgument();
const googleClientId = process.env.GOOGLE_CLIENT_ID;

if (!googleClientId) {
    console.error("Missing GOOGLE_CLIENT_ID in .env");
    process.exit(1);
}

const src = path.join("src");
const dist = path.join("dist");
const distBrowser = path.join(dist, browser);

fs.mkdirSync(dist, { recursive: true });

if (fs.existsSync(distBrowser)) {
    fs.rmSync(distBrowser, {
        recursive: true,
        force: true,
    });
}

fs.mkdirSync(distBrowser, { recursive: true });

for (const item of fs.readdirSync(src, { withFileTypes: true })) {
    if (item.name === "manifest" || item.name === "scripts") {
        continue;
    }

    const source = path.join(src, item.name);
    const destination = path.join(distBrowser, item.name);

    fs.cpSync(source, destination, {
        recursive: true,
    });
}

const scriptsSrc = path.join(src, "scripts");
const scriptsDestination = path.join(distBrowser, "scripts");

fs.cpSync(scriptsSrc, scriptsDestination, {
    recursive: true,
    filter: (source) => {
        return path.basename(source) !== "browser";
    },
});

fs.copyFileSync(
    path.join(scriptsSrc, "browser", `${browser}.js`),
    path.join(scriptsDestination, "browser.js"),
);

const contentJsPath = path.join(scriptsDestination, "content.js");

let contentJs = fs.readFileSync(contentJsPath, "utf8");

contentJs = contentJs.replaceAll("__GOOGLE_CLIENT_ID__", googleClientId);

fs.writeFileSync(contentJsPath, contentJs, "utf8");

const baseManifest = JSON.parse(
    fs.readFileSync(path.join(src, "manifest", "manifest_common.json"), "utf8"),
);

const browserManifest = JSON.parse(
    fs.readFileSync(path.join(src, "manifest", `${browser}.json`), "utf8"),
);

const manifest = {
    ...baseManifest,
    ...browserManifest,
};

(fs,
    writeFileSync(
        path.join(distBrowser, "manifest.json"),
        JSON.stringify(manifest, null, 2) + "\n",
    ));

console.log(`Built Camidoc for ${browser}; ${distBrowser}`);

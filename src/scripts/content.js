const fileInput = document.getElementById("fileUpload");
const uploadButton = document.getElementById("uploadButton");
const uploadStatus = document.getElementById("uploadStatus");

const GOOGLE_CLIENT_ID = "__GOOGLE_CLIENT_ID__";

uploadButton.addEventListener("click", async () => {
    const file = fileInput.files[0];

    if (!file) {
        uploadStatus.textContent = "Please select a file first.";
        return;
    }

    try {
        uploadButton.disabled = true;

        uploadStatus.textContent = "Connecting to Google Drive...";

        // Get an OAuth token through the user's normal
        // Google browser session.
        const token = await getGoogleAccessToken();

        if (!token) {
            throw new Error("Could not obtain Google access token.");
        }

        uploadStatus.textContent = "Uploading...";

        const uploadedFile = await uploadFileToDrive(file, token);

        uploadStatus.textContent = `Uploaded successfully: ${uploadedFile.name}`;

        console.log("Google Drive response:", uploadedFile);
    } catch (error) {
        console.error("Upload error:", error);

        uploadStatus.textContent = `Upload failed: ${error.message}`;
    } finally {
        uploadButton.disabled = false;
    }
});

/**
 * Opens Google's OAuth authorization page.
 *
 * This does NOT require the user to be signed into the
 * Chrome browser profile.
 *
 * Google uses the Google account/session available in
 * the browser.
 */
async function getGoogleAccessToken() {
    if (!chrome.identity) {
        throw new Error("Chrome Identity API is unavailable.");
    }

    // With your current extension ID this should produce:
    //
    // https://fgldpbhjhcnannaeacpnklfjpnebefgi.chromiumapp.org/google
    //
    const redirectUri = chrome.identity.getRedirectURL("google");

    console.log("OAuth redirect URI:", redirectUri);

    // Protect the OAuth request against CSRF.
    const state = crypto.randomUUID();

    const authParams = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,

        redirect_uri: redirectUri,

        response_type: "token",

        scope: "https://www.googleapis.com/auth/drive.file",

        include_granted_scopes: "true",

        state: state,

        // This lets the user explicitly choose which
        // Google account/Drive to use.
        prompt: "select_account",
    });

    const authUrl =
        "https://accounts.google.com/o/oauth2/v2/auth?" + authParams.toString();

    console.log("Opening Google authorization...");

    const responseUrl = await chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true,
    });

    if (!responseUrl) {
        throw new Error("Google authorization was cancelled.");
    }

    console.log("Google OAuth redirect received.");

    const returnedUrl = new URL(responseUrl);

    /*
     * With response_type=token Google returns the
     * access token in the URL fragment:
     *
     * #access_token=...&token_type=Bearer&...
     */
    const returnedParams = new URLSearchParams(returnedUrl.hash.substring(1));

    // Verify this response belongs to the OAuth request
    // that Clavidoc just started.
    const returnedState = returnedParams.get("state");

    if (returnedState !== state) {
        throw new Error("OAuth state verification failed.");
    }

    const oauthError = returnedParams.get("error");

    if (oauthError) {
        const description = returnedParams.get("error_description");

        throw new Error(
            description ? `${oauthError}: ${description}` : oauthError,
        );
    }

    const accessToken = returnedParams.get("access_token");

    if (!accessToken) {
        throw new Error("Google did not return an access token.");
    }

    return accessToken;
}

/**
 * Uploads the selected file to Google Drive.
 */
async function uploadFileToDrive(file, token) {
    const metadata = {
        name: file.name,
    };

    const boundary = "clavidoc_" + crypto.randomUUID();

    const body = new Blob([
        `--${boundary}\r\n`,

        `Content-Type: application/json; charset=UTF-8\r\n\r\n`,

        JSON.stringify(metadata),

        `\r\n--${boundary}\r\n`,

        `Content-Type: ${file.type || "application/octet-stream"}\r\n\r\n`,

        file,

        `\r\n--${boundary}--`,
    ]);

    const response = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files" +
            "?uploadType=multipart" +
            "&fields=id,name,mimeType,size",
        {
            method: "POST",

            headers: {
                Authorization: `Bearer ${token}`,

                "Content-Type": `multipart/related; boundary=${boundary}`,
            },

            body: body,
        },
    );

    if (!response.ok) {
        const errorText = await response.text();

        throw new Error(
            `Google Drive returned ` + `${response.status}: ` + errorText,
        );
    }

    return await response.json();
}

let encryptPDF;

// ==========================
// Load Encryption Engine
// ==========================
try {
    const encryptModule = await import(
        "https://cdn.jsdelivr.net/npm/@pdfsmaller/pdf-encrypt@latest/+esm"
    );

    encryptPDF = encryptModule.encryptPDF;

    document.getElementById("loadStatus").textContent =
        "Encryption engine ready.";

    document.getElementById("lockBtn").disabled = false;

} catch (err) {

    console.error(err);

    document.getElementById("loadStatus").textContent =
        "Could not load the encryption engine.";

}

const passwordInput = document.getElementById("lockPassword");
const confirmInput = document.getElementById("confirmPassword");

const togglePassword =
    document.getElementById("togglePassword");

const toggleConfirmPassword =
    document.getElementById("toggleConfirmPassword");


    togglePassword.addEventListener("click", () => {

    if (passwordInput.type === "password") {

        passwordInput.type = "text";
        togglePassword.textContent = "⌣";

    } else {

        passwordInput.type = "password";
        togglePassword.textContent = "👁";

    }

});

// ==========================
// Elements
// ==========================
const fileInput = document.getElementById("lockFile");
const preview = document.getElementById("pdfPreview");
const placeholder = document.getElementById("previewPlaceholder");

const lockForm = document.getElementById("lockForm");
const lockStatus = document.getElementById("lockStatus");

let previewURL = null;

// ==========================
// Automatic Preview
// ==========================
fileInput.addEventListener("change", () => {

    const file = fileInput.files[0];

    if (!file) {

        preview.removeAttribute("src");

        preview.style.display = "none";

        if (placeholder) {
            placeholder.style.display = "block";
        }

        return;
    }

    if (file.type !== "application/pdf") {

        alert("Please choose a PDF.");

        fileInput.value = "";

        preview.removeAttribute("src");

        preview.style.display = "none";

        if (placeholder) {
            placeholder.style.display = "block";
        }

        return;
    }

    if (previewURL) {
        URL.revokeObjectURL(previewURL);
    }

    previewURL = URL.createObjectURL(file);

    preview.src = previewURL;

    preview.style.display = "block";

    if (placeholder) {
        placeholder.style.display = "none";
    }

});

// ==========================
// Download Helper
// ==========================
function downloadBytes(bytes, filename, type) {

    const blob = new Blob([bytes], { type });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;
    a.download = filename;

    document.body.appendChild(a);

    a.click();

    document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(url), 2000);

}

// ==========================
// Lock PDF
// ==========================
lockForm.addEventListener("submit", async (e) => {

    e.preventDefault();

    lockStatus.textContent = "Locking PDF...";

    try {

        const file = fileInput.files[0];

        const password = document
            .getElementById("lockPassword")
            .value
            .trim();

        const confirmPassword = document
            .getElementById("confirmPassword")
            .value
            .trim();

        if (!file) {
            lockStatus.textContent = "Please choose a PDF.";
            return;
        }

        if (!password) {
            lockStatus.textContent = "Please enter a password.";
            return;
        }

        if (password.length < 3) {
            lockStatus.textContent =
                "Password must be at least 3 characters.";
            return;
        }

        if (password !== confirmPassword) {
            lockStatus.textContent =
                "Passwords do not match.";
            return;
        }

        if (!encryptPDF) {
            lockStatus.textContent =
                "Encryption engine is not ready.";
            return;
        }

        const inputBytes = new Uint8Array(
            await file.arrayBuffer()
        );

        const encryptedBytes =
            await encryptPDF(inputBytes, password);

        const encryptedBlob = new Blob(
            [encryptedBytes],
            {
                type: "application/pdf"
            }
        );

        if (previewURL) {
            URL.revokeObjectURL(previewURL);
        }

        previewURL = URL.createObjectURL(encryptedBlob);

        preview.src = previewURL;

        preview.style.display = "block";

        if (placeholder) {
            placeholder.style.display = "none";
        }

        const baseName = file.name.replace(/\.pdf$/i, "");

        downloadBytes(
            encryptedBytes,
            `${baseName}_locked.pdf`,
            "application/pdf"
        );

        lockStatus.textContent =
            "PDF locked successfully.";

    } catch (err) {

        console.error(err);

        lockStatus.textContent =
            "Failed to lock PDF: " +
            (err.message || err);

    }

});
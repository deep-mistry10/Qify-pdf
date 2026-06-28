// ==========================
// Load HTML Component
// ==========================
async function loadComponent(id, file) {
    const element = document.getElementById(id);

    if (!element) return;

    try {
        const response = await fetch(file);

        if (!response.ok) {
            throw new Error(`${file} (${response.status})`);
        }

        element.innerHTML = await response.text();

    } catch (err) {
        console.error(`Error loading ${file}:`, err);
    }
}

// ==========================
// Load Common Layout
// ==========================
async function loadLayout() {

    await Promise.all([
        loadComponent("header", "/common/header.html"),
        loadComponent("footer", "/common/footer.html")
    ]);

    // Initialize common JavaScript AFTER components exist
    if (typeof initCommon === "function") {
        initCommon();
    } else {
        console.warn("initCommon() was not found.");
    }
}

// ==========================
// Start
// ==========================
document.addEventListener("DOMContentLoaded", () => {
    loadLayout();
});
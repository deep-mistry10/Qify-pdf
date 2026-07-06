// PDF.js Configuration
const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// State Management
let pdfDoc = null;
let pageNum = 1;

// UI Elements
const canvas = document.getElementById('pdfCanvas');
const ctx = canvas.getContext('2d');
const fileInput = document.getElementById('fileInput');
const pdfControls = document.getElementById('pdfControls');
const errorBox = document.getElementById('errorBox');
const pageSelect = document.getElementById('pageSelect');

// Event Listeners
fileInput.addEventListener('change', loadPDF);
document.getElementById('prevBtn').onclick = () => { if (pageNum > 1) renderPage(--pageNum); };
document.getElementById('nextBtn').onclick = () => { if (pageNum < pdfDoc.numPages) renderPage(++pageNum); };

document.getElementById('btnCurrent').onclick = async () => {
    const blob = await renderPageToBlob(pageNum);
    downloadBlob(blob, `page-${pageNum}.jpg`);
};

document.getElementById("btnSelected").onclick = async () => {
    const pages = [...pageSelect.selectedOptions].map(o => Number(o.value));
    if (pages.length === 0) return showError("Please select page(s).");

    if (pages.length === 1) {
        const blob = await renderPageToBlob(pages[0]);
        downloadBlob(blob, `page-${pages[0]}.jpg`);
    } else {
        const zip = new JSZip();
        for (const p of pages) {
            zip.file(`page-${p}.jpg`, await renderPageToBlob(p));
        }
        const content = await zip.generateAsync({ type: "blob" });
        downloadBlob(content, "Selected-Pages.zip");
    }
};

document.getElementById('btnAll').onclick = async () => {
    const zip = new JSZip();
    for (let i = 1; i <= pdfDoc.numPages; i++) {
        zip.file(`page-${i}.jpg`, await renderPageToBlob(i));
    }
    const content = await zip.generateAsync({ type: "blob" });
    downloadBlob(content, "PDF-All-JPEG.zip");
};

// Functions
async function loadPDF(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
        try {
            pdfDoc = await pdfjsLib.getDocument(new Uint8Array(reader.result)).promise;
            
            // UI Updates
            document.getElementById('fileName').textContent = file.name;
            document.getElementById('totalPages').textContent = pdfDoc.numPages;
            
            pageSelect.innerHTML = "";
            for (let i = 1; i <= pdfDoc.numPages; i++) {
                const opt = document.createElement("option");
                opt.value = i;
                opt.textContent = `Page ${i}`;
                pageSelect.appendChild(opt);
            }
            
            errorBox.classList.add("hidden");
            pdfControls.classList.remove("hidden");
            pageNum = 1;
            renderPage();
        } catch (err) {
            showError("Invalid or corrupted PDF");
        }
    };
    reader.readAsArrayBuffer(file);
}

async function renderPage(num = pageNum) {
    const page = await pdfDoc.getPage(num);
    const viewport = page.getViewport({ scale: 2.0 });
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    await page.render({ canvasContext: ctx, viewport: viewport }).promise;
    document.getElementById('pageIndicator').textContent = `Page ${num} / ${pdfDoc.numPages}`;
}

async function renderPageToBlob(num) {
    const page = await pdfDoc.getPage(num);
    const viewport = page.getViewport({ scale: 2.0 });
    const c = document.createElement('canvas');
    c.height = viewport.height;
    c.width = viewport.width;
    await page.render({ canvasContext: c.getContext('2d'), viewport }).promise;
    return new Promise(resolve => c.toBlob(resolve, 'image/jpeg', 1.0));
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function showError(msg) {
    errorBox.textContent = msg;
    errorBox.classList.remove('hidden');
}
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

/* =========================
   NAVBAR / DROPDOWN
========================= */
const menuBtn = document.getElementById("menuBtn");
const navMenu = document.getElementById("navMenu");

if (menuBtn && navMenu) {
  menuBtn.addEventListener("click", () => {
    navMenu.classList.toggle("open");
  });

  navMenu.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      navMenu.classList.remove("open");
    });
  });
}

const toolsDropdown = document.getElementById("toolsDropdown");
const toolsBtn = document.getElementById("toolsBtn");

if (toolsDropdown && toolsBtn) {
  let closeTimer;

  function openDropdown() {
    clearTimeout(closeTimer);
    toolsDropdown.classList.add("open");
  }

  function closeDropdownWithDelay() {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      toolsDropdown.classList.remove("open");
    }, 1200);
  }

  toolsDropdown.addEventListener("mouseenter", openDropdown);
  toolsDropdown.addEventListener("mouseleave", closeDropdownWithDelay);

  toolsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    clearTimeout(closeTimer);
    toolsDropdown.classList.toggle("open");
  });

  document.addEventListener("click", (e) => {
    if (!toolsDropdown.contains(e.target)) {
      closeDropdownWithDelay();
    }
  });
}

/* =========================
   PDF UNLOCKER
========================= */
async function openPDF() {
  const file = document.getElementById("pdfFile").files[0];
  const password = document.getElementById("password").value;
  const btn = document.getElementById("previewBtn");
  const infoBox = document.getElementById("pdfInfo");

  if (!file) {
    alert("Please select a PDF");
    return;
  }

  try {
    btn.textContent = "Loading...";

    const arrayBuffer = await file.arrayBuffer();

    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
      password: password
    }).promise;

    infoBox.style.display = "block";
    infoBox.innerHTML = `
      <div class="info-row">
        <strong>File:</strong>
        <div class="filename">${file.name}</div>
      </div>

      <div class="info-row">
        <strong>Pages:</strong>
        ${pdf.numPages}
      </div>

      <div class="info-row">
        <strong>Status:</strong>
        Password accepted. Preview loaded successfully.
      </div>
    `;

    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = document.getElementById("pdfCanvas");
    const ctx = canvas.getContext("2d");

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: ctx,
      viewport: viewport
    }).promise;

    btn.textContent = "Preview PDF";
  } catch (err) {
    console.error(err);
    btn.textContent = "Preview PDF";
    alert("Wrong password or invalid PDF.");
  }
}

async function downloadPDF() {
  const file = document.getElementById("pdfFile").files[0];
  const password = document.getElementById("password").value;
  const btn = document.getElementById("downloadBtn");

  if (!file) {
    alert("Please select a PDF");
    return;
  }

  try {
    btn.textContent = "Creating PDF...";

    const arrayBuffer = await file.arrayBuffer();

    const pdfDoc = await pdfjsLib.getDocument({
      data: arrayBuffer,
      password: password
    }).promise;

    const { jsPDF } = window.jspdf;

    let outputPdf = null;

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 4 });

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvasContext: ctx,
        viewport: viewport
      }).promise;

      const imgData = canvas.toDataURL("image/png");

      const originalViewport = page.getViewport({ scale: 1 });

      const pdfWidth = originalViewport.width * 25.4 / 72;
      const pdfHeight = originalViewport.height * 25.4 / 72;

if (pageNum === 1) {
  outputPdf = new jsPDF({
    orientation: pdfWidth > pdfHeight ? "landscape" : "portrait",
    unit: "mm",
    format: [pdfWidth, pdfHeight]
  });
} else {
  outputPdf.addPage([pdfWidth, pdfHeight]);
}

outputPdf.addImage(
  imgData,
  "PNG",
  0,
  0,
  pdfWidth,
  pdfHeight
);
    }

    const filename = file.name.replace(/\.pdf$/i, "");
    outputPdf.save(`UNLOCKED_${filename}.pdf`);

    btn.textContent = "Download PDF";
  } catch (err) {
    console.error(err);
    btn.textContent = "Download PDF";
    alert("Failed. Check password or PDF.");
  }
}
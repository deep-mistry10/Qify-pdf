pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const fileInput = document.getElementById('fileInput');
const textInput = document.getElementById('textInput');
const sizeInput = document.getElementById('sizeInput');
const opInput = document.getElementById('opInput');
const rotInput = document.getElementById('rotInput');
const sizeVal = document.getElementById('sizeVal');
const opVal = document.getElementById('opVal');
const rotVal = document.getElementById('rotVal');
const downloadBtn = document.getElementById('downloadBtn');
const statusEl = document.getElementById('status');
const canvas = document.getElementById('pdfCanvas');
const ctx = canvas.getContext('2d');
const colorInput = document.getElementById('colorInput');
const imageInput = document.getElementById("imageInput");


let watermarkImageBytes = null;
let watermarkImageType = null;
let watermarkImage = null;

imageInput.addEventListener("change", async (e) => {

    const file = e.target.files[0];
    if (!file) return;

    watermarkImageBytes = new Uint8Array(await file.arrayBuffer());
    watermarkImageType = file.type;

    watermarkImage = new Image();

    watermarkImage.onload = () => {
        drawWatermarkOnCanvas();
    };

    watermarkImage.src = URL.createObjectURL(file);

});

let pdfBytes = null;   // original file bytes
let pdfDoc = null;     // pdf.js document (for preview)
let baseImageData = null; // rendered page without watermark, to redraw fast

function getSettings() {
  return {
    text: textInput.value || 'WATERMARK',
    size: parseInt(sizeInput.value, 10),
    opacity: parseInt(opInput.value, 10) / 100,
    rotation: parseInt(rotInput.value, 10),
    color: colorInput.value
  };
}

function drawWatermarkOnCanvas() {
  if (!baseImageData) return;
  ctx.putImageData(baseImageData, 0, 0);
  const { text, size, opacity, rotation, color } = getSettings();
  const scale = canvas.width / canvas.dataset.pdfWidth; // scale factor used for preview render
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(-rotation * Math.PI / 180); // canvas y-down, rotate opposite of PDF convention visually
  ctx.globalAlpha = opacity;
if (watermarkImage) {

    const maxWidth = canvas.width * 0.35;

    const ratio = watermarkImage.height / watermarkImage.width;

    const width = maxWidth;

    const height = width * ratio;

    ctx.drawImage(
        watermarkImage,
        -width / 2,
        -height / 2,
        width,
        height
    );

} else {

    ctx.fillStyle = color;
    ctx.font = `bold ${size * scale}px Helvetica, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, 0);

}
  ctx.restore();
}

async function renderPreview() {
  if (!pdfDoc) return;
  const page = await pdfDoc.getPage(1);
  const viewport = page.getViewport({ scale: 1.2 });
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  canvas.dataset.pdfWidth = viewport.width;
  await page.render({ canvasContext: ctx, viewport }).promise;
  baseImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  drawWatermarkOnCanvas();
}

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  statusEl.textContent = 'Loading PDF...';
  const arrayBuffer = await file.arrayBuffer();
  pdfBytes = new Uint8Array(arrayBuffer);
  try {
    pdfDoc = await pdfjsLib.getDocument({ data: pdfBytes.slice() }).promise;
    await renderPreview();
    downloadBtn.disabled = false;
    statusEl.textContent = `Loaded. ${pdfDoc.numPages} page(s).`;
  } catch (err) {
    statusEl.textContent = 'Failed to load PDF: ' + err.message;
    downloadBtn.disabled = true;
  }
});

[sizeInput, opInput, rotInput, textInput, colorInput].forEach(el => {
  el.addEventListener('input', () => {
    sizeVal.textContent = sizeInput.value;
    opVal.textContent = (opInput.value / 100).toFixed(2);
    rotVal.textContent = rotInput.value;
    drawWatermarkOnCanvas();
  });
});

downloadBtn.addEventListener('click', async () => {
  if (!pdfBytes) return;
  downloadBtn.disabled = true;
  statusEl.textContent = 'Generating watermarked PDF...';
  try {
    const { PDFDocument, rgb, degrees, StandardFonts } = PDFLib;
    const doc = await PDFDocument.load(pdfBytes.slice());
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    const { text, size, opacity, rotation, color } = getSettings();
    const pages = doc.getPages();

    let embeddedImage = null;

if (watermarkImageBytes) {

    if (watermarkImageType === "image/png") {

        embeddedImage = await doc.embedPng(watermarkImageBytes);

    } else {

        embeddedImage = await doc.embedJpg(watermarkImageBytes);

    }

  }

for (const page of pages) {
      const { width, height } = page.getSize();
      const textWidth = font.widthOfTextAtSize(text, size);
      const halfW = textWidth / 2;
      const halfH = size * 0.35; // approx half text height above baseline

      // pdf-lib rotates text around the (x,y) anchor point itself (counter-
      // clockwise), not around the text's visual center. To make the text
      // land centered on the page regardless of rotation, we solve for the
      // anchor point that, once rotated, puts the text's center at (cx, cy).
      const cx = width / 2;
      const cy = height / 2;
      const angleRad = (rotation * Math.PI) / 180;
      const cos = Math.cos(angleRad);
      const sin = Math.sin(angleRad);
      const anchorX = cx - (halfW * cos - halfH * sin);
      const anchorY = cy - (halfW * sin + halfH * cos);

      if (embeddedImage) {

    const imgWidth = width * 0.35;

    const imgHeight =
        imgWidth *
        (embeddedImage.height / embeddedImage.width);

    page.drawImage(embeddedImage, {

        x: (width - imgWidth) / 2,

        y: (height - imgHeight) / 2,

        width: imgWidth,

        height: imgHeight,

        opacity,

        rotate: degrees(rotation)

    });

} else {

    page.drawText(text, {
        x: anchorX,
        y: anchorY,
        size,
        font,
        color: rgb(
            parseInt(color.slice(1, 3), 16) / 255,
            parseInt(color.slice(3, 5), 16) / 255,
            parseInt(color.slice(5, 7), 16) / 255
        ),
        opacity,
        rotate: degrees(rotation)
    });

}
}

    const outBytes = await doc.save();
    const blob = new Blob([outBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'watermarked.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    statusEl.textContent = 'Done. File downloaded.';
  } catch (err) {
    statusEl.textContent = 'Error: ' + err.message;
  } finally {
    downloadBtn.disabled = false;
  }
});
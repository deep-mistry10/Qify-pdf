pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const dropzone   = document.getElementById('dropzone');
const fileInput  = document.getElementById('fileInput');
const chooseBtn  = document.getElementById('chooseBtn');
const editor     = document.getElementById('editor');
const canvasWrap = document.getElementById('canvasWrap');
const canvasInner= document.getElementById('canvasInner');
const canvas     = document.getElementById('pageCanvas');
const cropBox    = document.getElementById('cropBox');
const prevBtn    = document.getElementById('prevBtn');
const nextBtn    = document.getElementById('nextBtn');
const pageIndicator = document.getElementById('pageIndicator');
const applyAllChk = document.getElementById('applyAllChk');
const newBtn     = document.getElementById('newBtn');
const resetBtn   = document.getElementById('resetBtn');
const cropBtn    = document.getElementById('cropBtn');
const statusEl   = document.getElementById('status');

let originalBytes = null;   // pristine ArrayBuffer, kept for pdf-lib export
let pdfDoc = null;           // pdfjs document
let numPages = 0;
let currentPage = 1;
let fileName = 'document.pdf';

let cropFraction = null;     // {x,y,w,h} in [0,1], relative to page box, y measured from TOP
let cropPx = {x:0,y:0,w:0,h:0}; // current on-screen rect in CSS px, matches canvas display size

const MIN_PX = 24;

function setStatus(msg, isErr){
  statusEl.textContent = msg || '';
  statusEl.classList.toggle('err', !!isErr);
}

function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }

/* ---------- File loading ---------- */

chooseBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', e => {
  if (e.target.files[0]) loadPDF(e.target.files[0]);
});

['dragenter','dragover'].forEach(evt =>
  dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.add('drag'); })
);
['dragleave','drop'].forEach(evt =>
  dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.remove('drag'); })
);
dropzone.addEventListener('drop', e => {
  const f = e.dataTransfer.files && e.dataTransfer.files[0];
  if (f && f.type === 'application/pdf') loadPDF(f);
  else if (f) setStatus('Please drop a PDF file.', true);
});

newBtn.addEventListener('click', () => {
  editor.classList.add('hidden');
  dropzone.classList.remove('hidden');
  fileInput.value = '';
  pdfDoc = null;
  originalBytes = null;
  cropFraction = null;
  setStatus('');
});

async function loadPDF(file){
  try{
    setStatus('Loading…');
    fileName = file.name ? file.name.replace(/\.pdf$/i,'') : 'document';
    const buf = await file.arrayBuffer();
    originalBytes = buf.slice(0);
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buf.slice(0)) });
    pdfDoc = await loadingTask.promise;
    numPages = pdfDoc.numPages;
    currentPage = 1;
    cropFraction = null;
    dropzone.classList.add('hidden');
    editor.classList.remove('hidden');
    await renderPage(currentPage);
    setStatus('');
  }catch(err){
    console.error(err);
    setStatus('Could not read that PDF. Try another file.', true);
  }
}

/* ---------- Rendering ---------- */

async function renderPage(num){
  const page = await pdfDoc.getPage(num);
  const containerWidth = Math.max(280, canvasWrap.clientWidth - 40);
  const containerHeight = Math.max(280, canvasWrap.clientHeight - 40);
  const base = page.getViewport({ scale: 1 });

  let scale = containerWidth / base.width;
  if (base.height * scale > containerHeight) {
    scale = containerHeight / base.height;
  }
  scale = Math.max(scale, 0.1);

  const viewport = page.getViewport({ scale });
  const outputScale = window.devicePixelRatio || 1;

  canvas.width = Math.floor(viewport.width * outputScale);
  canvas.height = Math.floor(viewport.height * outputScale);
  canvas.style.width = viewport.width + 'px';
  canvas.style.height = viewport.height + 'px';
  canvasInner.style.width = viewport.width + 'px';
  canvasInner.style.height = viewport.height + 'px';

  const ctx = canvas.getContext('2d');
  const transform = outputScale !== 1 ? [outputScale,0,0,outputScale,0,0] : null;
  await page.render({ canvasContext: ctx, viewport, transform }).promise;

  if (!cropFraction){
    cropFraction = { x:0.05, y:0.05, w:0.9, h:0.9 };
  }
  applyFractionToPx();
  updatePageIndicator();
}

function applyFractionToPx(){
  const w = canvas.clientWidth, h = canvas.clientHeight;
  cropPx = {
    x: cropFraction.x * w,
    y: cropFraction.y * h,
    w: cropFraction.w * w,
    h: cropFraction.h * h
  };
  drawCropBox();
}

function drawCropBox(){
  cropBox.style.left   = cropPx.x + 'px';
  cropBox.style.top    = cropPx.y + 'px';
  cropBox.style.width  = cropPx.w + 'px';
  cropBox.style.height = cropPx.h + 'px';
}

function pxToFraction(){
  const w = canvas.clientWidth, h = canvas.clientHeight;
  cropFraction = {
    x: cropPx.x / w,
    y: cropPx.y / h,
    w: cropPx.w / w,
    h: cropPx.h / h
  };
}

function updatePageIndicator(){
  pageIndicator.textContent = `${currentPage} / ${numPages}`;
  prevBtn.disabled = currentPage <= 1;
  nextBtn.disabled = currentPage >= numPages;
}

/* ---------- Page navigation ---------- */

prevBtn.addEventListener('click', async () => {
  if (currentPage > 1){ currentPage--; await renderPage(currentPage); }
});
nextBtn.addEventListener('click', async () => {
  if (currentPage < numPages){ currentPage++; await renderPage(currentPage); }
});

resetBtn.addEventListener('click', () => {
  cropFraction = { x:0.05, y:0.05, w:0.9, h:0.9 };
  applyFractionToPx();
});

let resizeTimer = null;
window.addEventListener('resize', () => {
  if (!pdfDoc) return;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => renderPage(currentPage), 150);
});

/* ---------- Drag / resize crop box (pointer events: mouse + touch) ---------- */

cropBox.addEventListener('pointerdown', e => {
  if (e.target !== cropBox) return; // handles manage themselves
  e.preventDefault();
  cropBox.setPointerCapture(e.pointerId);
  const start = { x:e.clientX, y:e.clientY };
  const startRect = { ...cropPx };
  const maxW = canvas.clientWidth, maxH = canvas.clientHeight;

  function onMove(ev){
    const dx = ev.clientX - start.x;
    const dy = ev.clientY - start.y;
    cropPx.x = clamp(startRect.x + dx, 0, maxW - startRect.w);
    cropPx.y = clamp(startRect.y + dy, 0, maxH - startRect.h);
    drawCropBox();
  }
  function onUp(){
    cropBox.releasePointerCapture(e.pointerId);
    cropBox.removeEventListener('pointermove', onMove);
    cropBox.removeEventListener('pointerup', onUp);
    pxToFraction();
  }
  cropBox.addEventListener('pointermove', onMove);
  cropBox.addEventListener('pointerup', onUp);
});

document.querySelectorAll('.handle').forEach(handle => {
  const dir = handle.dataset.h;
  handle.addEventListener('pointerdown', e => {
    e.preventDefault();
    e.stopPropagation();
    handle.setPointerCapture(e.pointerId);
    const start = { x:e.clientX, y:e.clientY };
    const startRect = { ...cropPx };
    const maxW = canvas.clientWidth, maxH = canvas.clientHeight;

    function onMove(ev){
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      let { x, y, w, h } = startRect;

      if (dir.includes('e')) w = clamp(startRect.w + dx, MIN_PX, maxW - x);
      if (dir.includes('s')) h = clamp(startRect.h + dy, MIN_PX, maxH - y);
      if (dir.includes('w')) {
        const newX = clamp(startRect.x + dx, 0, startRect.x + startRect.w - MIN_PX);
        w = startRect.w + (startRect.x - newX);
        x = newX;
      }
      if (dir.includes('n')) {
        const newY = clamp(startRect.y + dy, 0, startRect.y + startRect.h - MIN_PX);
        h = startRect.h + (startRect.y - newY);
        y = newY;
      }
      cropPx = { x, y, w, h };
      drawCropBox();
    }
    function onUp(){
      handle.releasePointerCapture(e.pointerId);
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      pxToFraction();
    }
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
  });
});

/* ---------- Crop & export ---------- */

cropBtn.addEventListener('click', async () => {
  if (!originalBytes || !cropFraction) return;
  cropBtn.disabled = true;
  setStatus('Cropping…');
  try{
    const { PDFDocument } = PDFLib;
    const doc = await PDFDocument.load(originalBytes.slice(0));
    const pages = doc.getPages();
    const applyAll = applyAllChk.checked;
    const targets = applyAll ? pages : [pages[currentPage - 1]];

    const fx = clamp(cropFraction.x, 0, 1);
    const fy = clamp(cropFraction.y, 0, 1);
    const fw = clamp(cropFraction.w, 0.01, 1 - fx);
    const fh = clamp(cropFraction.h, 0.01, 1 - fy);

    targets.forEach(page => {
      // 1. Get the current box offset (falls back to MediaBox if no CropBox exists)
      const box = page.getCropBox() || page.getMediaBox();
      
      // 2. Calculate the new width and height based on the current box dimensions
      const cropW = fw * box.width;
      const cropH = fh * box.height;
      
      // 3. Add the existing X offset to our new X calculation
      const cropX = box.x + (fx * box.width);
      
      // 4. Calculate the Y axis (PDFs measure Y from the bottom up!)
      // The current top edge is (box.y + box.height). We subtract our fraction from the top down.
      const cropY = (box.y + box.height) - (fy * box.height) - cropH; 
      
      // Apply the new, accurate box
      page.setCropBox(cropX, cropY, cropW, cropH);
      page.setMediaBox(cropX, cropY, cropW, cropH);
    });

    const outBytes = await doc.save();
    const blob = new Blob([outBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}-cropped.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    setStatus('Done — download started.');
  }catch(err){
    console.error(err);
    setStatus('Something went wrong while cropping.', true);
  }finally{
    cropBtn.disabled = false;
  }
});
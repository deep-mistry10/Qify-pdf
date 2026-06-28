(function(){
  'use strict';

  // pdf.js worker setup
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  const { PDFDocument } = PDFLib;

  // ---- State ----
  let originalBytes = null;     // ArrayBuffer of the uploaded PDF (kept pristine)
  let pdfLibDoc = null;         // pdf-lib document (loaded fresh per-operation from originalBytes)
  let pdfJsDoc = null;          // pdf.js document for rendering thumbnails
  let numPages = 0;
  let fileBaseName = "document";
  let currentMode = "every";
  let selectedPages = new Set(); // 0-indexed
  let producedFiles = [];        // {name, bytes}

  // ---- DOM refs ----
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const loadingRow = document.getElementById('loadingRow');
  const loadingText = document.getElementById('loadingText');
  const errorBox = document.getElementById('errorBox');
  const docInfo = document.getElementById('docInfo');
  const fNameEl = document.getElementById('fName');
  const fSubEl = document.getElementById('fSub');
  const clearBtn = document.getElementById('clearBtn');
  const modeTabs = document.getElementById('modeTabs');
  const controls = document.getElementById('controls');
  const thumbGrid = document.getElementById('thumbGrid');
  const actionRow = document.getElementById('actionRow');
  const splitBtn = document.getElementById('splitBtn');
  const selCountEl = document.getElementById('selCount');
  const resultsEl = document.getElementById('results');
  const resultList = document.getElementById('resultList');
  const downloadAllBtn = document.getElementById('downloadAllBtn');
  const startOverBtn = document.getElementById('startOverBtn');

  const rangeFrom = document.getElementById('rangeFrom');
  const rangeTo = document.getElementById('rangeTo');
  const customRanges = document.getElementById('customRanges');
  const selectOutputMode = document.getElementById('selectOutputMode');

  // ---- Helpers ----
  function showError(msg){
    errorBox.textContent = msg;
    errorBox.style.display = 'block';
    setTimeout(()=>{ errorBox.style.display = 'none'; }, 6000);
  }

  function formatBytes(bytes){
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
    return (bytes/(1024*1024)).toFixed(2) + ' MB';
  }

  function resetAll(){
    originalBytes = null;
    pdfLibDoc = null;
    pdfJsDoc = null;
    numPages = 0;
    selectedPages = new Set();
    producedFiles = [];
    fileInput.value = '';
    docInfo.style.display = 'none';
    modeTabs.style.display = 'none';
    controls.style.display = 'none';
    thumbGrid.style.display = 'none';
    thumbGrid.innerHTML = '';
    actionRow.style.display = 'none';
    resultsEl.style.display = 'none';
    resultList.innerHTML = '';
    dropzone.style.display = 'block';
  }

  // ---- File loading ----
  async function handleFile(file){
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')){
      showError('Please select a valid PDF file.');
      return;
    }

    loadingRow.style.display = 'flex';
    loadingText.textContent = 'Reading PDF…';
    dropzone.style.display = 'none';

    try {
      const buf = await file.arrayBuffer();
      originalBytes = buf;
      fileBaseName = file.name.replace(/\.pdf$/i, '') || 'document';

      // Load with pdf-lib to validate & get page count
      pdfLibDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
      numPages = pdfLibDoc.getPageCount();

      if (numPages === 0){
        throw new Error('This PDF has no pages.');
      }

      // Load with pdf.js for rendering (separate copy of bytes, since pdf.js may detach buffer)
      loadingText.textContent = 'Preparing preview…';
      pdfJsDoc = await pdfjsLib.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise;

      // Update UI
      fNameEl.textContent = file.name;
      fSubEl.textContent = `${numPages} page${numPages !== 1 ? 's' : ''} · ${formatBytes(file.size)}`;
      docInfo.style.display = 'flex';
      modeTabs.style.display = 'flex';
      controls.style.display = 'block';
      actionRow.style.display = 'flex';

      rangeFrom.value = 1;
      rangeFrom.max = numPages;
      rangeTo.value = numPages;
      rangeTo.max = numPages;

      setMode('every');
    } catch (err){
      console.error(err);
      showError('Could not read this PDF. It may be corrupted, password-protected, or not a valid PDF. (' + err.message + ')');
      resetAll();
    } finally {
      loadingRow.style.display = 'none';
    }
  }

  // ---- Mode switching ----
  function setMode(mode){
    currentMode = mode;
    document.querySelectorAll('#modeTabs button').forEach(b=>{
      b.classList.toggle('active', b.dataset.mode === mode);
    });
    document.querySelectorAll('.modePanel').forEach(p => p.style.display = 'none');
    document.getElementById('panel-' + mode).style.display = 'block';

    if (mode === 'select'){
      thumbGrid.style.display = 'grid';
      renderThumbnails();
      updateSelCount();
    } else {
      thumbGrid.style.display = 'none';
      selCountEl.textContent = '';
    }
  }

  modeTabs.addEventListener('click', (e)=>{
    const btn = e.target.closest('button');
    if (!btn) return;
    setMode(btn.dataset.mode);
  });

  // ---- Thumbnail rendering (lazy, sequential to keep memory sane) ----
  let thumbsRendered = false;
  async function renderThumbnails(){
    if (thumbsRendered) return;
    thumbsRendered = true;
    thumbGrid.innerHTML = '';

    for (let i = 0; i < numPages; i++){
      const card = document.createElement('div');
      card.className = 'thumbCard';
      card.dataset.pageIndex = i;
      card.innerHTML = `
        <div class="checkDot">✓</div>
        <div class="thumbPlaceholder"></div>
        <div class="pNum">Page ${i+1}</div>
      `;
      card.addEventListener('click', ()=> toggleSelect(i));
      thumbGrid.appendChild(card);
    }

    // Render actual page previews progressively
    for (let i = 0; i < numPages; i++){
      try {
        const page = await pdfJsDoc.getPage(i+1);
        const viewport = page.getViewport({ scale: 0.35 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;

        const card = thumbGrid.children[i];
        const placeholder = card.querySelector('.thumbPlaceholder');
        if (placeholder) placeholder.replaceWith(canvas);
      } catch (err){
        console.warn('thumb render failed for page', i+1, err);
      }
    }
  }

  function toggleSelect(i){
    const card = thumbGrid.children[i];
    if (selectedPages.has(i)){
      selectedPages.delete(i);
      card.classList.remove('selected');
    } else {
      selectedPages.add(i);
      card.classList.add('selected');
    }
    updateSelCount();
  }

  function updateSelCount(){
    selCountEl.textContent = selectedPages.size > 0
      ? `${selectedPages.size} page${selectedPages.size !== 1 ? 's' : ''} selected`
      : 'No pages selected yet';
  }

  document.getElementById('selectAllBtn').addEventListener('click', ()=>{
    selectedPages = new Set(Array.from({length: numPages}, (_,i)=>i));
    syncThumbSelectionUI();
  });
  document.getElementById('selectNoneBtn').addEventListener('click', ()=>{
    selectedPages.clear();
    syncThumbSelectionUI();
  });
  document.getElementById('selectOddBtn').addEventListener('click', ()=>{
    selectedPages = new Set(Array.from({length: numPages}, (_,i)=>i).filter(i => (i+1) % 2 === 1));
    syncThumbSelectionUI();
  });
  document.getElementById('selectEvenBtn').addEventListener('click', ()=>{
    selectedPages = new Set(Array.from({length: numPages}, (_,i)=>i).filter(i => (i+1) % 2 === 0));
    syncThumbSelectionUI();
  });
  function syncThumbSelectionUI(){
    Array.from(thumbGrid.children).forEach((card, i)=>{
      card.classList.toggle('selected', selectedPages.has(i));
    });
    updateSelCount();
  }

  // ---- Parse custom range string like "1-3, 5, 8-10" ----
  function parseRangeString(str, maxPage){
    const groups = str.split(',').map(s => s.trim()).filter(Boolean);
    if (groups.length === 0) throw new Error('Please enter at least one page or range.');

    const result = [];
    for (const g of groups){
      const m = g.match(/^(\d+)\s*-\s*(\d+)$/);
      if (m){
        let a = parseInt(m[1], 10), b = parseInt(m[2], 10);
        if (a > b) [a,b] = [b,a];
        if (a < 1 || b > maxPage) throw new Error(`Range "${g}" is out of bounds (1–${maxPage}).`);
        const pages = [];
        for (let p = a; p <= b; p++) pages.push(p-1);
        result.push({ label: a === b ? `p${a}` : `p${a}-${b}`, pages });
      } else if (/^\d+$/.test(g)){
        const p = parseInt(g, 10);
        if (p < 1 || p > maxPage) throw new Error(`Page ${p} is out of bounds (1–${maxPage}).`);
        result.push({ label: `p${p}`, pages: [p-1] });
      } else {
        throw new Error(`Could not understand "${g}". Use formats like "1-3" or "5".`);
      }
    }
    return result;
  }

  // ---- Build a PDF file (Uint8Array) from a list of 0-indexed page numbers, using a fresh load each time ----
  async function buildPdfFromPages(pageIndices){
    const srcDoc = await PDFDocument.load(originalBytes, { ignoreEncryption: true });
    const newDoc = await PDFDocument.create();
    const copied = await newDoc.copyPages(srcDoc, pageIndices);
    copied.forEach(p => newDoc.addPage(p));
    return await newDoc.save();
  }

  // ---- Main split action ----
  splitBtn.addEventListener('click', async ()=>{
    errorBox.style.display = 'none';
    try {
      let jobs = []; // [{name, pages: [0-indexed...]}]

      if (currentMode === 'every'){
        for (let i = 0; i < numPages; i++){
          jobs.push({ name: `${fileBaseName}_page_${i+1}.pdf`, pages: [i] });
        }
      } else if (currentMode === 'range'){
        const from = parseInt(rangeFrom.value, 10);
        const to = parseInt(rangeTo.value, 10);
        if (!from || !to || from < 1 || to > numPages || from > to){
          throw new Error(`Enter a valid range between 1 and ${numPages}.`);
        }
        const pages = [];
        for (let p = from; p <= to; p++) pages.push(p-1);
        jobs.push({ name: `${fileBaseName}_p${from}-${to}.pdf`, pages });
      } else if (currentMode === 'custom'){
        const groups = parseRangeString(customRanges.value, numPages);
        groups.forEach(g => {
          jobs.push({ name: `${fileBaseName}_${g.label}.pdf`, pages: g.pages });
        });
      } else if (currentMode === 'select'){
        if (selectedPages.size === 0){
          throw new Error('Select at least one page first.');
        }
        const sorted = Array.from(selectedPages).sort((a,b)=>a-b);
        if (selectOutputMode.value === 'single'){
          jobs.push({ name: `${fileBaseName}_selected_pages.pdf`, pages: sorted });
        } else {
          sorted.forEach(i => {
            jobs.push({ name: `${fileBaseName}_page_${i+1}.pdf`, pages: [i] });
          });
        }
      }

      if (jobs.length === 0) throw new Error('Nothing to split — check your settings.');

      splitBtn.disabled = true;
      splitBtn.textContent = '⏳ Splitting…';

      producedFiles = [];
      for (const job of jobs){
        const bytes = await buildPdfFromPages(job.pages);
        producedFiles.push({ name: job.name, bytes });
      }

      renderResults();
    } catch (err){
      console.error(err);
      showError(err.message || 'Something went wrong while splitting the PDF.');
    } finally {
      splitBtn.disabled = false;
      splitBtn.textContent = '✂️ Split PDF';
    }
  });

  function renderResults(){
    resultList.innerHTML = '';
    producedFiles.forEach((f) => {
      const blob = new Blob([f.bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const row = document.createElement('div');
      row.className = 'resultItem';
      row.innerHTML = `
        <div class="rInfo">
          <span class="rIcon">📄</span>
          <div>
            <div class="rName">${f.name}</div>
            <div class="rMeta">${formatBytes(f.bytes.byteLength)}</div>
          </div>
        </div>
        <a class="rDownload" href="${url}" download="${f.name}">⬇ Download</a>
      `;
      resultList.appendChild(row);
    });

    resultsEl.style.display = 'block';
    resultsEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  downloadAllBtn.addEventListener('click', async ()=>{
    if (producedFiles.length === 0) return;
    downloadAllBtn.disabled = true;
    downloadAllBtn.textContent = '⏳ Zipping…';
    try {
      const zip = new JSZip();
      producedFiles.forEach(f => zip.file(f.name, f.bytes));
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileBaseName}_split.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(()=> URL.revokeObjectURL(url), 4000);
    } catch (err){
      console.error(err);
      showError('Could not create the zip file.');
    } finally {
      downloadAllBtn.disabled = false;
      downloadAllBtn.textContent = '⬇ Download all as .zip';
    }
  });

  startOverBtn.addEventListener('click', resetAll);
  clearBtn.addEventListener('click', resetAll);

  // ---- Drag & drop / file input wiring ----
  dropzone.addEventListener('click', ()=> fileInput.click());
  fileInput.addEventListener('change', (e)=> handleFile(e.target.files[0]));

  ['dragenter','dragover'].forEach(evt=>{
    dropzone.addEventListener(evt, (e)=>{
      e.preventDefault();
      dropzone.classList.add('drag');
    });
  });
  ['dragleave','dragend'].forEach(evt=>{
    dropzone.addEventListener(evt, (e)=>{
      e.preventDefault();
      dropzone.classList.remove('drag');
    });
  });
  dropzone.addEventListener('drop', (e)=>{
    e.preventDefault();
    dropzone.classList.remove('drag');
    const file = e.dataTransfer.files[0];
    handleFile(file);
  });

  // Prevent default browser behavior when dragging over the whole page
  window.addEventListener('dragover', (e)=> e.preventDefault());
  window.addEventListener('drop', (e)=> e.preventDefault());

})();
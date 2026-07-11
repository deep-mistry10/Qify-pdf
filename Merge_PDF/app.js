/* ==========================================================================
   QIFY — PDF Merger
   Fully client-side PDF merging using pdf-lib. No backend, no uploads.
   ========================================================================== */

(function () {
  'use strict';

  const { PDFDocument } = PDFLib;
  
  let fileEntries = [];
  let mergedBytes = null;
  let mergedFileName = 'merged_document.pdf';
  let idCounter = 0;

  // ---- DOM refs ----
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const errorBox = document.getElementById('errorBox');
  const fileListContainer = document.getElementById('fileListContainer');
  const fileList = document.getElementById('fileList');
  const addMoreBtn = document.getElementById('addMoreBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const actionRow = document.getElementById('actionRow');
  const mergeBtn = document.getElementById('mergeBtn');
  const statusText = document.getElementById('statusText');
  const preMergeState = document.getElementById('preMergeState');
  const resultsEl = document.getElementById('results');
  const mergedFileNameEl = document.getElementById('mergedFileName');
  const mergedFileMetaEl = document.getElementById('mergedFileMeta');
  const downloadBtn = document.getElementById('downloadBtn');
  const startOverBtn = document.getElementById('startOverBtn');

  // ---- Helpers ----
  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.style.display = 'block';
    clearTimeout(showError._t);
    showError._t = setTimeout(() => { errorBox.style.display = 'none'; }, 6000);
  }

  function clearError() {
    errorBox.style.display = 'none';
  }

  function totalSize() {
    return fileEntries.reduce((sum, f) => sum + f.size, 0);
  }

  function updateUIState() {
    const hasFiles = fileEntries.length > 0;
    fileListContainer.style.display = hasFiles ? 'block' : 'none';
    actionRow.style.display = hasFiles ? 'block' : 'none';
    preMergeState.style.display = hasFiles ? 'none' : 'block';

    // Need at least 2 files to merge
    mergeBtn.disabled = fileEntries.length < 2;
    mergeBtn.style.opacity = fileEntries.length < 2 ? '0.55' : '1';
    mergeBtn.style.cursor = fileEntries.length < 2 ? 'not-allowed' : 'pointer';

    if (fileEntries.length === 1) {
      mergeBtn.textContent = 'Add one more file to merge';
    } else {
      mergeBtn.textContent = 'Merge PDFs';
    }
  }

  // ---- File ingestion ----
  async function addFiles(fileListArg) {
    clearError();
    const incoming = Array.from(fileListArg || []);
    if (incoming.length === 0) return;

    const accepted = [];
    const rejected = [];

    for (const file of incoming) {
      const isPdf =
        file.type === 'application/pdf' ||
        file.name.toLowerCase().endsWith('.pdf');
      if (isPdf) {
        accepted.push(file);
      } else {
        rejected.push(file.name);
      }
    }

    if (rejected.length > 0) {
      showError(
        `Skipped ${rejected.length} non-PDF file${rejected.length > 1 ? 's' : ''}: ${rejected.join(', ')}`
      );
    }

    for (const file of accepted) {
      try {
        const buf = await file.arrayBuffer();

        // Validate it's actually a readable PDF (and not encrypted in a way pdf-lib can't open)
        try {
          await PDFDocument.load(buf, { ignoreEncryption: true });
        } catch (err) {
          showError(`"${file.name}" couldn't be read as a valid PDF — skipped.`);
          continue;
        }

        fileEntries.push({
          id: ++idCounter,
          file,
          name: file.name,
          size: file.size,
          bytes: buf,
        });
      } catch (err) {
        console.error(err);
        showError(`Failed to read "${file.name}".`);
      }
    }

    renderFileList();
    updateUIState();
    // Reset the input so selecting the same file again still fires 'change'
    fileInput.value = '';
  }

  // ---- Render the sortable file list ----
  function renderFileList() {
    fileList.innerHTML = '';

    fileEntries.forEach((entry, index) => {
      const row = document.createElement('div');
      row.className = 'file-sort-item';
      row.draggable = true;
      row.dataset.id = entry.id;

      row.innerHTML = `
        <div class="file-details">
          <span class="drag-handle" title="Drag to reorder">⠿</span>
          <span style="font-weight:900; opacity:0.55; min-width: 22px;">${index + 1}.</span>
          <div style="overflow:hidden;">
            <div class="file-name">${escapeHtml(entry.name)}</div>
            <div class="file-size">${formatBytes(entry.size)}</div>
          </div>
        </div>
        <button type="button" class="remove-file" data-id="${entry.id}" title="Remove">✕</button>
      `;

      fileList.appendChild(row);
    });

    wireDragAndDrop();
    wireRemoveButtons();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---- Remove individual file ----
  function wireRemoveButtons() {
    fileList.querySelectorAll('.remove-file').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.id);
        fileEntries = fileEntries.filter((f) => f.id !== id);
        renderFileList();
        updateUIState();
      });
    });
  }

  // ---- Drag & drop reordering of the file list ----
  function wireDragAndDrop() {
    const items = Array.from(fileList.querySelectorAll('.file-sort-item'));
    let dragEl = null;

    items.forEach((item) => {
      item.addEventListener('dragstart', (e) => {
        dragEl = item;
        item.style.opacity = '0.4';
        e.dataTransfer.effectAllowed = 'move';
        // Some browsers require setData to enable drag
        e.dataTransfer.setData('text/plain', item.dataset.id);
      });

      item.addEventListener('dragend', () => {
        item.style.opacity = '';
        dragEl = null;
        // Persist new order into fileEntries based on current DOM order
        syncOrderFromDOM();
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!dragEl || dragEl === item) return;
        const rect = item.getBoundingClientRect();
        const offset = e.clientY - rect.top;
        if (offset > rect.height / 2) {
          item.after(dragEl);
        } else {
          item.before(dragEl);
        }
      });

      // Touch support fallback: drag handle taps still work via native HTML5 DnD on most mobile browsers,
      // but we also support simple up/down reordering via keyboard for accessibility.
      item.addEventListener('dragenter', (e) => e.preventDefault());
    });
  }

  function syncOrderFromDOM() {
    const orderedIds = Array.from(fileList.querySelectorAll('.file-sort-item')).map(
      (el) => Number(el.dataset.id)
    );
    const byId = new Map(fileEntries.map((f) => [f.id, f]));
    fileEntries = orderedIds.map((id) => byId.get(id)).filter(Boolean);
    renderFileList(); // re-render to update the index numbers
  }

  // ---- Merge action ----
  async function mergePdfs() {
    if (fileEntries.length < 2) {
      showError('Add at least two PDF files to merge.');
      return;
    }

    clearError();
    mergeBtn.disabled = true;
    statusText.style.display = 'block';
    statusText.textContent = 'Combining files...';

    try {
      const mergedDoc = await PDFDocument.create();

      for (const entry of fileEntries) {
        // Load a fresh copy of the bytes each time to avoid any mutation issues
        const srcDoc = await PDFDocument.load(entry.bytes.slice(0), { ignoreEncryption: true });
        const pageIndices = srcDoc.getPageIndices();
        const copiedPages = await mergedDoc.copyPages(srcDoc, pageIndices);
        copiedPages.forEach((page) => mergedDoc.addPage(page));
      }

      const bytes = await mergedDoc.save();
      mergedBytes = bytes;

      // Build an output filename from the first file's base name
      const firstBase = fileEntries[0].name.replace(/\.pdf$/i, '');
      mergedFileName =
        fileEntries.length > 1
          ? `${firstBase}_merged_${fileEntries.length}_files.pdf`
          : `${firstBase}_merged.pdf`;

      showResults();
    } catch (err) {
      console.error(err);
      showError('Something went wrong while merging the PDFs. Please check your files and try again.');
    } finally {
      mergeBtn.disabled = false;
      statusText.style.display = 'none';
    }
  }

  function showResults() {
    mergedFileNameEl.textContent = mergedFileName;
    mergedFileMetaEl.textContent = `${formatBytes(mergedBytes.byteLength)} · ${fileEntries.length} files combined · Ready for download`;
    resultsEl.style.display = 'block';
    preMergeState.style.display = 'none';
    resultsEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ---- Download ----
  function downloadMerged() {
    if (!mergedBytes) return;
    const blob = new Blob([mergedBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = mergedFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  // ---- Reset ----
  function resetAll() {
    fileEntries = [];
    mergedBytes = null;
    fileInput.value = '';
    fileList.innerHTML = '';
    resultsEl.style.display = 'none';
    clearError();
    updateUIState();
  }

  // ---- Wiring ----
  dropzone.addEventListener('click', () => fileInput.click());
  addMoreBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => addFiles(e.target.files));

  ['dragenter', 'dragover'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.style.outline = '3px solid #111';
      dropzone.style.background = 'var(--bg-alt)';
    });
  });
  ['dragleave', 'dragend'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.style.outline = '';
      dropzone.style.background = '';
    });
  });
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.style.outline = '';
    dropzone.style.background = '';
    addFiles(e.dataTransfer.files);
  });

  // Prevent the browser from navigating away if a PDF is dropped outside the dropzone
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());

  clearAllBtn.addEventListener('click', resetAll);
  mergeBtn.addEventListener('click', mergePdfs);
  downloadBtn.addEventListener('click', downloadMerged);
  startOverBtn.addEventListener('click', resetAll);

  // ---- Mobile nav + dropdown (present in markup, wired for completeness) ----
  const menuBtn = document.getElementById('menuBtn');
  const navMenu = document.getElementById('navMenu');
  if (menuBtn && navMenu) {
    menuBtn.addEventListener('click', () => {
      navMenu.classList.toggle('open');
    });
  }

  const toolsDropdown = document.getElementById('toolsDropdown');
  const toolsBtn = document.getElementById('toolsBtn');
  if (toolsDropdown && toolsBtn) {
    toolsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toolsDropdown.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
      if (!toolsDropdown.contains(e.target)) {
        toolsDropdown.classList.remove('open');
      }
    });
  }

  // ---- Initial state ----
  updateUIState();
})();
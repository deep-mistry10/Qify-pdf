/* =========================================================================
   Pressroom — script.js
   Everything here runs locally in the browser. No image ever leaves the
   tab: files are read with FileReader, previewed as data URLs, and handed
   straight to jsPDF for assembly. Nothing is uploaded anywhere.
   ========================================================================= */

(() => {
  'use strict';

  /* ----------------------------- DOM refs ----------------------------- */

  const dropzone      = document.getElementById('dropzone');
  const fileInput      = document.getElementById('file-input');
  const browseBtn      = document.getElementById('browse-btn');

  const traySection    = document.getElementById('tray-section');
  const tray           = document.getElementById('tray');
  const pageCountEl    = document.getElementById('page-count');

  const actionBar       = document.getElementById('action-bar');
  const actionStatus    = document.getElementById('action-status');
  const clearBtn         = document.getElementById('clear-btn');
  const convertBtn       = document.getElementById('convert-btn');
  const downloadBtn      = document.getElementById('download-btn');

  const loadingOverlay  = document.getElementById('loading-overlay');
  const loadingText     = document.getElementById('loading-text');
  const progressFill    = document.getElementById('progress-fill');

  const toastEl          = document.getElementById('toast');

  /* ----------------------------- App state ----------------------------- */

  // Each entry: { id, file, name, dataUrl, width, height, mime }
  let images = [];

  // Holds the most recently generated PDF, ready to hand to the user.
  // Cleared whenever the page list changes so a stale PDF can't be downloaded.
  let pdfBlob = null;

  // A4 page size in millimetres (portrait), used for every page.
  const PAGE_WIDTH_MM  = 210;
  const PAGE_HEIGHT_MM = 297;
  const PAGE_MARGIN_MM = 10; // breathing room around each fitted image

  let dragSourceId = null; // id of the tray card currently being dragged

  /* ============================ File intake ============================ */

  // Clicking (or pressing Enter/Space on) the dropzone opens the file picker.
  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });
  browseBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // don't double-trigger the dropzone's own click handler
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
    fileInput.value = ''; // allow re-selecting the same file later
  });

  // Drag & drop onto the zone.
  ['dragenter', 'dragover'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    });
  });
  ['dragleave', 'dragend'].forEach((evt) => {
    dropzone.addEventListener(evt, () => dropzone.classList.remove('drag-over'));
  });
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
  });

  /**
   * Filters the given FileList down to JPG/PNG images, reads each one as a
   * data URL, discovers its pixel dimensions, and appends the results to
   * `images` in the order they were selected/dropped.
   */
  function handleFiles(fileList) {
    const candidates = Array.from(fileList);
    const accepted = candidates.filter(isSupportedImage);
    const skipped = candidates.length - accepted.length;

    if (accepted.length === 0) {
      if (skipped > 0) showToast('Only JPG and PNG files are supported.');
      return;
    }

    Promise.all(accepted.map(readImageFile)).then((loaded) => {
      images = images.concat(loaded);
      pdfBlob = null; // any previous PDF is now out of date
      renderTray();
      updateActionBar();
      if (skipped > 0) showToast(`Skipped ${skipped} unsupported file${skipped > 1 ? 's' : ''}.`);
    });
  }

  function isSupportedImage(file) {
    const okType = file.type === 'image/jpeg' || file.type === 'image/png';
    const okExt = /\.(jpe?g|png)$/i.test(file.name);
    return okType || okExt;
  }

  /**
   * Reads one file into memory and resolves with everything the rest of
   * the app needs: a data URL for previewing/embedding, and the image's
   * natural pixel size for aspect-ratio math.
   */
  function readImageFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => {
        const dataUrl = reader.result;
        const img = new Image();
        img.onload = () => {
          resolve({
            id: makeId(),
            file,
            name: file.name,
            dataUrl,
            width: img.naturalWidth,
            height: img.naturalHeight,
            mime: file.type === 'image/png' ? 'image/png' : 'image/jpeg',
          });
        };
        img.onerror = () => reject(new Error(`Could not read image: ${file.name}`));
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    });
  }

  let idCounter = 0;
  function makeId() {
    idCounter += 1;
    return `img-${Date.now()}-${idCounter}`;
  }

  /* ============================ Tray rendering ============================ */

  function renderTray() {
    tray.innerHTML = '';

    images.forEach((img, index) => {
      const li = document.createElement('li');
      li.className = 'tray-card';
      li.draggable = true;
      li.dataset.id = img.id;

      li.innerHTML = `
        <div class="tray-thumb-wrap">
          <span class="page-badge">${index + 1}</span>
          <button type="button" class="remove-btn" aria-label="Remove ${escapeHtml(img.name)}">&times;</button>
          <img class="tray-thumb" src="${img.dataUrl}" alt="Preview of ${escapeHtml(img.name)}" />
        </div>
        <p class="tray-filename" title="${escapeHtml(img.name)}">${escapeHtml(img.name)}</p>
      `;

      li.querySelector('.remove-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        removeImage(img.id);
      });

      attachDragHandlers(li);
      tray.appendChild(li);
    });

    traySection.hidden = images.length === 0;
    pageCountEl.textContent = images.length
      ? `— ${images.length} page${images.length > 1 ? 's' : ''}`
      : '';
  }

  function removeImage(id) {
    images = images.filter((img) => img.id !== id);
    pdfBlob = null;
    renderTray();
    updateActionBar();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ============================ Drag-to-reorder ============================ */

  function attachDragHandlers(card) {
    card.addEventListener('dragstart', (e) => {
      dragSourceId = card.dataset.id;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      // Firefox requires data to be set for the drag to initiate.
      e.dataTransfer.setData('text/plain', dragSourceId);
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      clearDragOverStyles();
      dragSourceId = null;
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!dragSourceId || dragSourceId === card.dataset.id) return;

      const rect = card.getBoundingClientRect();
      const isBefore = e.clientX - rect.left < rect.width / 2;
      clearDragOverStyles();
      card.classList.add(isBefore ? 'drag-over-before' : 'drag-over-after');
    });

    card.addEventListener('dragleave', () => {
      card.classList.remove('drag-over-before', 'drag-over-after');
    });

    card.addEventListener('drop', (e) => {
      e.preventDefault();
      const targetId = card.dataset.id;
      if (!dragSourceId || dragSourceId === targetId) return;

      const rect = card.getBoundingClientRect();
      const isBefore = e.clientX - rect.left < rect.width / 2;
      reorderImages(dragSourceId, targetId, isBefore);
      clearDragOverStyles();
    });
  }

  function clearDragOverStyles() {
    tray.querySelectorAll('.drag-over-before, .drag-over-after').forEach((el) => {
      el.classList.remove('drag-over-before', 'drag-over-after');
    });
  }

  function reorderImages(sourceId, targetId, insertBefore) {
    const sourceIndex = images.findIndex((img) => img.id === sourceId);
    if (sourceIndex === -1) return;
    const [moved] = images.splice(sourceIndex, 1);

    let targetIndex = images.findIndex((img) => img.id === targetId);
    if (targetIndex === -1) targetIndex = images.length;
    if (!insertBefore) targetIndex += 1;

    images.splice(targetIndex, 0, moved);
    pdfBlob = null;
    renderTray();
    updateActionBar();
  }

  /* ============================ Action bar ============================ */

  clearBtn.addEventListener('click', () => {
    images = [];
    pdfBlob = null;
    renderTray();
    updateActionBar();
  });

  function updateActionBar() {
    actionBar.hidden = images.length === 0;
    downloadBtn.disabled = !pdfBlob;
    actionStatus.textContent = pdfBlob
      ? 'PDF ready to download.'
      : images.length
        ? `${images.length} image${images.length > 1 ? 's' : ''} ready to convert.`
        : '';
  }

  /* ============================ PDF conversion ============================ */

  convertBtn.addEventListener('click', () => {
    if (images.length === 0) return;
    convertToPdf();
  });

  async function convertToPdf() {
    setLoading(true, 'Preparing…', 0);
    convertBtn.disabled = true;

    try {
      // jsPDF is loaded globally from the CDN script tag as window.jspdf.
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

      for (let i = 0; i < images.length; i += 1) {
        const img = images[i];
        setLoading(true, `Adding image ${i + 1} of ${images.length}…`, (i / images.length) * 100);

        if (i > 0) doc.addPage('a4', 'portrait');

        const { x, y, width, height } = fitToPage(img.width, img.height);
        const format = img.mime === 'image/png' ? 'PNG' : 'JPEG';

        // 'NONE' compression keeps the original image data intact so quality
        // is preserved as closely as the source format allows.
        doc.addImage(img.dataUrl, format, x, y, width, height, undefined, 'NONE');

        // Yield to the browser between pages so the UI (progress bar, spinner)
        // stays responsive even with many large images.
        await nextFrame();
      }

      setLoading(true, 'Finalizing PDF…', 100);
      await nextFrame();

      pdfBlob = doc.output('blob');
      updateActionBar();
      showToast('PDF generated — click "Download PDF" to save it.');
    } catch (err) {
      console.error(err);
      showToast('Something went wrong while building the PDF. Please try again.');
    } finally {
      setLoading(false);
      convertBtn.disabled = false;
    }
  }

  /**
   * Computes the position and size (in mm) needed to fit an image of the
   * given pixel dimensions inside the page, centred, preserving its
   * aspect ratio, and respecting the page margin.
   */
  function fitToPage(pixelWidth, pixelHeight) {
    const availW = PAGE_WIDTH_MM - PAGE_MARGIN_MM * 2;
    const availH = PAGE_HEIGHT_MM - PAGE_MARGIN_MM * 2;
    const imageRatio = pixelWidth / pixelHeight;
    const availRatio = availW / availH;

    let width;
    let height;
    if (imageRatio > availRatio) {
      // Image is relatively wider than the available area: width-limited.
      width = availW;
      height = availW / imageRatio;
    } else {
      // Image is relatively taller: height-limited.
      height = availH;
      width = availH * imageRatio;
    }

    const x = (PAGE_WIDTH_MM - width) / 2;
    const y = (PAGE_HEIGHT_MM - height) / 2;
    return { x, y, width, height };
  }

  function nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
  }

  /* ============================ Download ============================ */

  downloadBtn.addEventListener('click', () => {
    if (!pdfBlob) return;

    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pressroom-${timestamp()}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  function timestamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  }

  /* ============================ Loading UI ============================ */

  function setLoading(isLoading, text, percent) {
    loadingOverlay.hidden = !isLoading;
    if (text !== undefined) loadingText.textContent = text;
    if (percent !== undefined) progressFill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
  }

  /* ============================ Toasts ============================ */

  let toastTimer = null;
  function showToast(message) {
    toastEl.textContent = message;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 3200);
  }

})();

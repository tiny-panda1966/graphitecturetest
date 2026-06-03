
// Worker operations proxied through DB.workerRequest/workerUpload/workerDownload
// Keys stored in Wix Secrets Manager — never exposed to client

function formatFileSize(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + " " + units[i];
}

function fileIcon(name) {
  const ext = (name.split(".").pop() || "").toLowerCase();
  const icons = {
    pdf: { bg: "#dc2626", label: "PDF" },
    doc: { bg: "#2563eb", label: "DOC" }, docx: { bg: "#2563eb", label: "DOC" },
    xls: { bg: "#16a34a", label: "XLS" }, xlsx: { bg: "#16a34a", label: "XLS" },
    ppt: { bg: "#ea580c", label: "PPT" }, pptx: { bg: "#ea580c", label: "PPT" },
    png: { bg: "#7c3aed", label: "IMG" }, jpg: { bg: "#7c3aed", label: "IMG" }, jpeg: { bg: "#7c3aed", label: "IMG" }, gif: { bg: "#7c3aed", label: "IMG" }, webp: { bg: "#7c3aed", label: "IMG" }, svg: { bg: "#7c3aed", label: "IMG" },
    zip: { bg: "#854d0e", label: "ZIP" }, rar: { bg: "#854d0e", label: "RAR" },
    ai: { bg: "#f97316", label: "AI" }, psd: { bg: "#0ea5e9", label: "PSD" },
    dwg: { bg: "#059669", label: "DWG" }, dxf: { bg: "#059669", label: "DXF" },
    mp4: { bg: "#be185d", label: "VID" }, mov: { bg: "#be185d", label: "VID" },
    mp3: { bg: "#6d28d9", label: "AUD" }, wav: { bg: "#6d28d9", label: "AUD" },
    txt: { bg: "#64748b", label: "TXT" }, csv: { bg: "#64748b", label: "CSV" }
  };
  return icons[ext] || { bg: "#94a3b8", label: ext.toUpperCase().slice(0, 3) || "FILE" };
}


// Read EXIF data from JPEG/TIFF ArrayBuffer
function readExifData(buffer) {
  const view = new DataView(buffer);
  const result = { dpiX: null, dpiY: null, colorSpace: null, hasICC: false };

  // JPEG check
  if (view.getUint16(0) === 0xFFD8) {
    let offset = 2;
    while (offset < view.byteLength - 1) {
      if (view.getUint8(offset) !== 0xFF) break;
      const marker = view.getUint8(offset + 1);
      if (marker === 0xE1) { // APP1 = EXIF
        const exifOffset = offset + 4;
        // Check for "Exif\0\0"
        if (view.getUint32(exifOffset) === 0x45786966 && view.getUint16(exifOffset + 4) === 0x0000) {
          const tiffStart = exifOffset + 6;
          const bigEndian = view.getUint16(tiffStart) === 0x4D4D;
          const get16 = (o) => bigEndian ? view.getUint16(o) : view.getUint16(o, true);
          const get32 = (o) => bigEndian ? view.getUint32(o) : view.getUint32(o, true);
          const getRat = (o) => { const n = get32(o); const d = get32(o + 4); return d ? n / d : 0; };
          const ifdOffset = tiffStart + get32(tiffStart + 4);
          const entries = get16(ifdOffset);
          let resUnit = 2; // default inches
          for (let i = 0; i < entries; i++) {
            const entryOff = ifdOffset + 2 + i * 12;
            if (entryOff + 12 > view.byteLength) break;
            const tag = get16(entryOff);
            if (tag === 0x011A) result.dpiX = getRat(tiffStart + get32(entryOff + 8)); // XResolution
            if (tag === 0x011B) result.dpiY = getRat(tiffStart + get32(entryOff + 8)); // YResolution
            if (tag === 0x0128) resUnit = get16(entryOff + 8); // ResolutionUnit
            if (tag === 0xA001) { // ColorSpace
              const cs = get16(entryOff + 8);
              result.colorSpace = cs === 1 ? "sRGB" : cs === 0xFFFF ? "Uncalibrated" : `Unknown (${cs})`;
            }
          }
          // Convert cm to inches if needed
          if (resUnit === 3 && result.dpiX) { result.dpiX *= 2.54; result.dpiY *= 2.54; }
        }
      } else if (marker === 0xE2) { // APP2 = ICC Profile
        result.hasICC = true;
      } else if (marker === 0xEE) { // APP14 = Adobe
        const segLen = view.getUint16(offset + 2);
        if (segLen >= 12 && offset + 13 < view.byteLength) {
          const colorTransform = view.getUint8(offset + 13);
          if (colorTransform === 2) result.colorSpace = "CMYK (Adobe)";
          else if (colorTransform === 0) result.colorSpace = "RGB (Adobe)";
        }
      }
      const segLength = view.getUint16(offset + 2);
      offset += 2 + segLength;
    }
  }

  // TIFF check
  if (view.getUint16(0) === 0x4949 || view.getUint16(0) === 0x4D4D) {
    const bigEndian = view.getUint16(0) === 0x4D4D;
    const get16 = (o) => o + 2 <= view.byteLength ? (bigEndian ? view.getUint16(o) : view.getUint16(o, true)) : 0;
    const get32 = (o) => o + 4 <= view.byteLength ? (bigEndian ? view.getUint32(o) : view.getUint32(o, true)) : 0;
    const getRat = (o) => { if (o + 8 > view.byteLength) return 0; const n = get32(o); const d = get32(o + 4); return d ? n / d : 0; };
    const ifdOffset = get32(4);
    if (ifdOffset && ifdOffset + 2 < view.byteLength) {
      const entries = get16(ifdOffset);
      let resUnit = 2;
      let photometric = null;
      for (let i = 0; i < entries; i++) {
        const entryOff = ifdOffset + 2 + i * 12;
        if (entryOff + 12 > view.byteLength) break;
        const tag = get16(entryOff);
        const type = get16(entryOff + 2);
        if (tag === 0x011A && type === 5) result.dpiX = getRat(get32(entryOff + 8));
        if (tag === 0x011B && type === 5) result.dpiY = getRat(get32(entryOff + 8));
        if (tag === 0x0128) resUnit = get16(entryOff + 8);
        if (tag === 0x0106) photometric = get16(entryOff + 8); // PhotometricInterpretation
        if (tag === 0x8773) result.hasICC = true; // ICC Profile tag
      }
      if (resUnit === 3 && result.dpiX) { result.dpiX *= 2.54; result.dpiY *= 2.54; }
      if (photometric === 5) result.colorSpace = "CMYK";
      else if (photometric === 2) result.colorSpace = "RGB";
      else if (photometric !== null) result.colorSpace = `Photometric ${photometric}`;
    }
  }

  return result;
}

// Check if PNG has alpha channel
function pngHasAlpha(buffer) {
  const view = new DataView(buffer);
  // PNG signature check
  if (view.getUint32(0) !== 0x89504E47) return false;
  // IHDR chunk at offset 8, color type at byte 25
  if (buffer.byteLength < 26) return false;
  const colorType = view.getUint8(25);
  // 4 = Greyscale + Alpha, 6 = RGBA
  return colorType === 4 || colorType === 6;
}

// Run all preflight checks
async function runPreflightChecks(fileBlob, fileName, fileSize, printWidthMm, printHeightMm) {
  const checks = [];
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  const isImage = ["jpg", "jpeg", "png", "tif", "tiff", "bmp", "webp", "gif"].includes(ext);
  const isPDF = ext === "pdf";
  const isVector = ["ai", "eps", "svg"].includes(ext);
  const isNativeDesign = ["psd", "indd", "cdr"].includes(ext);
  const printFormats = ["pdf", "tif", "tiff", "jpg", "jpeg", "eps", "ai", "psd"];
  const warningFormats = ["png", "bmp", "gif", "webp"];
  const badFormats = ["doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "mp4", "mov", "mp3", "wav", "zip", "rar"];

  let imgWidth = 0, imgHeight = 0, exifData = null, buffer = null;

  // Load image and EXIF data
  if (isImage && fileBlob) {
    try {
      buffer = await fileBlob.arrayBuffer();
      exifData = readExifData(buffer);
    } catch(e) { /* silently fail */ }

    // Get pixel dimensions
    try {
      const url = URL.createObjectURL(fileBlob);
      const dims = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url); };
        img.onerror = () => { reject(); URL.revokeObjectURL(url); };
        img.src = url;
      });
      imgWidth = dims.w;
      imgHeight = dims.h;
    } catch(e) { /* silently fail */ }
  }

  // ── CHECK 1: File Format ──
  if (printFormats.includes(ext)) {
    checks.push({ name: "File Format", status: "green", detail: `${ext.toUpperCase()} — excellent format for large format print`, recommendation: null });
  } else if (warningFormats.includes(ext)) {
    checks.push({ name: "File Format", status: "amber", detail: `${ext.toUpperCase()} — acceptable but not ideal for large format`,
      recommendation: `Convert to TIFF or high-quality PDF for best results. ${ext === "png" ? "PNG files can be very large and may cause RIP slowdowns." : "This format may lose quality or lack CMYK support."}` });
  } else if (badFormats.includes(ext)) {
    checks.push({ name: "File Format", status: "red", detail: `${ext.toUpperCase()} — not suitable for print production`,
      recommendation: "This file type cannot be used for print. Request the artwork as a PDF, TIFF, or high-resolution JPEG from the designer." });
  } else if (isVector) {
    checks.push({ name: "File Format", status: "green", detail: `${ext.toUpperCase()} — vector format, resolution-independent`, recommendation: null });
  } else {
    checks.push({ name: "File Format", status: "amber", detail: `${ext.toUpperCase()} — uncommon format for print`, recommendation: "Check compatibility with your RIP software. Consider converting to PDF or TIFF." });
  }

  // ── CHECK 2: Resolution / DPI ──
  if (isImage && imgWidth > 0 && printWidthMm > 0) {
    const printWidthInches = printWidthMm / 25.4;
    const printHeightInches = printHeightMm / 25.4;
    const effectiveDpiW = imgWidth / printWidthInches;
    const effectiveDpiH = imgHeight / printHeightInches;
    const effectiveDpi = Math.min(effectiveDpiW, effectiveDpiH);
    const embeddedDpi = exifData?.dpiX || null;

    let status, detail, rec;
    if (effectiveDpi >= 150) {
      status = "green";
      detail = `${Math.round(effectiveDpi)} DPI at print size — excellent, suitable for close-up viewing`;
      rec = null;
    } else if (effectiveDpi >= 72) {
      status = "amber";
      detail = `${Math.round(effectiveDpi)} DPI at print size — acceptable for medium-distance viewing (1–3m)`;
      rec = "For close-up viewing (window graphics, exhibition stands), aim for 150+ DPI. Request a higher-resolution file if possible, or ensure this print will be viewed from at least 1 metre away.";
    } else if (effectiveDpi >= 25) {
      status = "amber";
      detail = `${Math.round(effectiveDpi)} DPI at print size — only suitable for long-distance viewing (3m+)`;
      rec = "This resolution is only acceptable for large-scale graphics viewed from distance (billboards, high-level building wraps). For anything at eye level, request a higher-resolution source file. Do not upscale — it won't improve print quality.";
    } else {
      status = "red";
      detail = `${Math.round(effectiveDpi)} DPI at print size — too low for any print application`;
      rec = "This file will appear visibly pixelated. Request the original high-resolution artwork from the designer. Common causes: web-download images, screenshot captures, or heavily cropped photos.";
    }

    if (embeddedDpi) detail += ` (embedded: ${Math.round(embeddedDpi)} DPI)`;
    checks.push({ name: "Resolution / DPI", status, detail, recommendation: rec });
  } else if (isVector) {
    checks.push({ name: "Resolution / DPI", status: "green", detail: "Vector format — resolution independent, will print sharp at any size", recommendation: null });
  } else if (isPDF) {
    checks.push({ name: "Resolution / DPI", status: "amber", detail: "PDF detected — cannot verify embedded image resolution from browser",
      recommendation: "Open the PDF in Adobe Acrobat and use Edit > Preflight to check embedded image resolutions. Ensure raster elements are at least 100 DPI at the intended print size." });
  } else {
    checks.push({ name: "Resolution / DPI", status: "amber", detail: "Cannot determine resolution for this file type",
      recommendation: "Verify resolution manually in the source application before sending to print." });
  }

  // ── CHECK 3: Image Dimensions vs Output Size ──
  if (isImage && imgWidth > 0 && printWidthMm > 0) {
    const scaleW = printWidthMm / (imgWidth * 25.4 / (exifData?.dpiX || 72));
    const scaleH = printHeightMm / (imgHeight * 25.4 / (exifData?.dpiY || exifData?.dpiX || 72));
    const maxScale = Math.max(scaleW, scaleH);
    const pxDetail = `Source: ${imgWidth}×${imgHeight}px → Print: ${printWidthMm}×${printHeightMm}mm`;

    if (maxScale <= 1.1) {
      checks.push({ name: "Dimensions vs Output", status: "green", detail: `${pxDetail} — file is at or above required size`, recommendation: null });
    } else if (maxScale <= 2) {
      checks.push({ name: "Dimensions vs Output", status: "amber", detail: `${pxDetail} — file needs ~${Math.round(maxScale * 100)}% scaling`,
        recommendation: `The image will be scaled up by ${Math.round((maxScale - 1) * 100)}%. Slight softening may be visible at close range. Consider requesting a larger source file.` });
    } else {
      checks.push({ name: "Dimensions vs Output", status: "red", detail: `${pxDetail} — file needs ${Math.round(maxScale * 100)}% scaling (${maxScale.toFixed(1)}× enlargement)`,
        recommendation: `This image must be enlarged ${maxScale.toFixed(1)}× to fit the output size, which will cause significant quality loss. Request the original full-resolution file or a re-shoot/re-render at the correct dimensions.` });
    }
  } else if (!isImage) {
    checks.push({ name: "Dimensions vs Output", status: "amber", detail: "Cannot verify dimensions for this file type", recommendation: "Check the document's artboard/page size matches the intended print dimensions in the source application." });
  }

  // ── CHECK 4: Colour Space ──
  if (exifData && exifData.colorSpace) {
    const cs = exifData.colorSpace;
    if (cs.includes("CMYK")) {
      checks.push({ name: "Colour Space", status: "green", detail: `${cs} — correct colour space for print`, recommendation: null });
    } else {
      checks.push({ name: "Colour Space", status: "amber", detail: `${cs} — RGB colour space detected`,
        recommendation: "This file uses RGB colours which must be converted to CMYK for accurate print output. Bright blues, greens and oranges are most affected — they may appear duller in print. Convert to CMYK in Photoshop (Edit > Convert to Profile > FOGRA39 or your printer's ICC profile) or ask the RIP to handle conversion." });
    }
  } else if (exifData && exifData.hasICC) {
    checks.push({ name: "Colour Space", status: "green", detail: "ICC colour profile embedded — printer can use for accurate colour matching", recommendation: null });
  } else if (isImage) {
    checks.push({ name: "Colour Space", status: "amber", detail: "No colour profile detected — likely sRGB",
      recommendation: "No embedded colour profile found. The file will be treated as sRGB and converted by the RIP. For critical colour accuracy, request a CMYK file with an embedded ICC profile (e.g. FOGRA39 for European print, SWOP for US)." });
  } else if (isPDF || isNativeDesign) {
    checks.push({ name: "Colour Space", status: "amber", detail: "Cannot verify colour space from browser",
      recommendation: "Check in Adobe Acrobat (Edit > Preflight) or the source application that the document uses CMYK colour space with an appropriate ICC profile." });
  } else {
    checks.push({ name: "Colour Space", status: "amber", detail: "Cannot determine colour space for this file type", recommendation: "Verify colour space manually before printing." });
  }

  // ── CHECK 5: Bleed & Trim ──
  if (isImage && imgWidth > 0 && printWidthMm > 0) {
    const printWidthInches = printWidthMm / 25.4;
    const effectiveDpi = imgWidth / printWidthInches;
    // Check if image is at least 6mm larger on each side (3mm bleed × 2)
    const bleedPx = effectiveDpi * (6 / 25.4); // 6mm total bleed in pixels
    const hasExtraW = imgWidth > (printWidthMm / 25.4 * effectiveDpi) + bleedPx * 0.5;

    if (hasExtraW) {
      checks.push({ name: "Bleed & Trim", status: "green", detail: "Image extends beyond print area — bleed appears present", recommendation: null });
    } else {
      checks.push({ name: "Bleed & Trim", status: "amber", detail: "Image fits print area with little or no bleed margin",
        recommendation: "For cut-to-size prints, add 3–10mm bleed on all edges to avoid white lines after trimming. Extend the background/artwork beyond the trim line. If this is for a framed or full-bleed application, ensure the artwork extends at least 5mm beyond the visible area." });
    }
  } else if (isPDF) {
    checks.push({ name: "Bleed & Trim", status: "amber", detail: "Cannot verify bleed from browser — PDF may contain trim/bleed box metadata",
      recommendation: "Open in Adobe Acrobat and check: File > Properties > Page Boxes. The BleedBox should extend 3–10mm beyond the TrimBox. If no bleed boxes are set, check the artwork visually extends beyond the intended trim area." });
  } else {
    checks.push({ name: "Bleed & Trim", status: "amber", detail: "Cannot verify bleed for this file type",
      recommendation: "Ensure artwork extends 3–10mm beyond the trim area on all sides. For vinyl wraps, allow extra material for tucking and finishing." });
  }

  // ── CHECK 6: Transparency & Flattening ──
  if (ext === "png" && buffer) {
    const hasAlpha = pngHasAlpha(buffer);
    if (hasAlpha) {
      checks.push({ name: "Transparency", status: "amber", detail: "PNG with alpha transparency detected",
        recommendation: "This file contains transparent areas which may cause issues with some RIP software. Flatten the transparency by placing the image on a white (or intended) background in Photoshop and saving as TIFF or JPEG. If transparency is intentional (e.g. contour-cut vinyl), ensure your RIP supports PNG alpha channels." });
    } else {
      checks.push({ name: "Transparency", status: "green", detail: "PNG without alpha channel — no transparency issues", recommendation: null });
    }
  } else if (isPDF) {
    checks.push({ name: "Transparency", status: "amber", detail: "Cannot verify transparency from browser — PDFs may contain unflattened layers",
      recommendation: "Use Adobe Acrobat's Flattener Preview (Tools > Print Production > Flattener Preview) to check for transparency. If present, flatten before sending to RIP. Save as PDF/X-1a to automatically flatten all transparency." });
  } else if (["tif", "tiff", "jpg", "jpeg", "bmp"].includes(ext)) {
    checks.push({ name: "Transparency", status: "green", detail: `${ext.toUpperCase()} — format does not support transparency`, recommendation: null });
  } else if (isVector || isNativeDesign) {
    checks.push({ name: "Transparency", status: "amber", detail: "Native/vector format — may contain transparency effects",
      recommendation: "Check for drop shadows, opacity effects, and transparent overlays in the source file. Flatten all transparency before output or export as PDF/X-1a." });
  } else {
    checks.push({ name: "Transparency", status: "amber", detail: "Cannot determine transparency for this file type", recommendation: "Verify in the source application that all transparency is flattened." });
  }

  // ── CHECK 7: Spot Colours / Overprint ──
  if (isPDF || isNativeDesign || isVector) {
    checks.push({ name: "Spot Colours", status: "amber", detail: "Cannot verify spot colours from browser",
      recommendation: "Check for Pantone or custom spot colours in the source application. Wide-format CMYK printers cannot reproduce spot colours — they must be converted to CMYK process equivalents. In Acrobat: use Print Production > Ink Manager to check and convert spots. Watch for overprint settings that may cause elements to disappear or colour-shift when printed." });
  } else if (isImage) {
    checks.push({ name: "Spot Colours", status: "green", detail: "Raster image — no spot colour concerns for CMYK output", recommendation: null });
  } else {
    checks.push({ name: "Spot Colours", status: "green", detail: "Not applicable for this file type", recommendation: null });
  }

  return checks;
}

// Preflight traffic light icon
function PreflightDot({ status }) {
  const colours = { green: "#22c55e", amber: "#f59e0b", red: "#ef4444", pending: "#ddd", checking: "#888" };
  const bg = colours[status] || colours.pending;

  if (status === "checking") {
    return (
      <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid #ddd", borderTopColor: "#111", animation: "preflight-spin 0.6s linear infinite", flexShrink: 0 }} />
    );
  }
  return (
    <div style={{ width: 20, height: 20, borderRadius: "50%", background: bg, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 600, transition: "all 0.3s" }}>
      {status === "green" ? "✓" : status === "red" ? "✕" : status === "amber" ? "!" : ""}
    </div>
  );
}

// Preflight Modal
function PreflightModal({ file, onClose, workerCreds, localBlob }) {
  const [printWidth, setPrintWidth] = useState("");
  const [printHeight, setPrintHeight] = useState("");
  const [running, setRunning] = useState(false);
  const [checks, setChecks] = useState([]);
  const [visibleCount, setVisibleCount] = useState(0);
  const [done, setDone] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const runChecks = async () => {
    const pw = parseFloat(printWidth) || 0;
    const ph = parseFloat(printHeight) || 0;

    setRunning(true);
    setChecks([]);
    setVisibleCount(0);
    setDone(false);
    setDownloading(true);

    // Download the file for analysis (or use local blob)
    let blob = localBlob || null;
    if (!blob) {
      try {
        if (workerCreds) {
          var res = await fetch(workerCreds.url + "/download/" + file.key, {
            headers: { "Authorization": "Bearer " + workerCreds.token }
          });
          if (res.ok) blob = await res.blob();
        }
      } catch(e) { /* proceed without blob */ }
    }

    setDownloading(false);

    // Run all checks
    const results = await runPreflightChecks(blob, file.name, file.size, pw, ph);
    setChecks(results);

    // Reveal one by one
    for (let i = 0; i < results.length; i++) {
      await new Promise(r => setTimeout(r, 700));
      setVisibleCount(i + 1);
    }
    await new Promise(r => setTimeout(r, 400));
    setDone(true);
    setRunning(false);
  };

  const summary = () => {
    if (!done || checks.length === 0) return null;
    const reds = checks.filter(c => c.status === "red").length;
    const ambers = checks.filter(c => c.status === "amber").length;
    if (reds > 0) return { label: "Not Print Ready", bg: "#fef2f2", border: "#fecaca", color: "#991b1b", icon: "✕" };
    if (ambers > 0) return { label: "Print With Caution", bg: "#fffbeb", border: "#fde68a", color: "#92400e", icon: "!" };
    return { label: "Print Ready", bg: "#f0fdf4", border: "#bbf7d0", color: "#166534", icon: "✓" };
  };
  const sum = summary();

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}
      onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 10, maxWidth: 580, width: "100%", maxHeight: "90vh", overflow: "auto" }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Preflight Check</div>
            <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{file.name} · {formatFileSize(file.size)}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#999", padding: "0 4px" }}>✕</button>
        </div>

        {/* Print dimensions input */}
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #f0f0f0" }}>
          <div style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", color: "#888", marginBottom: 10 }}>Intended Print Size</div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <label style={{ fontSize: 12, color: "#666" }}>Width</label>
              <input type="number" value={printWidth} onChange={e => setPrintWidth(e.target.value)}
                placeholder="e.g. 2000" style={{ ...s.input, width: 100, padding: "6px 10px", fontSize: 12 }} />
              <span style={{ fontSize: 11, color: "#aaa" }}>mm</span>
            </div>
            <span style={{ color: "#ccc" }}>×</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <label style={{ fontSize: 12, color: "#666" }}>Height</label>
              <input type="number" value={printHeight} onChange={e => setPrintHeight(e.target.value)}
                placeholder="e.g. 1000" style={{ ...s.input, width: 100, padding: "6px 10px", fontSize: 12 }} />
              <span style={{ fontSize: 11, color: "#aaa" }}>mm</span>
            </div>
            <button onClick={runChecks} disabled={running}
              style={{ ...s.btn(), fontSize: 11, padding: "7px 18px", marginLeft: "auto", opacity: running ? 0.6 : 1 }}>
              {running ? "Checking..." : checks.length > 0 ? "Re-run Checks" : "Run Checks"}
            </button>
          </div>
          <div style={{ fontSize: 10, color: "#bbb", marginTop: 6 }}>Leave blank to skip dimension-specific checks. Enter 0 for either dimension to skip.</div>
        </div>

        {/* Checks list */}
        <div style={{ padding: "16px 24px 8px" }}>
          {downloading && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0", color: "#888", fontSize: 12 }}>
              <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid #ddd", borderTopColor: "#111", animation: "preflight-spin 0.6s linear infinite" }} />
              Downloading file for analysis...
            </div>
          )}

          {checks.map((check, i) => {
            const visible = i < visibleCount;
            const isChecking = i === visibleCount && running && !downloading;
            return (
              <div key={i} style={{ opacity: visible || isChecking ? 1 : 0.15, transition: "opacity 0.3s", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
                  <PreflightDot status={visible ? check.status : isChecking ? "checking" : "pending"} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{check.name}</div>
                    {visible && <div style={{ fontSize: 11, color: "#666" }}>{check.detail}</div>}
                  </div>
                  {visible && (
                    <span style={{ fontSize: 10, fontWeight: 500, padding: "2px 8px", borderRadius: 10,
                      background: check.status === "green" ? "#f0fdf4" : check.status === "amber" ? "#fffbeb" : "#fef2f2",
                      color: check.status === "green" ? "#166534" : check.status === "amber" ? "#92400e" : "#991b1b" }}>
                      {check.status === "green" ? "PASS" : check.status === "amber" ? "WARNING" : "FAIL"}
                    </span>
                  )}
                </div>
                {visible && check.recommendation && (
                  <div style={{ marginLeft: 32, padding: "8px 12px", background: check.status === "red" ? "#fef2f2" : "#fffbeb", borderRadius: 4, marginBottom: 4, borderLeft: `3px solid ${check.status === "red" ? "#ef4444" : "#f59e0b"}` }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: check.status === "red" ? "#991b1b" : "#92400e", marginBottom: 3 }}>RECOMMENDATION</div>
                    <div style={{ fontSize: 11, color: "#555", lineHeight: 1.5 }}>{check.recommendation}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Summary */}
        {sum && (
          <div style={{ margin: "4px 24px 20px", padding: "14px 18px", background: sum.bg, border: `1px solid ${sum.border}`, borderRadius: 6, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: sum.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 600, flexShrink: 0 }}>
              {sum.icon}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: sum.color }}>{sum.label}</div>
              <div style={{ fontSize: 11, color: sum.color, opacity: 0.8 }}>
                {checks.filter(c => c.status === "green").length} passed · {checks.filter(c => c.status === "amber").length} warnings · {checks.filter(c => c.status === "red").length} failed
              </div>
            </div>
          </div>
        )}

        {/* Close button */}
        <div style={{ padding: "0 24px 20px", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ ...s.btn("secondary"), fontSize: 11, padding: "7px 20px" }}>Close</button>
        </div>
      </div>
    </div>
  );
}

function Documents({ projectId, projectName }) {
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null); // string message while operation in progress
  const [expandedFolders, setExpandedFolders] = useState({}); // { folderKey: { files: [], folders: [] } }
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteFolderConfirm, setDeleteFolderConfirm] = useState(null);
  const [viewMode, setViewMode] = useState("list");
  const [preflightFile, setPreflightFile] = useState(null);
  const [currentPath, setCurrentPath] = useState([]); // e.g. ["artwork", "finals"]
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renameItem, setRenameItem] = useState(null); // { key, name, type }
  const [renameValue, setRenameValue] = useState("");
  const [moveItem, setMoveItem] = useState(null); // file or folder to move
  const [moveTarget, setMoveTarget] = useState(""); // target path
  const [allFolders, setAllFolders] = useState([]); // flat list for move picker
  const [dragItem, setDragItem] = useState(null); // item being dragged
  const [dropTargetKey, setDropTargetKey] = useState(null); // folder being dragged over
  const fileInputRef = useRef(null);

  // Worker credentials (fetched from backend on mount — never in source code)
  const [workerCreds, setWorkerCreds] = useState(null);
  useEffect(function() {
    if (DB.isLive()) {
      DB.getWorkerAuth().then(function(res) {
        if (res && res.success) setWorkerCreds({ url: res.url, token: res.token });
      }).catch(function() {});
    }
  }, []);

  // Worker operations proxied through DB methods

  // Build current prefix from projectId + path
  const currentPrefix = [projectId, ...currentPath].join("/");

  // Fetch file list with delimiter for folder view
  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      var wRes = await DB.workerRequest("GET", "/files/" + currentPrefix + "?delimiter=/");
      if (!wRes.ok) throw new Error(wRes.error || "Failed to fetch files");
      var data = wRes.data;
      setFiles(data.files || []);
      setFolders(data.folders || []);
    } catch (err) {
      setError(err.message);
      setFiles([]);
      setFolders([]);
    } finally {
      setLoading(false);
    }
  }, [currentPrefix]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  // Recursively discover all folders for the move picker
  const fetchAllFolders = async () => {
    const discovered = new Set();
    discovered.add(""); // root

    const scanLevel = async (prefix) => {
      try {
        var res = await DB.workerRequest("GET", "/files/" + prefix + "?delimiter=/");
        if (!res.ok) return;
        const data = res.data;
        for (const f of (data.folders || [])) {
          // f.key is like "P1/artwork/" — extract relative path
          const rel = f.key.replace(projectId + "/", "").replace(/\/$/, "");
          if (rel) {
            discovered.add(rel);
            await scanLevel(projectId + "/" + rel);
          }
        }
      } catch(e) { /* skip */ }
    };

    await scanLevel(projectId);
    setAllFolders([...discovered].sort());
  };

  // Upload files to current path
  const uploadFiles = async (fileList) => {
    const filesToUpload = Array.from(fileList);
    if (filesToUpload.length === 0) return;

    setUploading(true);
    setError(null);
    const progress = filesToUpload.map(f => ({ name: f.name, status: "pending", pct: 0 }));
    setUploadProgress([...progress]);

    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];
      progress[i].status = "uploading";
      progress[i].pct = 10;
      setUploadProgress([...progress]);

      try {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const uploadPath = `${currentPrefix}/${safeName}`;
        if (!workerCreds) throw new Error("Worker not connected");
        var res = await fetch(workerCreds.url + "/upload/" + uploadPath, {
          method: "POST",
          headers: { "Authorization": "Bearer " + workerCreds.token, "Content-Type": file.type || "application/octet-stream" },
          body: file
        });
        if (!res.ok) throw new Error(`Upload failed (${res.status})`);
        progress[i].status = "done";
        progress[i].pct = 100;
      } catch (err) {
        progress[i].status = "error";
        progress[i].error = err.message;
      }
      setUploadProgress([...progress]);
    }

    setUploading(false);
    setTimeout(() => setUploadProgress([]), 2000);
    fetchFiles();
  };

  // Create folder
  const createFolder = async () => {
    const name = newFolderName.trim().replace(/[^a-zA-Z0-9._-]/g, "_");
    if (!name) return;
    try {
      var res = await DB.workerRequest("POST", "/folder/" + currentPrefix + "/" + name);
      if (!res.ok) {
        const data = res.data;
        throw new Error(data.error || "Failed to create folder");
      }
      setShowNewFolder(false);
      setNewFolderName("");
      fetchFiles();
    } catch (err) {
      setError(err.message);
    }
  };

  // Download file
  const downloadFile = async (file) => {
    try {
      if (!workerCreds) throw new Error("Worker not connected");
      const res = await fetch(workerCreds.url + "/download/" + file.key, {
        headers: { "Authorization": "Bearer " + workerCreds.token }
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = file.name;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) { setError(err.message); }
  };

  // Delete file
  const deleteFile = async (file) => {
    try {
      var res = await DB.workerRequest("DELETE", "/file/" + file.key);
      if (!res.ok) throw new Error("Delete failed");
      setDeleteConfirm(null);
      setExpandedFolders({});
      fetchFiles();
    } catch (err) { setError(err.message); }
  };

  // Delete folder
  const deleteFolder = async (folder) => {
    setBusy(`Deleting ${folder.name} and contents...`);
    try {
      var res = await DB.workerRequest("DELETE", "/folder/" + folder.key);
      if (!res.ok) throw new Error("Delete failed");
      setDeleteFolderConfirm(null);
      setExpandedFolders({});
      fetchFiles();
    } catch (err) { setError(err.message); }
    finally { setBusy(null); }
  };

  // Rename file or folder
  const handleRename = async () => {
    const newName = renameValue.trim().replace(/[^a-zA-Z0-9._-]/g, "_");
    if (!newName || !renameItem) return;
    setBusy(`Renaming to ${newName}...`);
    try {
      if (renameItem.type === "folder") {
        const oldPrefix = renameItem.key;
        const parts = oldPrefix.replace(/\/$/, "").split("/");
        parts[parts.length - 1] = newName;
        const newPrefix = parts.join("/") + "/";
        var res = await DB.workerRequest("PUT", "/move-folder", { source: oldPrefix, destination: newPrefix });
        if (!res.ok) throw new Error("Rename folder failed");
      } else {
        var res = await DB.workerRequest("PUT", "/rename", { key: renameItem.key, newName });
        if (!res.ok) throw new Error("Rename failed");
      }
      setRenameItem(null);
      setRenameValue("");
      setExpandedFolders({});
      fetchFiles();
    } catch (err) { setError(err.message); }
    finally { setBusy(null); }
  };

  // Navigate into folder
  const enterFolder = (folderName) => {
    setExpandedFolders({});
    setCurrentPath(prev => [...prev, folderName]);
  };

  // Navigate via breadcrumb
  const goToPath = (index) => {
    setExpandedFolders({});
    if (index < 0) setCurrentPath([]);
    else setCurrentPath(prev => prev.slice(0, index + 1));
  };

  // Toggle expand/collapse a folder inline
  const toggleExpand = async (folderKey) => {
    if (expandedFolders[folderKey]) {
      setExpandedFolders(prev => { const next = { ...prev }; delete next[folderKey]; return next; });
      return;
    }
    try {
      const prefix = folderKey.replace(/\/$/, "");
      var res = await DB.workerRequest("GET", "/files/" + prefix + "?delimiter=/");
      if (!res.ok) throw new Error("Failed to load folder");
      const data = res.data;
      setExpandedFolders(prev => ({
        ...prev,
        [folderKey]: { files: data.files || [], folders: data.folders || [] }
      }));
    } catch (err) { setError(err.message); }
  };

  // Refresh an expanded folder's contents
  const refreshExpanded = async (folderKey) => {
    if (!expandedFolders[folderKey]) return;
    try {
      const prefix = folderKey.replace(/\/$/, "");
      var res = await DB.workerRequest("GET", "/files/" + prefix + "?delimiter=/");
      if (!res.ok) return;
      const data = res.data;
      setExpandedFolders(prev => ({
        ...prev,
        [folderKey]: { files: data.files || [], folders: data.folders || [] }
      }));
    } catch(e) { /* skip */ }
  };

  // Drag handlers for file upload dropzone
  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); };
  const handleDrop = (e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); uploadFiles(e.dataTransfer.files); };

  // Row drag-and-drop: drag files/folders onto folder rows to move them
  const onRowDragStart = (item, e) => {
    setDragItem(item);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", item.key);
  };
  const onRowDragEnd = () => { setDragItem(null); setDropTargetKey(null); };
  const onFolderDragOver = (folderKey, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragItem && dragItem.key !== folderKey) {
      e.dataTransfer.dropEffect = "move";
      setDropTargetKey(folderKey);
    }
  };
  const onFolderDragLeave = (e) => {
    e.preventDefault();
    setDropTargetKey(null);
  };
  const onFolderDrop = async (targetFolderKey, e) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTargetKey(null);
    if (!dragItem || dragItem.key === targetFolderKey) return;

    const item = dragItem;

    // Check if item is already in this folder
    const itemParent = item.key.substring(0, item.key.lastIndexOf("/", item.key.length - (item.type === "folder" ? 2 : 1)) + 1);
    if (itemParent === targetFolderKey) {
      setDragItem(null);
      return; // Already in this folder, do nothing
    }

    // Check computed destination matches source
    const dest = item.type === "folder" ? targetFolderKey + item.name + "/" : targetFolderKey + item.name;
    if (dest === item.key) {
      setDragItem(null);
      return;
    }

    setDragItem(null);
    setBusy(`Moving ${item.name}...`);

    try {
      if (item.type === "folder") {
        var res = await DB.workerRequest("PUT", "/move-folder", { source: item.key, destination: dest });
        if (!res.ok) throw new Error("Move failed");
      } else {
        var res = await DB.workerRequest("PUT", "/move", { source: item.key, destination: dest });
        if (!res.ok) throw new Error("Move failed");
      }
      fetchFiles();
      Object.keys(expandedFolders).forEach(k => refreshExpanded(k));
    } catch (err) { setError(err.message); }
    finally { setBusy(null); }
  };

  // Drop onto breadcrumb to move to that folder level
  const onBreadcrumbDrop = async (pathIndex, e) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTargetKey(null);
    if (!dragItem) return;

    const item = dragItem;
    setDragItem(null);

    const destParts = pathIndex < 0 ? [projectId] : [projectId, ...currentPath.slice(0, pathIndex + 1)];
    const destPrefix = destParts.join("/") + "/";

    // Check if item is already in this destination
    const itemParent = item.key.substring(0, item.key.lastIndexOf("/", item.key.length - (item.type === "folder" ? 2 : 1)) + 1);
    if (itemParent === destPrefix) return; // Already there

    const dest = item.type === "folder" ? destPrefix + item.name + "/" : destPrefix + item.name;
    if (dest === item.key) return;

    setBusy(`Moving ${item.name}...`);

    try {
      if (item.type === "folder") {
        var res = await DB.workerRequest("PUT", "/move-folder", { source: item.key, destination: dest });
        if (!res.ok) throw new Error("Move failed");
      } else {
        var res = await DB.workerRequest("PUT", "/move", { source: item.key, destination: dest });
        if (!res.ok) throw new Error("Move failed");
      }
      fetchFiles();
      Object.keys(expandedFolders).forEach(k => refreshExpanded(k));
    } catch (err) { setError(err.message); }
    finally { setBusy(null); }
  };

  // Also wrap the modal-based move in busy
  const handleMove = async () => {
    if (!moveItem) return;
    setBusy(`Moving ${moveItem.name}...`);
    try {
      const fileName = moveItem.name;
      const destPrefix = moveTarget ? `${projectId}/${moveTarget}` : projectId;
      const destination = `${destPrefix}/${fileName}`;

      if (moveItem.type === "folder") {
        const folderName = moveItem.name;
        const destFolder = moveTarget ? `${projectId}/${moveTarget}/${folderName}/` : `${projectId}/${folderName}/`;
        var res = await DB.workerRequest("PUT", "/move-folder", { source: moveItem.key, destination: destFolder });
        if (!res.ok) throw new Error("Move folder failed");
      } else {
        var res = await DB.workerRequest("PUT", "/move", { source: moveItem.key, destination });
        if (!res.ok) throw new Error("Move failed");
      }
      setMoveItem(null);
      setMoveTarget("");
      fetchFiles();
      Object.keys(expandedFolders).forEach(k => refreshExpanded(k));
    } catch (err) { setError(err.message); }
    finally { setBusy(null); }
  };

  const totalSize = files.reduce((a, f) => a + f.size, 0);
  const totalItems = files.length + folders.length;

  return (
    <div className="page-container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={s.pageTitle}>Documents</div>
          <div style={s.pageSub}>Project files and assets for {projectName}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => setViewMode(viewMode === "list" ? "grid" : "list")}
            style={{ ...s.btn("secondary"), fontSize: 11, padding: "5px 12px" }}>
            {viewMode === "list" ? "Grid" : "List"}
          </button>
          <button onClick={() => setShowNewFolder(true)}
            style={{ ...s.btn("secondary"), fontSize: 11, padding: "5px 12px" }}>
            + Folder
          </button>
          <button onClick={() => fileInputRef.current?.click()}
            style={{ ...s.btn(), fontSize: 11, padding: "5px 14px" }}>
            + Upload Files
          </button>
          <input ref={fileInputRef} type="file" multiple style={{ display: "none" }}
            onChange={e => { uploadFiles(e.target.files); e.target.value = ""; }} />
        </div>
      </div>

      {/* Breadcrumb — drop targets for moving items up */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 16, fontSize: 12, flexWrap: "wrap" }}>
        <button onClick={() => goToPath(-1)}
          onDragOver={e => { e.preventDefault(); e.stopPropagation(); e.currentTarget.style.background = "#c7d2fe"; e.currentTarget.style.outline = "2px solid #6366f1"; }}
          onDragLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.outline = "none"; }}
          onDrop={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.outline = "none"; onBreadcrumbDrop(-1, e); }}
          style={{ background: "none", border: "none", cursor: "pointer", fontWeight: currentPath.length === 0 ? 600 : 400, color: currentPath.length === 0 ? "#111" : "#666", padding: dragItem ? "6px 12px" : "3px 6px", borderRadius: 4, fontSize: 12, transition: "all 0.15s", border: dragItem ? "1px dashed #a5b4fc" : "1px solid transparent" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="#999" stroke="none" style={{verticalAlign:"middle",marginRight:4}}><path d="M10 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-8l-2-2z"/></svg>{projectName}
        </button>
        {currentPath.map((seg, i) => (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ color: "#ccc" }}>/</span>
            <button onClick={() => goToPath(i)}
              onDragOver={e => { e.preventDefault(); e.stopPropagation(); e.currentTarget.style.background = "#c7d2fe"; e.currentTarget.style.outline = "2px solid #6366f1"; }}
              onDragLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.outline = "none"; }}
              onDrop={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.outline = "none"; onBreadcrumbDrop(i, e); }}
              style={{ background: "none", border: "none", cursor: "pointer", fontWeight: i === currentPath.length - 1 ? 600 : 400, color: i === currentPath.length - 1 ? "#111" : "#666", padding: dragItem ? "6px 12px" : "3px 6px", borderRadius: 4, fontSize: 12, transition: "all 0.15s", border: dragItem ? "1px dashed #a5b4fc" : "1px solid transparent" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#999" stroke="none" style={{verticalAlign:"middle",marginRight:4}}><path d="M10 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-8l-2-2z"/></svg>{seg}
            </button>
          </span>
        ))}
        {dragItem && <span style={{ fontSize: 10, color: "#6366f1", marginLeft: 8, fontStyle: "italic" }}>← drag onto a breadcrumb to move up</span>}
      </div>

      {/* Stats bar */}
      <div className="grid-stat-bar" style={{ marginBottom: 16 }}>
        <div style={s.card}><div style={s.cardBody}>
          <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: "0.04em" }}>Items</div>
          <div style={{ fontSize: 22, fontWeight: 500, marginTop: 4 }}>{totalItems}</div>
        </div></div>
        <div style={s.card}><div style={s.cardBody}>
          <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: "0.04em" }}>File Size</div>
          <div style={{ fontSize: 22, fontWeight: 500, marginTop: 4 }}>{formatFileSize(totalSize)}</div>
        </div></div>
        <div style={s.card}><div style={s.cardBody}>
          <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: "0.04em" }}>Folders</div>
          <div style={{ fontSize: 22, fontWeight: 500, marginTop: 4 }}>{folders.length}</div>
        </div></div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ padding: "10px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 4, marginBottom: 16, fontSize: 12, color: "#991b1b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#991b1b" }}>✕</button>
        </div>
      )}

      {/* New folder inline form */}
      {showNewFolder && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, padding: "10px 14px", background: "#f9fafb", borderRadius: 6, border: "1px solid #e5e7eb" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#999" stroke="none"><path d="M10 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-8l-2-2z"/></svg>
          <input value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && createFolder()}
            placeholder="Folder name..." autoFocus
            style={{ ...s.input, flex: 1, padding: "5px 10px", fontSize: 12 }} />
          <button onClick={createFolder} style={{ ...s.btn(), fontSize: 11, padding: "5px 14px" }}>Create</button>
          <button onClick={() => { setShowNewFolder(false); setNewFolderName(""); }} style={{ ...s.btn("secondary"), fontSize: 11, padding: "5px 10px" }}>Cancel</button>
        </div>
      )}

      {/* Upload progress */}
      {uploadProgress.length > 0 && (
        <div style={s.card}>
          <div style={s.cardHead}><span style={s.cardTitle}>Uploading</span></div>
          <div style={s.cardBody}>
            {uploadProgress.map((up, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 0", borderBottom: i < uploadProgress.length - 1 ? "1px solid #f5f5f5" : "none" }}>
                <div style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>{up.name}</div>
                <div style={{ width: 120, height: 6, background: "#f0f0f0", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${up.pct}%`, height: "100%", background: up.status === "error" ? "#ef4444" : up.status === "done" ? "#22c55e" : "#111", borderRadius: 3, transition: "width 0.3s" }} />
                </div>
                <span style={{ fontSize: 10, color: up.status === "error" ? "#ef4444" : up.status === "done" ? "#22c55e" : "#888", width: 50, textAlign: "right" }}>
                  {up.status === "done" ? "✓ Done" : up.status === "error" ? "✕ Error" : "Uploading"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drop zone */}
      <div className={`docs-dropzone ${dragOver ? "active" : ""}`}
        onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={dragOver ? "#111" : "#bbb"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <div style={{ fontSize: 13, fontWeight: 500, color: dragOver ? "#111" : "#888" }}>
          {dragOver ? "Drop files here" : "Drag & drop files here, or click to browse"}
        </div>
        <div style={{ fontSize: 11, color: "#bbb" }}>Files upload to: /{currentPath.length > 0 ? currentPath.join("/") + "/" : "root"}</div>
      </div>

      {/* Contents */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#999", fontSize: 13 }}>Loading...</div>
      ) : totalItems === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "#999", fontSize: 13 }}>This folder is empty.</div>
      ) : viewMode === "list" ? (
        <div style={s.card}
          onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={e => {
            // Table-level drop = move to current directory
            e.preventDefault();
            e.stopPropagation();
            if (!dragItem) return;
            const currentDir = currentPrefix + "/";
            const item = dragItem;
            const itemParent = item.key.substring(0, item.key.lastIndexOf("/", item.key.length - (item.type === "folder" ? 2 : 1)) + 1);
            if (itemParent === currentDir) { setDragItem(null); setDropTargetKey(null); return; }
            const dest = item.type === "folder" ? currentDir + item.name + "/" : currentDir + item.name;
            if (dest === item.key) { setDragItem(null); setDropTargetKey(null); return; }
            setDragItem(null); setDropTargetKey(null);
            setBusy(`Moving ${item.name} to ${currentPath.length > 0 ? currentPath[currentPath.length-1] : "root"}...`);
            (async () => {
              try {
                const endpoint = item.type === "folder" ? "/move-folder" : "/move";
                var res = await DB.workerRequest("PUT", endpoint, body);
                if (!res.ok) throw new Error("Move failed");
                fetchFiles();
                Object.keys(expandedFolders).forEach(k => refreshExpanded(k));
              } catch (err) { setError(err.message); }
              finally { setBusy(null); }
            })();
          }}>
          <div className="table-wrap">
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Name</th>
                  <th style={{ ...s.th, textAlign: "right" }}>Size</th>
                  <th style={s.th}>Uploaded</th>
                  <th style={{ ...s.th, textAlign: "center", width: 180 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {/* Drop target row for current directory — visible when dragging from subfolders */}
                {dragItem && (() => {
                  const currentDir = currentPrefix + "/";
                  const itemParent = dragItem.key.substring(0, dragItem.key.lastIndexOf("/", dragItem.key.length - (dragItem.type === "folder" ? 2 : 1)) + 1);
                  if (itemParent !== currentDir) {
                    return (
                      <tr key="__drop-to-current"
                        onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDropTargetKey("__current"); }}
                        onDragLeave={() => { if (dropTargetKey === "__current") setDropTargetKey(null); }}
                        onDrop={e => {
                          e.preventDefault(); e.stopPropagation();
                          setDropTargetKey(null);
                          const item = dragItem;
                          const dest = item.type === "folder" ? currentDir + item.name + "/" : currentDir + item.name;
                          if (dest === item.key) { setDragItem(null); return; }
                          setDragItem(null);
                          setBusy(`Moving ${item.name}...`);
                          (async () => {
                            try {
                              const endpoint = item.type === "folder" ? "/move-folder" : "/move";
                              var res = await DB.workerRequest("PUT", endpoint, body);
                              if (!res.ok) throw new Error("Move failed");
                              fetchFiles();
                              Object.keys(expandedFolders).forEach(k => refreshExpanded(k));
                            } catch (err) { setError(err.message); }
                            finally { setBusy(null); }
                          })();
                        }}
                        style={{ background: dropTargetKey === "__current" ? "#e0e7ff" : "#f0fdf4", transition: "background 0.15s", borderLeft: dropTargetKey === "__current" ? "3px solid #6366f1" : "3px solid #22c55e" }}>
                        <td colSpan={4} style={{ ...s.td, padding: "10px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 500, fontSize: 12, color: dropTargetKey === "__current" ? "#4338ca" : "#16a34a" }}>
                            <span style={{ fontSize: 14 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="#999" stroke="none"><path d="M10 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-8l-2-2z"/></svg></span>
                            <span>Drop here → move to {currentPath.length > 0 ? "/" + currentPath.join("/") : "root"}</span>
                            {dropTargetKey === "__current" && <span style={{ fontSize: 10, marginLeft: "auto", color: "#6366f1" }}>← release to move</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  return null;
                })()}
                {/* Recursive row renderer for folders + files */}
                {(() => {
                  const renderRows = (folderList, fileList, depth) => {
                    const indent = depth * 24;
                    const rows = [];
                    // Folders
                    folderList.forEach(folder => {
                      const isExpanded = !!expandedFolders[folder.key];
                      rows.push(
                        <tr key={folder.key}
                          draggable onDragStart={e => onRowDragStart({ ...folder, type: "folder" }, e)} onDragEnd={onRowDragEnd}
                          onDragOver={e => onFolderDragOver(folder.key, e)} onDragLeave={onFolderDragLeave}
                          onDrop={e => onFolderDrop(folder.key, e)}
                          style={{ cursor: "grab", background: dropTargetKey === folder.key ? "#e0e7ff" : "transparent", transition: "background 0.15s", opacity: dragItem?.key === folder.key ? 0.4 : 1 }}
                          onMouseEnter={e => { if (dropTargetKey !== folder.key) e.currentTarget.style.background = "#fafafa"; }}
                          onMouseLeave={e => { if (dropTargetKey !== folder.key) e.currentTarget.style.background = "transparent"; }}>
                          <td style={s.td}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: indent }}>
                              <span onClick={(e) => { e.stopPropagation(); toggleExpand(folder.key); }}
                                style={{ cursor: "pointer", fontSize: 10, color: "#888", width: 16, textAlign: "center", flexShrink: 0, transition: "transform 0.2s", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}>
                                ▶
                              </span>
                              <div onClick={() => enterFolder(folder.name)}
                                style={{ width: 28, height: 28, borderRadius: 4, background: dropTargetKey === folder.key ? "#818cf8" : "#999", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0, transition: "background 0.15s", cursor: "pointer" }}>
                                {isExpanded
                                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff" stroke="none"><path d="M2 6a2 2 0 012-2h5l2 2h9a2 2 0 012 2v1H4a2 2 0 00-2 2v6zm0 5l2-6h18l-2 6a2 2 0 01-2 2H4a2 2 0 01-2-2z"/></svg>
                                  : <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff" stroke="none"><path d="M10 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-8l-2-2z"/></svg>
                                }
                              </div>
                              <span style={{ fontWeight: 500, fontSize: 12, cursor: "pointer" }} onClick={() => enterFolder(folder.name)}>{folder.name}</span>
                              {dropTargetKey === folder.key && <span style={{ fontSize: 10, color: "#6366f1", marginLeft: 4 }}>← drop here</span>}
                            </div>
                          </td>
                          <td style={{ ...s.td, textAlign: "right", fontSize: 11, color: "#888" }}>—</td>
                          <td style={{ ...s.td, fontSize: 11, color: "#888" }}>—</td>
                          <td style={{ ...s.td, textAlign: "center" }}>
                            <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                              <button onClick={(e) => { e.stopPropagation(); toggleExpand(folder.key); }}
                                className="doc-action-btn" title={isExpanded ? "Collapse" : "Expand"}>{isExpanded ? "▾" : "▸"}</button>
                              <button onClick={(e) => { e.stopPropagation(); setRenameItem({ ...folder, type: "folder" }); setRenameValue(folder.name); }}
                                className="doc-action-btn" title="Rename">✎</button>
                              <button onClick={(e) => { e.stopPropagation(); setMoveItem({ ...folder, type: "folder" }); setMoveTarget(""); fetchAllFolders(); }}
                                className="doc-action-btn" title="Move">⇄</button>
                              <button onClick={(e) => { e.stopPropagation(); setDeleteFolderConfirm(folder); }}
                                className="doc-action-btn doc-action-delete" title="Delete">✕</button>
                            </div>
                          </td>
                        </tr>
                      );
                      // Render expanded contents
                      if (isExpanded && expandedFolders[folder.key]) {
                        const nested = expandedFolders[folder.key];
                        rows.push(...renderRows(nested.folders || [], nested.files || [], depth + 1));
                        if ((nested.folders || []).length === 0 && (nested.files || []).length === 0) {
                          rows.push(
                            <tr key={folder.key + "_empty"}>
                              <td colSpan={4} style={{ ...s.td, paddingLeft: indent + 48, fontSize: 11, color: "#bbb", fontStyle: "italic" }}>Empty folder</td>
                            </tr>
                          );
                        }
                      }
                    });
                    // Files
                    fileList.forEach(file => {
                      const icon = fileIcon(file.name);
                      rows.push(
                        <tr key={file.key}
                          draggable onDragStart={e => onRowDragStart({ ...file, type: "file" }, e)} onDragEnd={onRowDragEnd}
                          style={{ cursor: "grab", opacity: dragItem?.key === file.key ? 0.4 : 1, transition: "opacity 0.15s" }}
                          onMouseEnter={e => e.currentTarget.style.background = "#fafafa"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                          <td style={s.td}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: indent + 24 }}>
                              <div style={{ width: 28, height: 28, borderRadius: 4, background: icon.bg, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 600, letterSpacing: "0.02em", flexShrink: 0 }}>
                                {icon.label}
                              </div>
                              <span style={{ fontWeight: 500, fontSize: 12 }}>{file.name}</span>
                            </div>
                          </td>
                          <td style={{ ...s.td, textAlign: "right", fontSize: 11, color: "#888" }}>{formatFileSize(file.size)}</td>
                          <td style={{ ...s.td, fontSize: 11, color: "#888" }}>{new Date(file.uploaded).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
                          <td style={{ ...s.td, textAlign: "center" }}>
                            <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                              <button onClick={() => setPreflightFile(file)}
                                className="doc-action-btn doc-action-preflight" title="Preflight Check">◉</button>
                              <button onClick={() => downloadFile(file)}
                                className="doc-action-btn" title="Download">↓</button>
                              <button onClick={() => { setRenameItem({ ...file, type: "file" }); setRenameValue(file.name); }}
                                className="doc-action-btn" title="Rename">✎</button>
                              <button onClick={() => { setMoveItem({ ...file, type: "file" }); setMoveTarget(""); fetchAllFolders(); }}
                                className="doc-action-btn" title="Move">⇄</button>
                              <button onClick={() => setDeleteConfirm(file)}
                                className="doc-action-btn doc-action-delete" title="Delete">✕</button>
                            </div>
                          </td>
                        </tr>
                      );
                    });
                    return rows;
                  };
                  return renderRows(folders, files, 0);
                })()}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Grid view */
        <div className="docs-grid">
          {folders.map(folder => (
            <div key={folder.key} style={s.card} className="docs-grid-item" onClick={() => enterFolder(folder.name)}>
              <div style={{ padding: "20px 16px 12px", textAlign: "center", cursor: "pointer" }}>
                <div style={{ width: 48, height: 48, borderRadius: 8, background: "#999", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 18, marginBottom: 10 }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff" stroke="none"><path d="M10 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-8l-2-2z"/></svg>
                </div>
                <div style={{ fontWeight: 500, fontSize: 12, wordBreak: "break-word" }}>{folder.name}</div>
                <div style={{ fontSize: 10, color: "#999", marginTop: 2 }}>Folder</div>
              </div>
              <div style={{ display: "flex", borderTop: "1px solid #f0f0f0" }}>
                <button onClick={(e) => { e.stopPropagation(); setRenameItem({ ...folder, type: "folder" }); setRenameValue(folder.name); }}
                  style={{ flex: 1, background: "none", border: "none", borderRight: "1px solid #f0f0f0", padding: "8px 0", cursor: "pointer", fontSize: 10, color: "#555" }}>Rename</button>
                <button onClick={(e) => { e.stopPropagation(); setDeleteFolderConfirm(folder); }}
                  style={{ flex: 1, background: "none", border: "none", padding: "8px 0", cursor: "pointer", fontSize: 10, color: "#dc2626" }}>Delete</button>
              </div>
            </div>
          ))}
          {files.map(file => {
            const icon = fileIcon(file.name);
            return (
              <div key={file.key} style={s.card} className="docs-grid-item">
                <div style={{ padding: "20px 16px 12px", textAlign: "center" }}>
                  <div style={{ width: 48, height: 48, borderRadius: 8, background: icon.bg, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
                    {icon.label}
                  </div>
                  <div style={{ fontWeight: 500, fontSize: 12, marginBottom: 4, wordBreak: "break-word" }}>{file.name}</div>
                  <div style={{ fontSize: 10, color: "#999" }}>{formatFileSize(file.size)}</div>
                </div>
                <div style={{ display: "flex", borderTop: "1px solid #f0f0f0" }}>
                  <button onClick={() => setPreflightFile(file)}
                    style={{ flex: 1, background: "none", border: "none", borderRight: "1px solid #f0f0f0", padding: "8px 0", cursor: "pointer", fontSize: 10, color: "#7c3aed" }}>Preflight</button>
                  <button onClick={() => downloadFile(file)}
                    style={{ flex: 1, background: "none", border: "none", borderRight: "1px solid #f0f0f0", padding: "8px 0", cursor: "pointer", fontSize: 10, color: "#555" }}>Download</button>
                  <button onClick={() => setDeleteConfirm(file)}
                    style={{ flex: 1, background: "none", border: "none", padding: "8px 0", cursor: "pointer", fontSize: 10, color: "#dc2626" }}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete file modal */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setDeleteConfirm(null)}>
          <div style={{ background: "#fff", borderRadius: 8, padding: "24px 28px", maxWidth: 380, width: "90%" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 8 }}>Delete File</div>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 20 }}>
              Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? This cannot be undone.
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ ...s.btn("secondary"), fontSize: 11, padding: "6px 16px" }}>Cancel</button>
              <button onClick={() => deleteFile(deleteConfirm)} style={{ ...s.btn(), fontSize: 11, padding: "6px 16px", background: "#dc2626" }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete folder modal */}
      {deleteFolderConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setDeleteFolderConfirm(null)}>
          <div style={{ background: "#fff", borderRadius: 8, padding: "24px 28px", maxWidth: 380, width: "90%" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 8 }}>Delete Folder</div>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 20 }}>
              Delete <strong>{deleteFolderConfirm.name}</strong> and <strong>all its contents</strong>? This cannot be undone.
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteFolderConfirm(null)} style={{ ...s.btn("secondary"), fontSize: 11, padding: "6px 16px" }}>Cancel</button>
              <button onClick={() => deleteFolder(deleteFolderConfirm)} style={{ ...s.btn(), fontSize: 11, padding: "6px 16px", background: "#dc2626" }}>Delete All</button>
            </div>
          </div>
        </div>
      )}

      {/* Rename modal */}
      {renameItem && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setRenameItem(null)}>
          <div style={{ background: "#fff", borderRadius: 8, padding: "24px 28px", maxWidth: 380, width: "90%" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 8 }}>Rename {renameItem.type === "folder" ? "Folder" : "File"}</div>
            <input value={renameValue} onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleRename()}
              autoFocus style={{ ...s.input, width: "100%", padding: "8px 12px", fontSize: 12, marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setRenameItem(null)} style={{ ...s.btn("secondary"), fontSize: 11, padding: "6px 16px" }}>Cancel</button>
              <button onClick={handleRename} style={{ ...s.btn(), fontSize: 11, padding: "6px 16px" }}>Rename</button>
            </div>
          </div>
        </div>
      )}

      {/* Move modal */}
      {moveItem && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setMoveItem(null)}>
          <div style={{ background: "#fff", borderRadius: 8, padding: "24px 28px", maxWidth: 420, width: "90%" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 4 }}>Move {moveItem.type === "folder" ? "Folder" : "File"}</div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 16 }}>Moving: <strong>{moveItem.name}</strong></div>
            <div style={{ fontSize: 11, fontWeight: 500, marginBottom: 6 }}>Select destination folder:</div>
            <div style={{ maxHeight: 200, overflow: "auto", border: "1px solid #e5e7eb", borderRadius: 4, marginBottom: 16 }}>
              {allFolders.map(f => {
                const display = f === "" ? "/ (root)" : "/" + f;
                const isCurrentDir = f === currentPath.join("/");
                return (
                  <div key={f} onClick={() => setMoveTarget(f)}
                    style={{ padding: "8px 12px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                      background: moveTarget === f ? "#f0f0f0" : "transparent",
                      color: isCurrentDir ? "#aaa" : "#333",
                      borderBottom: "1px solid #f5f5f5" }}>
                    <span style={{ fontSize: 14 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="#999" stroke="none"><path d="M10 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-8l-2-2z"/></svg></span>
                    <span>{display}</span>
                    {isCurrentDir && <span style={{ fontSize: 10, color: "#bbb", marginLeft: "auto" }}>current</span>}
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setMoveItem(null)} style={{ ...s.btn("secondary"), fontSize: 11, padding: "6px 16px" }}>Cancel</button>
              <button onClick={handleMove} style={{ ...s.btn(), fontSize: 11, padding: "6px 16px" }}>Move Here</button>
            </div>
          </div>
        </div>
      )}

      {/* Busy overlay for move/rename operations */}
      {busy && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 1100, gap: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid rgba(255,255,255,0.2)", borderTopColor: "#fff", animation: "preflight-spin 0.6s linear infinite" }} />
          <div style={{ color: "#fff", fontSize: 14, fontWeight: 500 }}>{busy}</div>
        </div>
      )}

      {/* Preflight modal */}
      {preflightFile && (
        <PreflightModal file={preflightFile} onClose={() => setPreflightFile(null)} workerCreds={workerCreds} />
      )}
    </div>
  );
}

const fs = require("fs");

const { createWorker, OEM, PSM } = require("tesseract.js");

const { logger } = require("./logger.js");
const { type } = require("os");

// Initialize Tesseract worker at the start to reuse throughout the application
let worker;

async function initWorker(options = {}) {
  let worker;

  try {
    worker = await createWorker("eng+ell");
    await worker.setParameters(options);
  } catch (error) {
    logger.error("Errore in services/ocr/initWorker: ", error);
  }

  return worker;
}

const opt = {
  tessedit_pageseg_mode: 6,
  tessjs_create_hocr: "0",
  tessjs_create_tsv: "0",
  presets: ["bazaar"],
  tessedit_char_whitelist:
    " 0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩαβγδεζηθικλμνξοπρστυφχψω-<>,.",
};

async function recognize(buff, url, options = opt) {
  if (!buff) {
    logger.error("No buffer passed to recognize", url);
    return null;
  }

  let buffer;
  if (typeof buff === "string") {
    buffer = fs.readFileSync(buffer);
  } else {
    buffer = buff;
  }

  if (!worker) {
    worker = await initWorker(options);
  }
  try {
    let start = performance.now();
    if (options) {
      await worker.setParameters(options);
    }

    const result = await worker.recognize(buffer);

    const text = result?.data?.text.replace(/Δ|∆|△/g, "∆");
    let end = performance.now();
    console.info("OCRed in", (end - start).toFixed(2), "ms");
    return text;
  } catch (error) {
    logger.error("Error in services/ocr/recognize: ", error);
    return null;
  }
}

module.exports = {
  recognize,
  initWorker,
};

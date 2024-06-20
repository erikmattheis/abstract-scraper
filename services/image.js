const axios = require("axios");
const gm = require("gm").subClass({ imageMagick: true });
const fs = require("fs");
const { logger } = require("./logger.js");
const path = require("path");
const { getCachedBuffer, fileCachedBuffer } = require("./memory.js");

async function readImage(url, options = {}) {
  console.info("Read Image", url);

  try {
    buffer = await getImageBuffer(url);

    return buffer;
  } catch (error) {
    logger.error(`Error around readImage: ${error}`);
    return null;
  }
}

async function getImageBuffer(url) {
  try {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    const value = Buffer.from(response.data, "binary");
    const lastModified = response.headers["last-modified"];
    return { value, lastModified };
  } catch (error) {
    logger.error(`Error getting image buffer: ${error}`, { url });
    fs.appendFileSync(
      "./temp/errors.getImageBuffer.txt",
      `\nUrl: ${url}\n${JSON.stringify(error, null, 2)}\n\n`
    );
    return null;
  }
}

async function processImage(
  buffer,
  url,
  options = { sharpen: 1.5, resize: 4000 }
) {
  try {
    return await new Promise((resolve, reject) => {
      gm(buffer)
        .quality(100)
        .density(300, 300)
        .sharpen(options.sharpen)
        .resize(options.resize)
        // to jpeg
        .setFormat("jpeg")
        .toBuffer((err, buffer) => {
          if (err) {
            console.error(`Error processing imageA: ${err.message}`, { url });
            fs.appendFileSync(
              "./temp/errors.processImage1.txt",
              `\nurl: ${url}\n${JSON.stringify(err, null, 2)}\n\n`
            );
            reject(err);
          } else {
            resolve(buffer);
          }
        });
    });
  } catch (error) {
    logger.error(`Error processing imageB: ${error}`, { url });
    fs.appendFileSync(
      "./temp/errors.processImage2.txt",
      `\nurl: ${url}\n${JSON.stringify(error, null, 2)}\n\n`
    );
    return null;
  }
}

module.exports = {
  readImage,
};

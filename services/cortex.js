const fs = require("fs");
const axios = require("axios");
const { logger } = require("./logger.js");
const { nameLists, initMemory } = require("./memory.js");
const { readGraphic } = require("./AIReadFile.js");

const { recognize } = require("./ocr.js");
const { putAssaysFirst } = require("./array-utils.js");
const { possiblyAddDomain } = require("./strings.js");
const { getAssayType, getExampleChemicalNames } = require("./data.js");

function getLastModified(url, existingAssays) {
  const match = existingAssays.find((assay) => assay.url === url);
  const lastModified = match?.lastModified;
  return lastModified;
}
let num = 100;
async function makeAssay(
  img,
  spellingMaps,
  selector,
  existingAssays,
  exampleChemicalNames
) {
  console.log("makeAssay", img);
  // check if url is valid
  if (!img || typeof img !== "string" || !img.startsWith("http")) {
    return null;
  }

  const image = possiblyAddDomain(img);

  const response = await axios.get(image, { responseType: "arraybuffer" });

  const lastModified = response.headers["last-modified"];

  let assay, assayType;

  if (existingAssays) {
    const savedLastModified = getLastModified(image, existingAssays);
    const remoteLastModified = lastModified;

    if (remoteLastModified === savedLastModified) {
      const existingAssay = existingAssays.find((assay) => assay.url === image);
      if (existingAssay) {
        assay = existingAssay;
      }
    }
  }

  if (!assay) {
    const buffer = Buffer.from(response.data, "binary");

    const start = Date.now();
    const text = await recognize(buffer, image);
    const end = Date.now();
    console.log("Time to ocr", end - start);

    if (text) {
      fs.writeFileSync(`./temp/x/${num}.txt`, text);
      num = num + 1;
    }

    assay = transcribeAssay(text, spellingMaps);

    if (!assay) {
      return null;
    }

    const { list } = assay;

    for (let k = 0; k < list.length; k++) {
      assayType = getAssayType(list[k].name, exampleChemicalNames);

      if (assayType) {
        break;
      }
    }
    // const AIList = await readGraphic(image);
  }
  // need the value like Cannabinoids ot Terpenes so I can name the assay
  const result = {
    ...assay,
    image,
    lastModified,
    type: assayType,
    /*  AIList, */
  };
  return result;
}

async function makeAssays(images, spellingMaps, selector, existingAssays) {
  const assays = [];

  const exampleChemicalNames = getExampleChemicalNames(selector.chemicalLists);

  for await (const image of images) {
    const assay = await makeAssay(
      image,
      spellingMaps,
      selector,
      existingAssays,
      exampleChemicalNames
    );

    if (assay && assay.list.length) {
      assays.push(assay);
    }

    if (assays.length === selector.chemicalLists.length) {
      break;
    }
  }

  return assays;
}

function transcribeAssay(text, spellingMaps) {
  try {
    if (!text?.split) {
      logger.error(`can't split ${text}`);
      return [];
    }

    const list = [];

    const lines = text.split("\n");

    for (const line of lines) {
      const chem = lineToChemicalObject(line, spellingMaps);

      if (chem.name !== "Unknown") {
        list.push(chem);
      } else {
        recordUnknown("transcribeAssay", line);
      }
    }

    if (list.length === 0) {
      logger.info("No chemicals found");
      return null;
    }

    return {
      list,
      name: list[0]?.type || undefined,
    };
  } catch (error) {
    logger.error("From transcribeAssay", error);
    return [];
  }
}

function removeCharactersAfterLastDigit(str) {
  const match = str.match(/.*\s\d+(\.\d+)?/g);
  return match ? match[0] : "";
}

function fixMissedPeriod(str) {
  if (!str || !str.replace || str?.toString().includes(".")) {
    return str;
  }

  let string = str.replace(".", "");
  if (string.length > 3) {
    string =
      string.slice(0, string.length - 3) +
      "." +
      string.slice(string.length - 3);
  }
  return string;
}

const unknowns = [];

function lineToChemicalObject(line, spellingMaps) {
  try {
    if (!line?.replace) {
      logger.error("Not a string", `${line}\n`);
      return { name: "Unknown", pct: 0, line };
    }

    let cleanedLine = line.replace(/\s+/g, " ").trim();

    const completeLine = cleanedLine;

    cleanedLine = removeCharactersAfterLastDigit(cleanedLine);

    const knownWords = findMisspelling(cleanedLine, spellingMaps);

    if (!knownWords || Object.keys(knownWords)[0] === "Unknown") {
      if (!unknowns.includes(cleanedLine) && linePasses(cleanedLine)) {
        fs.appendFileSync("./temp/unknownlines.txt", `${completeLine}\n`);
      }
      return { name: "Unknown", pct: 0, line: completeLine };
    }

    const [[keyName, name]] = Object.entries(knownWords);

    if (cleanedLine.startsWith(keyName)) {
      cleanedLine = cleanedLine.slice(keyName.length).trim();
    } else if (linePasses(cleanedLine)) {
      fs.appendFileSync("./temp/unknownlines2.txt", `$${cleanedLine}\n`);
    }

    let parts = cleanedLine.split(" ");

    parts = parts.map((part, i) => {
      if (!isNaN(part)) {
        return fixMissedPeriod(part);
      }
      return part;
    });

    const mgg = getMgg(parts, line);

    const pct = parseFloat(mgg);

    return { name, pct, line };
  } catch (error) {
    logger.error("From lineToChemicalObject", error);
    return { name: "Unknown", pct: 0, line };
  }
}

function isCalibration(part) {
  return /ND$|\.0457$|\.0459$|\.0485$|\.0508$$|\.0515$|\.0728$|^>3\.000$|^0\.030|^0\.0500$|3\.000$|^0\.750$|[<>][LlIi1|][Oo0]Q$/.test(
    part
  );
}

function getMgg(parts, line) {
  const importantParts = parts.filter((part) => !isCalibration(part));
  console.log(importantParts);
  if (importantParts.length < 3) {
    return 0;
  }

  const last = fixMissedPeriod(
    parseFloat(importantParts[importantParts.length - 1])
  );

  const secondToLast = fixMissedPeriod(
    parseFloat(importantParts[importantParts.length - 2])
  );
  console.log("last/second to last", last, secondToLast);
  let mgg =
    parseFloat(last) > parseFloat(secondToLast)
      ? parseFloat(last)
      : parseFloat(secondToLast);

  if (isNaN(mgg)) {
    fs.appendFileSync("./temp/not-number.txt", `No: ${mgg} | ${line}\n`);
    mgg = 0;
  }

  return mgg;
}

const lines = new Set();

function linePasses(line) {
  if (lines.has(line)) {
    return false;
  }
  const hasLetter = /[a-zA-Z]{5,}/.test(line);
  const hasNumber = /\d{3,}/.test(line);
  const hasSpace = line?.split(" ").length > 1;
  if (hasLetter && hasNumber && hasSpace && line.length > 8) {
    lines.add(line);
    return true;
  }
  return false;
}

function recordUnknown(str, ln) {
  if (linePasses(ln)) {
    fs.appendFileSync("./temp/unknownlines3.txt", `${str}: ${ln}\n`);
  }
}

function correctSpelling(line, spellingMaps) {
  for (const spellingMap in spellingMaps) {
    for (const m in spellingMaps[spellingMap]) {
      if (line.startsWith(m)) {
        return { type: spellingMap, name: m };
      }
    }
  }

  return { type: "Unknown", name: "Unknown" };
}

function findMisspelling(line, spellingMaps) {
  for (const spellingMap in spellingMaps) {
    const map = spellingMaps[spellingMap];
    for (let i = 1; i < map.length; i++) {
      if (line.startsWith(Object.keys(map[i])[0])) {
        return map[i];
      }
    }
  }

  return null;
}

function stringContainsNonFlowerProduct(str) {
  if (
    [
      "2 g",
      "2 oz",
      "Diamond Shards",
      "NaN g",
      " Roll",
      " Rosin",
      "Rosin ",
      "Resin",
      "Full Melt",
      "Bubble Hash",
      "Sift Hash",
      "Macaroons",
      "Cannacookies",
      "Pre - Rolls",
      " Pre Rolls",
      "Pre Rolls",
      "Mixed Smalls",
      "Mixed Shake",
      " Diamonds",
      "Cereal Bars",
      "Bundles",
      "Vape ",
      "CannaCookies",
    ].some((s) => str.includes(s))
  ) {
    return true;
  }
  return false;
}

module.exports = {
  stringContainsNonFlowerProduct,
  makeAssays,
  findMisspelling,
  transcribeAssay,
  lineToChemicalObject,
};

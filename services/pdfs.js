const fs = require("fs");
const axios = require("axios");
// todo: use something else?
const pdf = require("pdf-parse");
const { transcribeAssay } = require("./cortex.js");
const { cannabinoidNameList, terpeneNameList } = require("../services/memory");

async function readPDFs(pdfs, vendor) {
  const results = [];

  for await (const pdf of pdfs) {
    const result = await readPDF(pdf.url, pdf.name, vendor);

    results.push(result);
  }

  return results;
}

function fixText(str) {
  const regex = /\d+\.\d{3}|\d+/g;

  // Check if the input only contains numbers and spaces
  if (/^[\d\s.]+$/.test(str)) {
    // If so, return the input as is
    return str;
  }

  let fixedText = insertSpaces(str);
  fixedText = fixedText.replace(" -", "-");
  return fixedText;
}

async function readPDF(url, name, vendor) {
  const buffer = await returnPDFBuffer(url);

  const fixedText = fixText(buffer);

  const assay = transcribeAssay(fixedText, url, vendor);

  return {
    url,
    name,
    assay,
  };
}

function insertSpaces(input) {
  // Find numbers with three decimal places or sequences of numbers and periods
  const regex = /(\d+\.\d{3})|(\d+)/g;

  // Extract all numbers and periods from the input string
  let matches = input.match(regex);

  // If there are no matches, return the input as is
  if (!matches) {
    return input;
  }

  // Filter and process matches to ensure correct decimal places
  matches = matches.map((match) => {
    if (match.includes(".")) {
      const parts = match.split(".");
      parts[1] = parts[1].padEnd(3, "0");
      return parts.join(".");
    } else {
      return match;
    }
  });

  // Replace each match in the input string with the corresponding processed match
  return input
    .replace(regex, () => {
      const nextMatch = matches.shift();
      return nextMatch ? " " + nextMatch + " " : "";
    })
    .trim();
}

async function returnPDFBuffer(url) {
  try {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    const data = await pdf(response.data);
    return data.text;
  } catch (error) {
    throw error;
  }
}

async function addAssays(pdfObjs, url, vendor) {
  const withAssays = [];
  for (const pdf of pdfObjs) {
    const result = transcribeAssay(pdf.text, url, vendor);
    if (result.length) {
      if (cannabinoidNameList.includes(result[0].name)) {
        cannabinoids = result.filter((a) =>
          cannabinoidNameList.includes(a.name)
        );
      }
      if (terpeneNameList.includes(result[0].name)) {
        terpenes = result.filter((a) => terpeneNameList.includes(a.name));
      }
      if (terpenes.length && cannabinoids.length) {
        break;
      }
    }
    withAssays.push({
      ...pdf,
      assay: assay,
      dateCrawled: new Date(),
    });
  }
  return withAssays;
}

module.exports = {
  readPDFs,
  readPDF,
  addAssays,
};

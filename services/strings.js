const levenshtein = require("fast-levenshtein");

function getPathSegment(url, segment) {
  const urlObj = new URL(url);
  return urlObj.pathname.split("/")[segment];
}

/**
 * Selects the closest matching chemical name from a list based on the given input.
 *
 * @param {string} inputName The input chemical name to match.
 * @param {string[]} chemicalNamesList The list of available chemical names.
 * @returns {string} The closest matching chemical name from the list.
 */
function getClosestChemicalName(inputName, chemicalNamesList) {
  let closestMatch = "";
  let smallestDistance = Infinity;

  chemicalNamesList.forEach((name) => {
    const distance = levenshtein.get(inputName, name);
    if (distance < smallestDistance) {
      smallestDistance = distance;
      closestMatch = name;
    }
  });

  return {
    match,
    distance: smallestDistance,
  };
}

const fs = require("fs");

function normalizeProductTitle(title) {
  let replaceString = title;
  const find = [
    "Pheno 1",
    "Pheno 2",
    "Hemp Flower",
    "(Indoor)",
    "(Greenhouse)",
    "High THCa",
    "THCa",
    "Hydro",
    "Indoor",
    "Living Soil",
    "Hemp",
    "THCa Flower",
    "Flower",
    "  ",
  ];
  for (let i = 0; i < find.length; i++) {
    replaceString = replaceString.replace(find[i], "");
    replaceString = replaceString.replace(/\s+/g, " ");
    replaceString = replaceString.trim();
  }
  return replaceString;
}

function isValidURI(string) {
  const uriRegex = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i;
  return uriRegex.test(string);
}

const variantNameMap = {
  "1-g": "1 g",
  "1-oz": "28 g",
  "1/2 Ounce": "14 g",
  "1/2 oz smalls Bag": "14 g smalls",
  "1/2 oz smalls": "14 g smalls",
  "1/2 oz": "14 g",
  "14 grams": "14 g",
  "14-g": "14 g",
  "14g (small/minis)": "14 g smalls",
  "1g": "1 g",
  "1oz": "28 g",
  "28 grams": "28 g",
  "28g (small/minis)": "28 g smalls",
  "28g": "28 g",
  "3.5 g Pheno 1": "3.5 g",
  "3.5 g Pheno 2": "3.5 g",
  "3.5 grams": "3.5 g",
  "3.5-g": "3.5 g",
  "3.5g": "3.5 g",
  "7 g Pheno 2": "7 g",
  "7 g": "7 g",
  "7 grams": "7 g",
  "7-g": "7 g",
  "7g": "7 g",
  "Dry Sift 1g": "1 g",
  "Half oz": "14 g",
  "Mixed Dirty Kief 28 grams": "28 g",
  "Mixed T1 Sugar leaf/ trim - 28 grams": "28 g",
  "Mixed+Dirty+Kief+28+grams": "28 g",
  "smalls 14 grams": "14 g smalls",
  "smalls 28 grams": "28 g smalls",
  "Sugar leaf trim - 28 grams": "28 g",
};

function normalizeVariantName(nameStr) {
  let name = nameStr.trim() + "";
  name = name?.replace(/(\d)([a-zA-Z])/g, "$1 $2");
  name = name?.replace(/(\s+)/g, " ");
  name = name?.replace(/SMALLS/g, "smalls");
  name = name?.replace(/MINIS/g, "minis");
  name = name?.replace(/Smalls/g, "smalls");
  name = name?.replace(/Minis/g, "minis");
  name = name?.replace(/\(small\/minis\)/g, "smalls");
  name = name?.replace(/ \(1\/8 oz\)/g, "");
  name = name?.replace(/ \(1\/4 oz\)/g, "");
  name = name?.replace(/ \(1\/2 oz\)/g, "");
  name = name?.replace(/ \(1 oz\)/g, "");
  name = name?.replace(/ Pheno 1/g, "");
  name = name?.replace(/ Pheno 2/g, "");
  name = name?.replace(/ 1g /g, "1 g");
  name = name?.replace(/ 3.5g /g, "3.5 g");
  name = name?.replace(/ 7g /g, "7 g");
  const result = variantNameMap[name] || name;
  return result.trim();
}

function cleanString(str) {
  return sanitize(str);
}

function variantNameContainsWeightUnitString(variantName) {
  const regexMatchingPossibleWeightString = /(\d+)(\s+)?(g|oz|gram|ounce)/i;
  return regexMatchingPossibleWeightString.test(variantName);
}

function makeFirebaseSafe(str) {
  id = str.replace(/\s/g, "-");
  id = id.replace(/%20/g, "-");
  id = id.replace(/[\/\'.#[\]*$]/g, "");
  return id;
}

function makeFirebaseSafeId(product) {
  let id = `${product.vendorName}-${product.name.trim()}`;
  id = makeFirebaseSafe(id);
  return id;
}

const cheerio = require("cheerio");

function findLargestImage(htmlString) {
  const $ = cheerio.load(htmlString);
  let largestImageUrl = "";
  let maxImageWidth = 0;

  $("img").each((i, img) => {
    const srcset = $(img).attr("srcset");
    if (srcset) {
      const sources = srcset.split(",").map((s) => s.trim());
      sources.forEach((source) => {
        const [url, width] = source.split(" ");
        const imageWidth = parseInt(width.replace("w", ""));
        if (imageWidth > maxImageWidth) {
          maxImageWidth = imageWidth;
          largestImageUrl = url;
        }
      });
    }
  });

  return largestImageUrl;
}

function possiblyAddDomain(url, domain) {
  if (!url || typeof url !== "string") {
    return null;
  }
  if (url.startsWith("//")) {
    return `https:${url}`;
  }
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    const slashOrNot = url.startsWith("/") ? "" : "/";
    return `https://${domain}${slashOrNot}${url}`;
  } else {
    return url;
  }
}

function possiblyAddProtocol(url, base = "https://") {
  let result = "";

  if (url.startsWith("http://") || url.startsWith("https://")) {
    result = url;
  } else if (url.startsWith("//")) {
    result = base.slice(0, -2) + url;
  } else if (url.startsWith("/")) {
    result = base + url.slice(1);
  } else {
    result = url;
  }

  if (!isValidURI(result)) {
    throw new Error("Invalid URL");
  }

  return result;
}

function cleanText(text, remove) {
  let result = text.replace(/\s+/g, " ").trim();
  // remove is an array of strings to remove from the text
  remove.forEach((str) => {
    result = result.replace(str, "").trim();
  });
  return result;
}

module.exports = {
  possiblyAddDomain,
  getClosestChemicalName,
  normalizeProductTitle,
  normalizeVariantName,
  variantNameContainsWeightUnitString,
  makeFirebaseSafe,
  makeFirebaseSafeId,
  findLargestImage,
  cleanString,
  isValidURI,
  possiblyAddProtocol,
  getPathSegment,
  cleanText,
};

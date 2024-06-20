const gm = require("gm");
const fs = require("fs");
const { logger } = require("./logger.js");
const path = require("path");

function longestFirst(a, b) {
  return Object.keys(b)[0].length - Object.keys(a)[0].length;
}

async function getSpellingMaps(selector) {
  try {
    const spellingMaps = {};

    for (const chemicalList of selector.chemicalLists) {
      let map = await fs.promises.readFile(
        `./data/${chemicalList.name}.json`,
        "utf8"
      );
      map = JSON.parse(map).map;

      // Process map items and replace certain characters
      /*
      map = map.map((item) => {
        if (item[0].charAt(0) === "∆") {
          item[0] = "Δ" + item[0].slice(1);
        } else if (item[0].charAt(0) === "a") {
          item[0] = "α" + item[0].slice(1);
        } else if (item[0].charAt(0) === "b") {
          item[0] = "β" + item[0].slice(1);
        } else if (
          item[0].charAt(0) === "g" ||
          item[0].charAt(0) === "Y" ||
          item[0].charAt(0) === "y"
        ) {
          item[0] = "γ" + item[0].slice(1);
        }
     
        return item;
      });
*/
      spellingMaps[chemicalList.name] = map.sort(longestFirst);
    }

    return spellingMaps;
  } catch (error) {
    console.error("Error in getSpellingMaps:", error);
    throw error; // Rethrow the error to handle it outside this function if needed
  }
}

function isIterable(obj) {
  // checks for null and undefined
  if (obj == null) {
    return false;
  }
  return typeof obj[Symbol.iterator] === "function";
}

function getNameLists(spellingMaps) {
  const nameLists = [];
  for (let i = 0; i < spellingMaps.length; i++) {
    const nameList = Array.from(Object.values(spellingMaps))
      .map((item) => item[1])
      .filter((item, index, self) => self.indexOf(item) === index);
    nameLists.push(nameList);
  }
}

function jpgNameFromUrl(url) {
  const name = url.split("/").pop().split("#")[0].split("?")[0];
  return name.endsWith(".jpg") ? name : `${name}.jpg`;
}

async function fileCachedDate(name) {
  const dir = path.join(__dirname, "../temp/scan");
  const filePath = path.join(dir, name);

  if (fs.existsSync(filePath)) {
    return fs.statSync(filePath).mtime;
  } else {
    return null;
  }
}

async function fileCachedBuffer(url, buffer) {
  const name = makeImageName(url);
  const dir = path.join(__dirname, "../temp/scan");
  const filePath = path.join(dir, name);

  if (fs.existsSync(filePath)) {
    return;
  }

  fs.writeFileSync(filePath, buffer);
}

async function getCachedBuffer(url) {
  let lastModified;
  let value;
  try {
    const name = makeImageName(url);

    const dir = path.join(__dirname, "../temp/scan");
    const filePath = path.join(dir, name);

    if (fs.existsSync(filePath)) {
      lastModified = fs.statSync(filePath)?.mtime;
      value = fs.readFileSync(filePath);
    }

    return {
      value,
      lastModified,
    };
  } catch (error) {
    logger.error(`Error getting buffer from file: ${error}`, { url });
    return {
      value,
      lastModified,
    };
  }
}

function makeImageName(url) {
  const name = jpgNameFromUrl(url);

  const domain = url.split("/")[2] ? url.split("/")[2] : "unknown";

  return `${domain}_${name}`;
}

module.exports = {
  getCachedBuffer,
  getNameLists,
  getSpellingMaps,
  fileCachedDate,
  fileCachedBuffer,
};

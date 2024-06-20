const fs = require("fs");
const readline = require("readline");
const {
  normalizeName,
  formatValue,
  isCalibration,
  getCorrectPercentage,
} = require("./utils");
const config = require("./config");

const parseLine = (line, mappings) => {
  const parts = line.trim().split(/\s+/);
  const nameParts = [];
  let pct = null;

  // Extracting parts and determining if any values are "ND" or "<LOQ"
  let values = parts.filter(
    (part) => /^[0-9]*\.?[0-9]+$/.test(part) || part === "ND" || part === "<LOQ"
  );

  // Loop to extract the name parts
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (values.includes(part)) {
      break;
    }
    nameParts.push(part);
  }

  // Join the name parts and normalize it
  const name = normalizeName(nameParts.join(" "), mappings);

  // Calculate the correct percentage
  pct = getCorrectPercentage(values);

  return {
    name: name,
    pct: pct,
    line: line,
    rating: "high",
  };
};

const parseFile = async (filePath) => {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  const results = [];
  const mappings = require("../data/cannabinoids.json").map.concat(
    require("../data/terpenes.json").map
  );

  for await (const line of rl) {
    if (line.trim()) {
      const parsedLine = parseLine(line, mappings);
      if (parsedLine) {
        results.push(parsedLine);
      }
    }
  }

  return results;
};

module.exports = { parseFile };

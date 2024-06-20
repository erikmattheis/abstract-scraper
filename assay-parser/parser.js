const fs = require("fs");
const readline = require("readline");
const { normalizeName, formatValue, isCalibration } = require("./utils");
const config = require("./config");

const parseLine = (line, mappings) => {
  const parts = line.trim().split(/\s+/);
  const nameParts = [];
  let pct = null;
  let value = null;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (/^[0-9]*\.?[0-9]+$/.test(part)) {
      if (pct === null) {
        pct = part;
      } else if (value === null) {
        value = formatValue(part);
      }
    } else {
      nameParts.push(part);
    }
  }

  const name = normalizeName(nameParts.join(" "), mappings);
  const normalizedPct = parseFloat(pct).toFixed(3);

  if (isCalibration(pct, value)) {
    return null;
  }

  return {
    name: name,
    pct: normalizedPct,
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

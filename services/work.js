const fs = require("fs");
const readline = require("readline");

const inputFile = "lines.txt"; // Path to your input file

// Function to normalize chemical names
const normalizeName = (name) => {
  return name
    .replace(/[^a-zA-Z\s]/g, "") // Remove non-alphanumeric characters
    .replace(/\s+/g, " ") // Replace multiple spaces with a single space
    .trim();
};

// Function to add a decimal point to six-digit values
const formatValue = (value) => {
  if (/^\d{6}$/.test(value)) {
    return (parseInt(value, 10) / 1000).toFixed(3);
  }
  return value;
};

const parseLine = (line) => {
  const parts = line.trim().split(/\s+/);
  const nameParts = [];
  let pct = null;
  let value = null;

  // Iterate over parts to identify name, pct, and value
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

  const name = normalizeName(nameParts.join(" "));
  const normalized_pct = parseFloat(pct).toFixed(3);

  return {
    name: name,
    pct: normalized_pct,
    line: line,
    rating: "high", // Placeholder for rating logic
  };
};

const readLines = async (filePath) => {
  const fileStream = fs.createReadStream(filePath);

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  const results = [];

  for await (const line of rl) {
    if (line.trim()) {
      const parsedLine = parseLine(line);
      if (parsedLine) {
        results.push(parsedLine);
      }
    }
  }

  return results;
};
/*
readLines(inputFile)
  .then((results) => {
    const filteredResults = results.map((result) => {
      return {
        name: result.name,
        pct: result.pct,
        rating: result.rating,
      };
    });
    console.log(JSON.stringify(filteredResults, null, 2));
  })
  .catch((error) => {
    console.error(`Error reading lines: ${error}`);
  });
*/
module.exports = { readLines };

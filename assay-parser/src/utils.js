const normalizeName = (name, mappings) => {
  for (const map of mappings) {
    const [key, value] = Object.entries(map)[0];
    if (name.includes(key)) {
      return name.replace(key, value);
    }
  }
  return name
    .replace(/[^a-zA-Z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

const formatValue = (value) => {
  if (/^\d{6}$/.test(value)) {
    return (parseInt(value, 10) / 1000).toFixed(3);
  }
  return value;
};

const isCalibration = (value) => {
  const calibrationValues = ["0.750", "3.000", "ND", "<LOQ"];
  return calibrationValues.includes(value);
};

const getCorrectPercentage = (values) => {
  // Remove calibration values and ND/<LOQ
  const validValues = values.filter(
    (val) => !isCalibration(val) && val !== "ND" && val !== "<LOQ"
  );

  // If no valid values, return 0
  if (validValues.length === 0) {
    return "0.000";
  }

  // If multiple valid values, return the last one (likely the highest concentration)
  return parseFloat(validValues[validValues.length - 1]).toFixed(3);
};

module.exports = {
  normalizeName,
  formatValue,
  isCalibration,
  getCorrectPercentage,
};

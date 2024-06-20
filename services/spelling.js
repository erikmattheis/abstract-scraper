const levenshtein = require("fast-levenshtein");

/**
 * Selects the closest matching chemical name from a list based on the given input.
 *
 * @param {string} inputName The input chemical name to match.
 * @param {string[]} chemicalNamesList The list of available chemical names.
 * @returns {string} The closest matching chemical name from the list.
 */
function selectClosestFromList(inputName, chemicalNamesList, threshhold) {
  let closestMatch = "";
  let smallestDistance = Infinity;

  chemicalNamesList.forEach((name) => {
    const distance = levenshtein.get(inputName, name);
    if (distance < smallestDistance) {
      smallestDistance = distance;
      closestMatch = name;
    }
  });

  if (smallestDistance > threshhold) {
    return "";
  }

  return closestMatch;
}

module.exports = {
  selectClosestFromList,
};

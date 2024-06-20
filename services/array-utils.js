function putAssaysFirst(selector) {
  return function (a, b) {
    if (!a) {
      return -1;
    }
    if (!b) {
      return 1;
    }
    const aIncludes = selector.assaySubstrings.some((str) => a.includes(str));
    const bIncludes = selector.assaySubstrings.some((str) => b.includes(str));

    if (aIncludes && !bIncludes) {
      return -1;
    } else if (!aIncludes && bIncludes) {
      return 1;
    } else {
      return 0;
    }
  };
}

function getLastModifiedFromLDJson(ldJSONStr) {
  const ldJSON = JSON.parse(ldJSONStr);

  const itemPage = ldJSON["@graph"].find((element) => element.dateModified);

  // Extract the dateModified value
  const dateModified = itemPage ? itemPage.dateModified : "Not Found";

  return dateModified;
}

module.exports = { putAssaysFirst, getLastModifiedFromLDJson };

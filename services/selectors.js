const { logger } = require("./logger");
const { putAssaysFirst } = require("./array-utils");

function getTextNodes($, selector) {
  try {
    if (selector.multiple) {
      return $(selector.selector)
        .map((i, el) => $(el).text().trim())
        .get();
    } else {
      return $(selector.selector).text().trim();
    }
  } catch (error) {
    logger.error("From services/selectors/getTextNodes ", error);
    return [];
  }
}

function getAttributeValues($, selector) {
  try {
    if (selector.multiple) {
      const value = $(selector.selector)
        .map((i, el) => $(el).attr(selector.attribute).trim())
        .get();

      return value;
    } else {
      if (selector.parse) {
        let input = $(selector.selector).attr(selector.attribute)?.trim();
        input = input?.replace(/&quot;/g, '"');
        input = input ? input : "[]";

        return JSON.parse(input);
      }
      return $(selector.selector).attr(selector.attribute).trim();
    }
  } catch (error) {
    logger.error("From services/selectors/getAttributeValues ", error);
    return [];
  }
}

function getImageFromSrcset($, selector) {
  try {
    let srcSet = $(selector.selector).attr(selector.attribute);

    const images = srcSet
      .split(", ")
      .map((src) => src.split(" "))
      .map(([url, width]) => ({ url, width: parseInt(width) }));

    // Sort the images by width in ascending order
    images.sort((a, b) => a.width - b.width);

    // Find the first image with width greater than A but less than B
    const image = images.find(
      ({ width }) => width > selector.conditions[0].value
    );

    // If no such image is found, return the smallest image
    return image ? image.url : images[0].url;
  } catch (error) {
    logger.error("From services/selectors/getImageFromSrcset ", error);
    return [];
  }
}

function getWidestSrcURL(srcSet) {
  try {
    const result = srcSet
      .split(", ")
      .map((src) => src.split(" "))
      .reduce(
        (acc, cur) => {
          const [url, width] = cur;
          return parseInt(width) > parseInt(acc.width) ? { url, width } : acc;
        },
        { url: "", width: 0 }
      ).url;

    return result;
  } catch (error) {
    logger.error("From services/selectors/getWidestSrcURL ", error);
    return [];
  }
}

function getWidestSrcSetImgURLs($, selector) {
  try {
    if (selector.multiple) {
      return $(selector.selector)
        .map((i, el) => getWidestSrcURL($(el).attr(selector.attribute)))
        .get()
        .sort(putAssaysFirst);
    } else {
      return [getWidestSrcURL($(selector.selector).attr(selector.attribute))];
    }
  } catch (error) {
    logger.error("From services/selectors/getWidestSrcSetImgURLs ", error);
    return [];
  }
}

function getSrcSetImgURLs($, selector) {
  try {
    if (selector.multiple) {
      return $(selector.selector)
        .map((i, el) =>
          $(el)
            .attr(selector.attribute)
            .split(", ")
            .map((src) => src.split(" ")[0])
        )
        .get()
        .flat();
    } else {
      return $(selector.selector)
        .attr(selector.attribute)
        .split(", ")
        .map((src) => src.split(" ")[0]);
    }
  } catch (error) {
    logger.error("From services/selectors/getSrcSetImgURLs ", error);
    return $(selector.selector).attr(selector.attribute);
  }
}

module.exports = {
  getSrcSetImgURLs,
  getTextNodes,
  getAttributeValues,
  getWidestSrcSetImgURLs,
  getImageFromSrcset,
};

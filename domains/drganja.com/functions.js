const cheerio = require("cheerio");
const axios = require("axios");

function getPrices($, selector) {
  const prices = [];

  // Extract the JSON data from the variations_form element
  const jsonData = $("form.variations_form").attr("data-product_variations");
  const variations = JSON.parse(jsonData);

  // Loop through the variations to get the prices
  variations.forEach((variation) => {
    if (variation.display_price) {
      prices.push(variation.display_price);
    }
  });

  return prices;
}

module.exports = {
  getPrices,
};

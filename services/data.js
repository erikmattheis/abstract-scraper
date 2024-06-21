const { logger } = require("./logger.js");
const { writeFileSync } = require("fs");
const fs = require("fs");
const path = require("path");

const { getAllProducts } = require("./firebase");
const config = require("../domains/drganja.com/config.json");
const { add } = require("winston");

function saveResponse(response, directory, fileName) {
  try {
    writeFileSync(
      `./domains/${directory}/${fileName}.html`,
      response,

      (err) => {
        if (err) {
          console.error("from saveResponse", err);
        }
      }
    );
  } catch (err) {
    logger.error("From data/services/saveResponse ", err);
  }
}

function addNameToSet(set, name) {
  set.add(name);
}

function getExampleChemicalNames(fileConfig) {
  let result = [];
  fileConfig.forEach((chemicalType) => {
    const arr = fs.readFileSync(`./data/${chemicalType.fileName}`);
    const list = JSON.parse(arr);

    let examples = list.map;

    const type = chemicalType.name;
    examples = examples.map((example) => ({
      name: Object.values(example)[0],
      type,
    }));
    result = result.concat(examples);
  });

  return result;
}
function getAssayType(name, exampleChemicalNames) {
  if (!name) {
    return null;
  }

  for (let i = 0; i < exampleChemicalNames.length; i++) {
    if (name === exampleChemicalNames[i].name) {
      return exampleChemicalNames[i].type;
    }
  }
  return null;
}

async function makeProductsFile(vendor, limit, useDevCollection) {
  let products = await getAllProducts();

  let result = [];

  const assaySets = [];
  const variantSet = new Set();
  const vendorSet = new Set();

  const exampleChemicalNames = getExampleChemicalNames([
    {
      name: "Terpenes",
      fileName: "terpenes.json",
    },
    {
      name: "Cannabinoids",
      fileName: "cannabinoids.json",
    },
  ]);
  console.log("products", products.length);
  for (let i = 0; i < products.length; i++) {
    addNameToSet(vendorSet, products[i].vendorName);

    if (products[i].description) {
      delete products[i].description;
    }

    for (let j = 0; j < products[i].variants.length; j++) {
      addNameToSet(variantSet, products[i].variants[j].name);
    }
    const assays = products[i].assays;

    if (!assays) {
      continue;
    }

    for (let j = 0; j < assays.length; j++) {
      const list = assays[j].list;
      if (!list || !list.length) {
        continue;
      }

      let type = null;

      for (let k = 0; k < list.length; k++) {
        type = getAssayType(list[k].name, exampleChemicalNames);

        if (type) {
          break;
        }
      }

      assays[j].type = type;
      assays[j].list = assays[j].list
        .filter((a) => a.pct > 0)
        .map((assay) => {
          if (!assaySets[type]) {
            assaySets[type] = new Set();
          }

          addNameToSet(assaySets[assayType], assay.name);

          return {
            name: assay.name,
            pct: assay.pct,
          };
        });
    }

    result.push({
      name: products[i].name,
      vendorName: products[i].vendorName,
      prices: products[i].prices,
      variants: products[i].variants,
      assays,
      image: products[i].image,
      url: products[i].url,
      lastModified: products[i].lastModified,
      createdAt: products[i].timestamp,
    });
  }

  const updatedAt = new Date().toISOString();

  const vendors = Array.from(vendorSet);

  const variants = Array.from(variantSet);

  const assays = assaySets.map((set) => Array.from(set));
  /*
  fs.writeFileSync(
    "../app/src/assets/data/products.json",
    JSON.stringify({
      products: result,
      variants,
      assays,
      updatedAt,
    })
  );
  */
  fs.writeFileSync(
    "./temp/products.json",
    JSON.stringify({
      products: result,
      variants,
      assays,
      vendors,
      updatedAt,
    })
  );

  logger.info({
    level: "info",
    message: `Wrote ${result.length} products to products.json`,
  });
}

module.exports = {
  saveResponse,
  makeProductsFile,
  getExampleChemicalNames,
  getAssayType,
};

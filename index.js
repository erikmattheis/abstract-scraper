require("dotenv").config();
const config = require("./domains/wnc-cbd.com/config.json");

const axios = require("axios");
const cheerio = require("cheerio");
const puppeteer = require("puppeteer");
const isURL = require("is-url");

const fs = require("fs");
const { run } = require("./services/AIReadFile");

const { logger, deleteLogs } = require("./services/logger");
const { makeAssays } = require("./services/cortex");
const { getSpellingMaps } = require("./services/memory");
const { saveResponse, makeProductsFile } = require("./services/data");
const {
  getPathSegment,
  cleanText,
  normalizeVariantName,
} = require("./services/strings");
const {
  getTextNodes,
  getAttributeValues,
  getWidestSrcSetImgURLs,
  getImageFromSrcset,
} = require("./services/selectors");
const {
  getLastModifiedFromLDJson,
  putAssaysFirst,
} = require("./services/array-utils");
const {
  saveProducts,
  getProductsByVendor,
  copyAndDeleteProducts,
  getNextBatchNumber,
  getAllProducts,
  archiveProduct,
  recalculateChemicalValues,
} = require("./services/firebase");

const { readPDF } = require("./services/pdfs");
const { readImage } = require("./services/image");

const { possiblyAddDomain } = require("./services/strings");
const { possiblyAddProtocol } = require("./services/strings");

const { readLines } = require("./services/work");

async function writeThings() {
  const lines = await readLines("lines.txt");

  let products = await getAllProducts();
  products = products.map((product) => {
    product.assays?.forEach((assay) => {
      assay.list?.forEach((chem) => {
        if (!lines.includes(chem.line)) {
          lines.push(chem.line);
        }
      });
    });
  });
  fs.writeFileSync("lines.txt", lines.join("\n"));
}

async function getAssays($, selector, existingAssays) {
  try {
    const spellingMaps = await getSpellingMaps(selector);

    let images = [];

    if (selector.isSrcset) {
      images = getWidestSrcSetImgURLs($, selector);
    } else {
      images = getAttributeValues($, selector);
    }

    images = images
      .map((image) => possiblyAddDomain(image, config.domain))
      .sort(putAssaysFirst(selector));

    const assays = await makeAssays(
      images,
      spellingMaps,
      selector,
      existingAssays
    );

    return assays;
  } catch (error) {
    logger.error("From index/getAssays ", error);
  }
}

function isDifferent(product, existingProduct) {
  const ignoreKeys = [
    "batchNumber",
    "DSVersion",
    "vendorConfigVersion",
    "vendorName",
    "scrapeDate",
    "url",
  ];

  if (!existingProduct) {
    return true;
  }

  for (const key in product) {
    if (!ignoreKeys.includes(key)) {
      if (
        JSON.stringify(product[key]) !== JSON.stringify(existingProduct[key])
      ) {
        return true;
      }
    }
  }

  return false;
}

function getUnlinkedAssays(product, assays) {
  const unlinkedAssays = assays.filter((assay) => assay.name === product.name);

  return unlinkedAssays;
}

async function domainFunction($, selector) {
  const functions = require(`./domains/${config.localDirectory}/functions.js`);
  const prices = await functions[selector.function]($, selector);
  return prices;
}

async function getProduct(url, config, existingProduct, assays) {
  console.log("getProduct", url);

  let product = {
    DSVersion: process.env.DSVersion,
    vendorConfigVersion: config.version,
    url,
    vendorName: config.vendorName,
    scrapeDate: new Date().toISOString(),
  };

  try {
    const response = await axios.get(url);
    //saveResponse(response.data, config.localDirectory, "product");

    const $ = cheerio.load(response.data);

    for (const productSelector in config.productDetailSelectors) {
      const selector = config.productDetailSelectors[productSelector];

      switch (selector.type) {
        case "custom":
          product[selector.name] = await domainFunction($, selector);
          break;
        case "text":
          product[selector.name] = getTextNodes($, selector);
          break;
        case "attribute":
          product[selector.name] = getAttributeValues($, selector);
          break;
        case "srcset":
          product[selector.name] = getImageFromSrcset($, selector);
          break;
        case "assays":
          product[selector.name] = await getAssays(
            $,
            selector,
            existingProduct?.assayImages?.assays
          );

          break;
        case "unlinkedAssays":
          product[selector.name] = await getUnlinkedAssays(product, assays);
          break;
        case "ldjson":
          const script = $(selector.selector).html();

          if (selector.key === "dateModified") {
            product[selector.name] = getLastModifiedFromLDJson(script);
          }

          break;
        case "pathSegment":
          product[selector.name] = getPathSegment(product.url, selector);
          break;
        case "click":
          const browser = await puppeteer.launch();
          const page = await browser.newPage();

          await page.goto(url);
          await page.waitForSelector(selector.selector);

          const prices = await page.evaluate(async (selector) => {
            const prices = [];
            const nodes = document.querySelectorAll(selector.selector);

            for (const node of nodes) {
              node.click();
              await new Promise((resolve) => setTimeout(resolve, 1000)); // wait for 1 second to allow changes to reflect
              const el = document.querySelector(selector.interaction.selector);
              prices.push(el?.innerText?.trim());
            }

            return prices;
          }, selector);

          await browser.close();

          product[selector.name] = prices;

          break;
        case "select":
          const browser1 = await puppeteer.launch();
          const page1 = await browser1.newPage();

          await page1.goto(url);
          await page1.waitForSelector(selector.selector);

          const options = await page1.evaluate((selector) => {
            const options = [];

            document.querySelectorAll(selector.selector).forEach((node) => {
              options.push(node.value);
            });
            return options;
          });

          const values = [];

          for await (const option of options) {
            await page1.select(selector.selector, selector.option);
            const price = await page1.evaluate((selector) => {
              const el = document.querySelector(selector.interaction.selector);
              return el?.innerText?.trim();
            }, selector);

            values.push(price);
          }
          await browser.close();

          product[selector.name] = values;
          await page1.select(selector.selector, selector.option);

          const price = await page1.evaluate((selector) => {
            const el = document.querySelector(selector.interaction.selector);
            return el?.innerText?.trim();
          }, selector);

          await browser.close();

          product[selector.name] = price;

          break;
        default:
          break;
      }
      console.log(
        "found",
        selector.name,
        JSON.stringify(product[selector.name])
      );
    }
    fs.writeFileSync("./temp/product.json", JSON.stringify(product, null, 2));
    const nameSelector = config.productDetailSelectors.find(
      (c) => c.name === "name"
    );

    if (nameSelector.remove && product.name && nameSelector.remove.length > 0) {
      product.name = cleanText(product.name, nameSelector.remove);
    }

    if (product.price && product.price.length > 0) {
      product.price = product.price.map((price) => {
        if (!isNaN(Number(price))) {
          return price;
        }
        return parseFloat(price.replace(/[^0-9.-]+/g, ""));
      });
    }

    if (product.variants) {
      product.variants = product.variants.map((variant) => {
        return normalizeVariantName(variant) || variant;
      });
    }

    console.log("product", Object.keys(product));

    if (isDifferent(product, existingProduct)) {
      await saveProducts([product]);
      await archiveProduct(existingProduct);
    }
  } catch (error) {
    logger.error("From index/getProduct ", error);
  }
  return product;
}

async function getProducts(urls, config, existingProducts = [], assays = []) {
  if (!urls?.length) {
    return [];
  }

  try {
    let products = [];
    let product;

    for await (const url of urls) {
      const existingProduct = existingProducts.find((product) => {
        return product.url === url;
      });

      product = await getProduct(url, config, existingProduct, assays);
    }
    return products;
  } catch (error) {
    logger.error("From index/getProducts", error);
  }
  return urls;
}

function getSomeProductUrlsFromWordpressAPI(response, config) {
  console.log("get some product urls from wordpress api", response.data);
  const links = response.data.map((product) => {});
  return links;
}

function getSomeProductUrlsFromHTML(response, config) {
  const $ = cheerio.load(response.data);

  fs.writeFileSync(
    `./domains/${config.localDirectory}/products.html`,
    JSON.stringify(response.data)
  );

  const selector = config.productURLSelector;

  switch (selector.type) {
    case "text":
      links = getTextNodes($, selector);
      break;
    case "attribute":
      links = getAttributeValues($, selector);
      break;
    default:
      break;
  }

  // saveResponse(response.data, config.localDirectory, "products");

  return links;
}

async function getSomeProductURLs(url, config) {
  console.log("get some product urls", url);
  let links = [];

  try {
    const response = await axios.get(url);
    if (config.isWordpressAPI) {
      links = getSomeProductUrlsFromWordpressAPI(response, config);
    } else {
      links = getSomeProductUrlsFromHTML(response, config);
    }
  } catch (error) {
    logger.error("From index/getSomeProductURLs ", error);
  }

  return links;
}

async function getAllProductURLs(pagesOfProductURLs, config) {
  let productURLs = [];

  try {
    for await (const url of pagesOfProductURLs) {
      const newURLs = await getSomeProductURLs(url, config);
      productURLs = productURLs.concat(newURLs);
    }

    let filteredProductURLs = productURLs.filter((url) => !!url);

    filteredProductURLs = [...new Set(filteredProductURLs)];

    return filteredProductURLs;
  } catch (error) {
    logger.error("From index/getAllProductURLs ", error);
  }
}

async function getPagesOfProducts(url, config, productPageList = []) {
  console.log("Get list opf product pages", url);

  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    let newURLs = $(config.pagesOfProductURLsSelector.paginationNextSelector)
      .map((i, el) => $(el).attr("href"))
      .get();

    // Filter newURLs to remove falsy values
    newURLs = newURLs.filter((url) => !!url);

    // remove dupes
    newURLs = [...new Set(newURLs)];

    newURLs = newURLs.map((url) => {
      return possiblyAddDomain(url, config.domain);
    });

    // Add newURLs to links
    productPageList.push(...newURLs);

    // Add newURLs to links
    productPageList.push(...newURLs);

    // Get nextURL
    let nextURL = newURLs[newURLs.length - 1];

    if (nextURL) {
      nextURL = possiblyAddDomain(nextURL);
      nextURL = possiblyAddProtocol(nextURL);

      const moreLinks = await getPagesOfProducts(
        nextURL,
        config,
        productPageList
      );

      productPageList.push(...moreLinks);
    }

    // Remove duplicate values
    const uniqueURLs = [...new Set(productPageList)];
    return uniqueURLs;
  } catch (error) {
    logger.error("From getPagesOfProducts", error);
    return null;
  }
}

async function getPagesOfProductURLs(config) {
  let urls = [];
  try {
    if (config.pagesOfProductURLsSelector.name === "pagination") {
      urls = await getPagesOfProducts(config.startUrl, config);
    } else {
      urls = [config.startUrl];
    }
  } catch (error) {
    logger.error("From index/getPagesOfProductURLs ", error);
  }

  return urls;
}

async function getDomainAssays(assayPageURLs) {
  try {
    let assays = [];

    for await (const url of assayPageURLs) {
      const response = await axios.get(url);

      const $ = cheerio.load(response.data);

      const assaySelector = config.assaySelector;

      let moreNames = [];

      switch (assaySelector.assayName.type) {
        case "text":
          moreNames = getTextNodes($, assaySelector.assayName);
          break;
        case "attribute":
          moreNames = getAttributeValues($, assaySelector.assayName);
          break;
        default:
          break;
      }

      let moreURLs = [];

      switch (assaySelector.assayURL.type) {
        case "text":
          moreURLs = getTextNodes($, assaySelector.assayURL);
          break;
        case "attribute":
          moreURLs = getAttributeValues($, assaySelector.assayURL);
          break;
        default:
          break;
      }

      const moreAssays = moreURLs.map((url, i) => {
        return { url, name: moreNames[i] };
      });

      assays = assays.concat(moreAssays);
    }
    console.log("domain assays", assays.length);

    return assays;
  } catch (error) {
    logger.error("From index/getDomainAssays ", error);
    return [];
  }
}

async function getSeparateAssays(config) {
  const assayLinks = await getDomainAssays(config.assayPageURLs);

  for await (const { name, url } of assayLinks) {
    // test if it is valid url

    const valid = isURL(url);

    if (!valid) {
      logger.error(`Invalid URL: ${url}`);
      continue;
    }

    const fileSuffix = url.split(".").pop().split("#")[0].split("?")[0];

    let assays = [];

    switch (fileSuffix) {
      case "pdf":
        assay = await readPDF(url);
        break;
      case "jpg":
      case "jpeg":
      case "png":
        assay = await readImage(url);
        break;
      default:
        logger.error(`From index/scrape unrecognized file suffix: ${url}`);
        break;
    }

    assays.push({ name, assay });
  }
}

async function scrape() {
  try {
    const startTime = new Date().getTime();

    const assays = [];

    let pagesList = [];

    if (!config.urls?.length) {
      pagesList = await getPagesOfProductURLs(config);
    } else {
      pagesList = config.urls;
    }

    let assayLinks;

    if (config.assayPageURLs) {
      assayLinks = await getSeparateAssays(config);

      if (assayLinks && assayLinks.length) {
        for await (const { name, url } of assayLinks) {
          // test if it is valid url

          const valid = isURL(url);

          if (!valid) {
            logger.error(`Invalid URL: ${url}`);
            continue;
          }

          const fileSuffix = url.split(".").pop().split("#")[0].split("?")[0];

          let assay = [];

          switch (fileSuffix) {
            case "pdf":
              assay = await readPDF(url);
              break;
            case "jpg":
            case "jpeg":
            case "png":
              assay = await readImage(url);
              break;
            default:
              logger.error(
                `From index/scrape unrecognized file suffix: ${url}`
              );
              break;
          }

          assays.push({ name, assay });
        }
      }
    }

    if (!config.urls) {
      pagesList = await getPagesOfProductURLs(config);
    } else {
      pagesList = config.urls;
    }

    const urls = await getAllProductURLs(pagesList, config);

    saveResponse(
      JSON.stringify(urls, null, 2),
      config.localDirectory,
      "productURLs"
    );

    const existingProducts = await getProductsByVendor(config.vendorName);

    const products = await getProducts(urls, config, existingProducts, assays);

    const endTime = new Date().getTime();

    const duration = endTime - startTime;

    const batchNumber = process.env.batchNumber;
  } catch (error) {
    logger.error("From index/scrape ", error);
  }
}

// ...
(async () => {
  process.env.batchNumber = await getNextBatchNumber();
  //await copyAndDeleteProducts();
  deleteLogs();
  // await writeThings();
  await scrape();
  //await recalculateChemicalValues();
  await makeProductsFile();
  process.exit(0);
})();

const admin = require("firebase-admin");

const {
  getApps,
  initializeApp,
  applicationDefault,
  cert,
} = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { makeFirebaseSafe, makeFirebaseSafeId } = require("./strings.js");

const { logger } = require("./logger.js");

const cheerio = require("cheerio");

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
    appName: "DankSpider",
  });
}

const db = getFirestore();

db.settings({ ignoreUndefinedProperties: true });

async function getProductsWithTerpenes() {
  const productsRef = db.collection("products");
  const snapshot = await productsRef.get();

  const products = [];

  snapshot.forEach((doc) => {
    const product = doc.data();
    if (product.terpenes && product.terpenes.some((p) => p.pct > 0)) {
      products.push(product);
    }
    return products;
  });
  return products;
}

async function getUniqueTerpenes() {
  const productsRef = db.collection("products");
  const snapshot = await productsRef.get();

  const terpenes = new Set();

  snapshot.forEach((doc) => {
    const product = doc.data();
    product.terpenes?.forEach((terpene) => terpenes.add(terpene.name));
  });

  const t = Array.from(terpenes);
  t.sort();
  return { terpenes: t };
}

// find products with variant

async function getProductsByVariant(variant) {
  const productsRef = db.collection("products");
  const snapshot = await productsRef.get();
  const docs = snapshot.docs.map((doc) => doc.data());

  const filteredDocs = docs.filter(
    (doc) => doc.variants && doc.variants.includes(variant)
  );

  return filteredDocs;
}

function findLargestImage(htmlString) {
  const $ = cheerio.load(htmlString);
  let largestImageUrl = "";
  let maxImageWidth = 0;

  $("img").each((i, img) => {
    const srcset = $(img).attr("srcset");
    if (srcset) {
      const sources = srcset.split(",").map((s) => s.trim());
      sources.forEach((source) => {
        const [url, width] = source.split(" ");
        const imageWidth = parseInt(width.replace("w", ""));
        if (imageWidth > maxImageWidth) {
          maxImageWidth = imageWidth;
          largestImageUrl = url;
        }
      });
    }
  });

  return largestImageUrl;
}

async function getUniqueCannabinoids() {
  const productsRef = db.collection("products");

  const unique = new Set();
  const examples = [];

  const snapshot = await productsRef.get();

  snapshot.forEach((doc) => {
    const product = doc.data();

    product.cannabinoids?.forEach((cannabinoid) => {
      if (!unique.has(cannabinoid.name)) {
        unique.add(cannabinoid.name);
        examples.push({ name: cannabinoid.name, url: product.url });
      }
    });
  });

  return examples;
}

async function saveChemicals(products, useDev) {
  const batch = db.batch();
  let productsRef;
  if (useDev) {
    productsRef = db.collection("products");
  } else {
    productsRef = db.collection("products");
  }

  const timestamp = admin.firestore.Timestamp.now();
  const batchNumber = process.env.batchNumber;

  for await (const product of products) {
    const id = makeFirebaseSafeId(product, productsRef);
    const docRef = productsRef.doc(id);
    batch.set(docRef, {
      ...product,
      timestamp,
    });
  }

  await batch.commit();
}

async function getProductById(id) {
  const docRef = db.collection("products").doc(id);
  const doc = await docRef.get();
  return doc.data();
}

const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function saveProducts(products) {
  logger.info("save products");

  if (!products || !products.length) {
    return;
  }

  const batch = db.batch();
  const productsRef = db.collection("products");
  const timestamp = admin.firestore.Timestamp.now();

  for (const product of products) {
    if (product?.name) {
      const id = makeFirebaseSafeId(product);
      const docRef = productsRef.doc(id);
      batch.set(docRef, {
        ...product,
        batchNumber: process.env.batchNumber,
        timestamp,
      });
    }
  }

  await batch.commit();
}

function archiveProduct(product, version) {
  if (!product) {
    return;
  }
  // Create a composite ID from the vendor and name

  // Get the current date and time
  const timestamp = new Date();

  const YMD = `${timestamp.getFullYear()}-${timestamp.getMonth()}-${timestamp.getDate()}`;

  const productId = `${product.vendorName}-${product.name}-${YMD}`;

  const archiveCollection = db.collection("productArchives");
  return archiveCollection.doc(productId).set(product);
}

const { performance } = require("perf_hooks");

async function getAllProducts(collection = "products") {
  const productsRef = db.collection(collection).orderBy("timestamp", "desc");
  const snapshot = await productsRef.get();

  const products = [];
  const uniqueUrls = new Set();

  snapshot.forEach((doc) => {
    const product = doc.data();
    if (product.url && uniqueUrls.has(product.url)) {
      return;
    }
    uniqueUrls.add(product.url);
    products.push(product);
  });

  return products;
}

async function getIncompleteProducts() {
  const productsRef = db.collection("products").orderBy("timestamp", "desc");
  const snapshot = await productsRef.get();

  const products = [];
  const uniqueUrls = new Set();

  snapshot.forEach((doc) => {
    const product = doc.data();
    if (uniqueUrls.has(product.url)) {
      return;
    }
    if (product.cannabinoids?.length && product.terpenes?.length) {
      return;
    }
    uniqueUrls.add(product.url);
    products.push(product);
  });

  const endTime = performance.now();

  return products;
}

async function cleanProductsCollection() {
  const productsRef = db.collection("products");
  const archiveRef = db.collection("productArchive");

  const snapshot = await productsRef.orderBy("timestamp", "desc").get();

  const products = [];
  const uniqueTitles = new Set();
  const dels = [];

  snapshot.forEach((doc) => {
    const product = doc.data();

    if (product.a) {
      delete product.a;
    }

    const archiveDoc = archiveRef.doc(doc.id);

    if (uniqueTitles.has(product.title + product.vendorName)) {
      products.push(archiveDoc.set(product));
      dels.push(doc.ref.delete());
    }
    uniqueTitles.add(product.title + product.vendorName);
  });

  await Promise.all(dels);
}

async function getProductsByVendor(vendorName, limit = 0, useDev = false) {
  let productsRef;

  if (useDev) {
    productsRef = db.collection("products");
  } else {
    productsRef = db.collection("products");
  }

  let snapshot;
  if (limit && vendorName) {
    snapshot = await productsRef
      .where("vendorName", "==", vendorName)
      .limit(limit)
      .get();
  } else if (vendorName) {
    snapshot = await productsRef.where("vendorName", "==", vendorName).get();
  } else {
    snapshot = await productsRef.get();
  }

  const products = [];

  snapshot.forEach((doc) => {
    const product = doc.data();
    products.push(product);
  });

  return products;
}

async function getNextBatchNumber() {
  try {
    const batchesRef = db.collection("batches");
    const batchesSnapshot = await batchesRef
      .orderBy("batchNumber", "desc")
      .limit(1)
      .get();
    let nextBatchNumber = 1;
    if (!batchesSnapshot.empty) {
      const lastBatch = batchesSnapshot.docs[0].data();
      nextBatchNumber = lastBatch.batchNumber + 1;
    }

    return nextBatchNumber;
  } catch (error) {
    console.error("Error getting next batch number", error);
  }
}

async function saveBatch(
  batchNumber,
  config,
  startTime,
  duration,
  numDocuments
) {
  saveBatchRecord(batchNumber, config, startTime, duration, numDocuments);
}

async function saveBatchRecord(
  batchNumber,
  config,
  startTime,
  duration,
  numDocuments
) {
  const batchRef = db.collection("batches").doc();
  const batchData = {
    batchNumber,
    config,
    startTime,
    endTime,
    duration,
    numDocuments,
  };

  await batchRef.set(batchData);
}

async function deleteAllDocumentsInCollection(collectionPath) {
  const snapshot = await admin.firestore().collection(collectionPath).get();
  const batch = admin.firestore().batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();
}

async function saveStats(stats, config = {}) {
  const statsRef = db.collection("stats").doc();
  const timestamp = admin.firestore.Timestamp.now();
  const statsData = {
    stats,
    config,
    timestamp,
  };

  await statsRef.set(statsData);
}

async function getTestResults(batchNumber) {
  const testsRef = db.collection("tests");
  const snapshot = await testsRef.get();

  const tests = [];

  snapshot.forEach((doc) => {
    const test = doc.data();
    if (test.batchNumber === batchNumber) {
      tests.push(test);
    }
  });

  return tests;
}

async function saveArticles(articles, collection) {
  const batch = db.batch();
  const chemicalsRef = db.collection(collection);

  const timestamp = admin.firestore.Timestamp.now();

  for await (const article of articles) {
    const id = await makeFirebaseSafe(article.name);
    const docRef = chemicalsRef.doc(id);

    batch.set(docRef, {
      ...article,
      timestamp,
    });
  }

  await batch.commit();

  logger.info(
    `Data has been written to Firebase for ${articles.length} articles`
  );
}

async function deleteProductsByVendors(vendorNames, keepBatchNumbers = []) {
  for await (const vendorName of vendorNames) {
    const productsRef = db.collection("products");

    const snapshot = await productsRef.get();

    const batch = db.batch();

    snapshot.forEach((doc) => {
      const product = doc.data();

      if (keepBatchNumbers.ncludes(product.batchNumber)) {
        return;
      }

      if (!vendorNames.includes(product.vendorName)) {
        return;
      }

      batch.delete(doc.ref);
    });
    logger.info(`Deleted ${snapshot.size} products by vendor ${vendorName} `);
    await batch.commit();
  }
}

async function getUniqueChemicals() {
  const productsRef = db.collection("products");
  const snapshot = await productsRef.get();

  const cannabinoids = new Set();
  const terpenes = new Set();

  snapshot.forEach((doc) => {
    const product = doc.data();
    product.cannabinoids?.forEach((cannabinoid) =>
      cannabinoids.add(cannabinoid.name)
    );
    product.terpenes?.forEach((terpene) => terpenes.add(terpene.name));
  });

  const c = Array.from(cannabinoids);
  const t = Array.from(terpenes);
  c.sort();
  t.sort();
  return { cannabinoids: c, terpenes: t };
}

async function getProductsByVariant(variant) {
  const productsRef = db.collection("products");
  const snapshot = await productsRef.get();
  const docs = snapshot.docs.map((doc) => doc.data());

  const filteredDocs = docs.filter(
    (doc) => doc.variants && doc.variants.includes(variant)
  );

  return filteredDocs;
}

if (require.main === module) {
  logger.info({
    level: "info",
    message: `This script is being executed directly by Node.js`,
  });

  (async () => {
    await cleanProductsCollection();
    await cleanproductsCollection();
  })();
}

async function getProductsByBatchNumber(batchNumber) {
  const productsRef = db.collection("products");
  const snapshot = await productsRef
    .where("batchNumber", "==", batchNumber)
    .get();

  const products = [];

  snapshot.forEach((doc) => {
    const product = doc.data();
    products.push(product);
  });

  return products;
}

async function copyAndDeleteProducts(keepBatchNumbers = []) {
  const productsRef = db.collection("products");
  const secondCollectionRef = db.collection("productArchive");

  const snapshot = await productsRef.get();

  const batch = db.batch();

  snapshot.forEach((doc) => {
    const product = doc.data();
    if (!doc.id) {
      return;
    }
    let id = doc.id.replace(/\%/g, "-");
    id = decodeURIComponent(id);
    //id = id.replace(/-/g, ' ');

    if (doc && !keepBatchNumbers.some((s) => id.includes(s))) {
      const newDocRef = secondCollectionRef.doc(doc.id);
      batch.set(newDocRef, product);
      batch.delete(doc.ref);
    }
  });

  await batch.commit();
}

async function copyProducts(keepBatchNumbers = []) {
  const productsRef = db.collection("products");
  const secondCollectionRef = db.collection("products2");

  const snapshot = await productsRef.get();

  const batch = db.batch();

  snapshot.forEach((doc) => {
    const product = doc.data();
    if (!doc.id) {
      return;
    }
    let id = doc.id.replace(/\%/g, "-");
    id = decodeURIComponent(id);
    //id = id.replace(/-/g, ' ');

    if (doc && !keepBatchNumbers.some((s) => id.includes(s))) {
      const newDocRef = secondCollectionRef.doc(doc.id);
      batch.set(newDocRef, product);
    }
  });

  await batch.commit();
}

async function getExampleRecordWithUniqueChemicalAsCannabinoid(name) {
  const productsRef = db.collection("products");
  const snapshot = await productsRef.get();
  const products = [];
  const product = snapshot.forEach((doc) => {
    const data = doc.data();
    if (
      data.cannabinoids &&
      data.cannabinoids.some((cannabinoid) => cannabinoid.name === name)
    ) {
      products.push(data);
    }
  });

  return product;
}

async function saveAssays(vendor, assays) {
  if (!assays || !assays.length) {
    return;
  }
  const batch = db.batch();
  const timestamp = admin.firestore.Timestamp.now();
  const assayssRef = db.collection("assays");
  for (const assay of assays) {
    const id = makeFirebaseSafe(`${vendor} -${assay.title} `);
    const docRef = assayssRef.doc(id);
    batch.set(docRef, {
      assay,
      vendor,
      timestamp,
    });
  }

  try {
    await batch.commit();
    logger.info("Batch commit successful");
  } catch (error) {
    console.error("Error committing batch", error);
  }
}

async function deleteAssaysByVendors(vendorNames) {
  for (const vendorName of vendorNames) {
    const productsRef = db.collection("assays");

    const snapshot = await productsRef.get();

    const batch = db.batch();

    snapshot.forEach((doc) => {
      const assay = doc.data();

      if (assay.vendorName === vendorName) {
        batch.delete(doc.ref);
      }
    });
    console.info(`Deleted ${snapshot.size} assays by vendor ${vendorName} `);
    await batch.commit();
  }
}

async function getAssays() {
  const assaysRef = db.collection("assays");
  const snapshot = await assaysRef.get();

  const assays = [];

  snapshot.forEach((doc) => {
    const assay = doc.data();
    assays.push(assay);
  });

  return assays;
}

async function saveTest(result, image, config) {
  const testRef = db.collection("tests").doc();
  const timestamp = admin.firestore.Timestamp.now();
  const testData = {
    result,
    image,
    config,
    batchNumber: process.env.batchNumber,
    timestamp,
  };

  await testRef.set(testData);
}

async function copyAndDeleteProducts(keepBatchNumbers = []) {
  const productsRef = db.collection("products");
  const secondCollectionRef = db.collection("productArchive");

  const snapshot = await productsRef.get();

  const batch = db.batch();

  snapshot.forEach((doc) => {
    const product = doc.data();
    if (!doc.id) {
      return;
    }
    let id = doc.id.replace(/\%/g, "-");
    id = decodeURIComponent(id);
    //id = id.replace(/-/g, ' ');

    if (doc && !keepBatchNumbers.some((s) => id.includes(s))) {
      const newDocRef = secondCollectionRef.doc(doc.id);
      batch.set(newDocRef, product);
      batch.delete(doc.ref);
    }
  });

  await batch.commit();
}

module.exports = {
  cleanProductsCollection,
  copyAndDeleteProducts,
  deleteAllDocumentsInCollection,
  deleteProductsByVendors,
  getAllProducts,
  getProductsByVariant,
  getProductsByVendor,
  getUniqueCannabinoids,
  getUniqueChemicals,
  getUniqueTerpenes,
  saveArticles,
  saveStats,
  saveBatchRecord,
  saveProducts,
  archiveProduct,
  saveAssays,
  getAssays,
  saveTest,
  copyProducts,
  deleteAssaysByVendors,
  getProductsWithTerpenes,
  getTestResults,
  getNextBatchNumber,
  saveBatch,
};

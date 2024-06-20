const { parseFile } = require("./parser");
const config = require("./config");

(async () => {
  try {
    const results = await parseFile(config.inputFile);
    console.log(JSON.stringify(results, null, 2));
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
})();

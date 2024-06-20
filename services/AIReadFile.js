const OpenAI = require("openai");
const fs = require("fs");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * param: file = relative to script "./temp/laps.jpg"
 * return: data:buffer
 */

async function readGraphic() {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `https://cdn11.bigcommerce.com/s-mpabgyqav0/images/stencil/1280x1280/products/312/2455/Indoor_-_THCa_Alien_Apple_Kush_Potency__33040.1690981203.jpg?c=1`,
              },
            },
            {
              type: "text",
              text: "Please list chemicals with quantities greater than zero in this image. Use consistant short names formatted like Δ-8-THC or Δ-9-THCA. Ignore totals.",
            },
          ],
        },
      ],
      functions: assayFunctions,
      function_call: "auto",
    });

    return response.choices[0].message.function_call.arguments;
  } catch (error) {
    console.error("Error reading graphic", error);
  }
}

async function run() {
  const response = await readGraphic();
}

const assayFunctions = [
  {
    name: "saveChemicals",
    description: "Records chemicals to memory.",
    parameters: {
      type: "object",
      properties: {
        chemicals: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Chemical name.",
              },
              pct: {
                type: "number",
                description: "Percentage of chemical to 2 decimal places.",
              },
              line: {
                type: "string",
                description:
                  "The raw line with any misspellings this chemical was extracted from.",
              },
            },
          },
        },
      },
    },
  },
];

// run();

/*

{
                'name': {
                    'type': 'string',
                    'description': 'Chemical name.'
                },
                'pct': {
                    'type': 'number',
                    'description': 'Percentage of chemical to 2 decimal places.'
                },
                'line': {
                    'type': 'string',
                    'description': 'The raw line with any misspellings this chemical was extracted from.'
                }

                */

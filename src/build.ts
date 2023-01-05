import * as AWS from "./modules/aws.js";
import { writeFile } from "node:fs/promises";
import { handler } from "./platform.js";

const FLAGS = {
  SAVE: true,
  UPLOAD: false,
  VERBOSE: false,
} as Record<string, boolean>;

for (const flag of process.argv) {
  if (flag.startsWith("--")) {
    const [key, value] = flag.slice(2).split("=");
    const keyUpper = key.toUpperCase();
    if (keyUpper in FLAGS) {
      FLAGS[keyUpper] = value === "true" ? true : false;
    }
  }
}

if (FLAGS.VERBOSE) {
  process.env.DEBUG = "true";
}

try {
  const data = await handler();

  console.log("Data built successfully with options: ", FLAGS);

  if (FLAGS.UPLOAD) {
    await AWS.uploadToBucket(
      "transparency/transparency.json",
      JSON.stringify(data)
    ).catch((err) => {
      console.log("Error uploading to S3");
      console.error(err);
    });

    console.log("Data uploaded to S3 successfully");
  }

  if (FLAGS.SAVE) {
    await writeFile("transparency.json", JSON.stringify(data)).catch((err) => {
      console.log("Error writing to file");
      console.error(err);
    });

    console.log("Data saved to file successfully");
  }
} catch (err) {
  console.log("Error building transparency data");
  console.error(err);
}

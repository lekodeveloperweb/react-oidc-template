import { defineConfig } from "orval";

// use a local api for development and save a version of `open-api.json` spec locally as version control
let openApiSpec = "<open api json spec>";

if (process.env.NODE_ENV === "production") {
  openApiSpec = "./open-api.json";
}
console.log("openApiSpec", openApiSpec);

export default defineConfig({
  api: {
    input: openApiSpec,
    output: {
      target: "./src/generated/api.ts",
      schemas: "./src/generated/schemas.ts",
      client: "fetch",
      override: {
        fetch: {
          includeHttpResponseReturnType: false,
        },
        mutator: {
          path: "./src/lib/api-client.ts",
          name: "customFetch",
        },
      },
    },
  },
});

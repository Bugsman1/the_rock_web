import { spawnSync } from "node:child_process";

const DEFAULT_SCHEMA_URL = "http://127.0.0.1:8000/api/schema/";
const OUTPUT_PATH = "src/lib/api/schema.d.ts";

const schemaSource = process.env.OPENAPI_SCHEMA_URL ?? DEFAULT_SCHEMA_URL;

console.log(`Generating ${OUTPUT_PATH} from ${schemaSource}`);

const result = spawnSync(
  "npx",
  ["openapi-typescript", schemaSource, "--read-write-markers", "-o", OUTPUT_PATH],
  {
    stdio: "inherit",
    shell: true,
  },
);

process.exit(result.status ?? 1);

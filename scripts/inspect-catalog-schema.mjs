import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv(path) {
  const result = {};

  const content = fs.readFileSync(path, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (
      !line ||
      line.startsWith("#") ||
      !line.includes("=")
    ) {
      continue;
    }

    const index = line.indexOf("=");

    const key = line
      .slice(0, index)
      .trim();

    let value = line
      .slice(index + 1)
      .trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

const env = loadEnv(".env.local");

const url =
  env.NEXT_PUBLIC_SUPABASE_URL;

const key =
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error(
    "Missing Supabase environment variables.",
  );

  process.exit(1);
}

const supabase = createClient(
  url,
  key,
);

const tables = [
  "products",
  "product_variants",
  "product_images",
  "brands",
  "categories",
];

console.log("");
console.log(
  "========================================",
);
console.log(
  " ALAM AL LAYAQA - SCHEMA INSPECTION",
);
console.log(
  "========================================",
);

for (const table of tables) {
  console.log("");
  console.log(`TABLE: ${table}`);
  console.log("--------------------------------");

  const {
    data,
    error,
  } = await supabase
    .from(table)
    .select("*")
    .limit(1);

  if (error) {
    console.log(
      "ERROR:",
      error.message,
    );

    continue;
  }

  if (!data || data.length === 0) {
    console.log(
      "No publicly readable row found.",
    );

    continue;
  }

  console.log(
    "COLUMNS:",
  );

  for (
    const keyName of Object.keys(data[0])
  ) {
    console.log(
      ` - ${keyName}`,
    );
  }

  console.log("");
  console.log(
    "SAMPLE:",
  );

  console.dir(
    data[0],
    {
      depth: null,
    },
  );
}

console.log("");
console.log(
  "========================================",
);
console.log(
  "Inspection finished.",
);
console.log(
  "No data was modified.",
);
console.log(
  "========================================",
);

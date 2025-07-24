import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs";
import YAML from "yaml";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

export const typedEnum = <T extends string>(arr: T[]) =>
  z.enum(arr as [T, ...T[]]);

type Owner = {
  Name: string;
  Package?: string;
  Packages?: string[];
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let ownershipFilePath =
  process.env.BLAME_CONFIG_PATH ?? path.join(__dirname, "owners-example.yaml");
let ownershipFileError = null;
let malformedConfig = null;
let owners: Owner[];
let packages: string[] = [];
try {
  const file = fs.readFileSync(ownershipFilePath, "utf8");
  owners = YAML.parse(file).Owners;
  if (!owners || owners.length === 0) {
    malformedConfig = new Error("Could not find owners in config");
  } else {
    owners.forEach((o) => {
      if (o.Package) packages.push(o.Package);
      if (o.Packages && o.Packages.length > 0) packages.push(...o.Packages);
    });
  }
} catch (err) {
  ownershipFileError = err;
}

console.error("File error: ", ownershipFileError);
console.error("Malformed Config error: ", malformedConfig);
console.error("Found packages: ", packages);

// Create server instance
const server = new McpServer({
  name: "blame",
  version: "1.0.0",
});

server.tool(
  "get-project-owner",
  "Get the owner of a project",
  {
    project: typedEnum(packages).describe("One of the defined projects"),
  },
  async ({ project }: { project: string }) => {
    if (ownershipFileError) {
      console.error("ownershipFileError", ownershipFileError);
      return {
        content: [
          {
            type: "text",
            text: "Failed to read ownership file",
          },
        ],
      };
    }

    const owner = owners.find(
      (o) => o.Package === project || o.Packages?.includes(project),
    );
    if (!owner) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to find the owner of the project",
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `The owner of this project is ${owner.Name}`,
        },
      ],
    };
  },
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Blame MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});

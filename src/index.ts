#!/usr/bin/env node

/**
 * context7 - MCP server providing up-to-date library documentation
 * Fork of upstash/context7
 *
 * Entry point for the CLI and MCP server.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { searchLibraries, getLibraryDocs } from "./api.js";
import { handleOrphanExit } from "./utils/orphan-exit.js";

const server = new McpServer({
  name: "context7",
  version: "1.0.0",
  description:
    "Provides up-to-date documentation and code examples for popular libraries and frameworks.",
});

/**
 * Tool: resolve-library-id
 * Searches for a library by name and returns the best matching Context7-compatible library ID.
 */
server.tool(
  "resolve-library-id",
  "Resolves a package/library name to a Context7-compatible library ID. Use this before calling get-library-docs.",
  {
    libraryName: z
      .string()
      .describe(
        "The name of the library or package to search for (e.g., 'react', 'lodash', 'express')"
      ),
  },
  async ({ libraryName }) => {
    try {
      const results = await searchLibraries(libraryName);

      if (!results || results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No libraries found matching "${libraryName}". Try a different search term.`,
            },
          ],
        };
      }

      const formatted = results
        .slice(0, 5)
        .map(
          (lib, i) =>
            `${i + 1}. **${lib.name}** (ID: \`${lib.id}\`)\n   ${lib.description || "No description available."}\n   Trust Score: ${lib.trustScore ?? "N/A"} | Snippets: ${lib.totalSnippets ?? "N/A"}`
        )
        .join("\n\n");

      return {
        content: [
          {
            type: "text",
            text: `Found ${results.length} result(s) for "${libraryName}":\n\n${formatted}`,
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Error searching for library: ${message}` }],
        isError: true,
      };
    }
  }
);

/**
 * Tool: get-library-docs
 * Fetches documentation and code examples for a specific library using its Context7 ID.
 */
server.tool(
  "get-library-docs",
  "Fetches up-to-date documentation and code examples for a library. Requires a valid Context7 library ID (use resolve-library-id first).",
  {
    libraryId: z
      .string()
      .describe("The Context7-compatible library ID (e.g., '/reactjs/react.dev')"),
    topic: z
      .string()
      .optional()
      .describe("Optional topic to focus the documentation on (e.g., 'hooks', 'routing')"),
    tokens: z
      .number()
      .optional()
      .default(5000)
      .describe("Maximum number of tokens to return (default: 5000)"),
  },
  async ({ libraryId, topic, tokens }) => {
    try {
      const docs = await getLibraryDocs(libraryId, { topic, tokens });

      if (!docs || docs.trim().length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No documentation found for library ID "${libraryId}"${topic ? ` with topic "${topic}"` : ""}. Try a different library ID or topic.`,
            },
          ],
        };
      }

      return {
        content: [{ type: "text", text: docs }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Error fetching library docs: ${message}` }],
        isError: true,
      };
    }
  }
);

async function main() {
  // Handle orphan process exit (when parent process dies)
  handleOrphanExit();

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr so it doesn't interfere with MCP stdio communication
  console.error("context7 MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error starting context7 MCP server:", error);
  process.exit(1);
});

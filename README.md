# Apple HIG MCP Server

[![npm version](https://img.shields.io/npm/v/@amo643/apple-hig-mcp.svg)](https://www.npmjs.com/package/@amo643/apple-hig-mcp)
[![npm downloads](https://img.shields.io/npm/dm/@amo643/apple-hig-mcp.svg)](https://www.npmjs.com/package/@amo643/apple-hig-mcp)
[![Smithery](https://smithery.ai/badge/@amo643/apple-hig-mcp)](https://smithery.ai/server/@amo643/apple-hig-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Model Context Protocol (MCP) server providing LLMs direct access to Apple's Human Interface Guidelines (HIG) via live `developer.apple.com` Markdown endpoints.

## Features

- **Live Endpoints:** Fetches `.md` documents directly from Apple Developer CDN on demand.
- **Local Cache:** In-memory and disk cache (`~/.cache/apple-hig-mcp`) with 24-hour TTL.
- **Coverage:** 160+ topics spanning Foundations, Components, Patterns, Inputs, Technologies, and Platforms (iOS, macOS, visionOS, watchOS, tvOS).
- **Design Guidance:** Built-in heuristics for Liquid Glass layering, 44pt touch targets, continuous curvature (squircle), button hierarchies, and spring physics.
- **6 Tools:** Search, full topic retrieval, category listings, redesign checklists, and official asset links (Figma, SF Symbols).

## Tools

| Tool | Description |
|------|-------------|
| `search_hig` | Search 160+ topics, titles, descriptions, and synonyms (`liquid glass`, `buttons`, `haptics`). |
| `get_guideline` | Retrieve live Markdown documentation for any topic (`materials`, `buttons`, `color`, etc.). |
| `list_categories` | List main HIG categories and topic counts. |
| `list_topics` | List topics within a category with summaries. |
| `get_redesign_checklist` | Generate actionable HIG redesign & polish checklist (iOS, macOS, visionOS). |
| `get_design_resources` | Official links for Apple Figma kits, SF Symbols, and design templates. |

## Installation & Setup

### Method 1: Zero-Install via npx (Recommended)
Add directly to your MCP client configuration (`claude_desktop_config.json`, Antigravity `mcp_config.json`, or Cursor):

```json
{
  "mcpServers": {
    "apple-hig": {
      "command": "npx",
      "args": ["-y", "@amo643/apple-hig-mcp"]
    }
  }
}
```

Or install via Claude Code CLI in one command:
```bash
claude mcp add apple-hig -- npx -y @amo643/apple-hig-mcp
```

Or install via Smithery CLI:
```bash
npx -y @smithery/cli install @amo643/apple-hig-mcp --client claude
```

### Method 2: Global Install
```bash
npm install -g @amo643/apple-hig-mcp
```

Then reference the binary directly:
```json
{
  "mcpServers": {
    "apple-hig": {
      "command": "apple-hig-mcp"
    }
  }
}
```

### Method 3: From Source
```bash
git clone https://github.com/Amo643/apple-hig-mcp.git
cd apple-hig-mcp
npm install
npm run build
```

## Testing

```bash
node test.js
node test-mcp-stdio.js
```

## License

MIT

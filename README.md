# Apple HIG MCP Server

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

## Quick Start

### Build
```bash
npm install
npm run build
```

### MCP Configuration
Add to `claude_desktop_config.json` or Antigravity MCP settings:

```json
{
  "mcpServers": {
    "apple-hig": {
      "command": "node",
      "args": ["/Users/abi/Documents/antigravity/intelligent-tesla/apple-hig-mcp/dist/index.js"]
    }
  }
}
```

## Testing

```bash
node test.js
node test-mcp-stdio.js
```

## License

MIT

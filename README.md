# 🍏 Apple HIG MCP Server

A real-time, zero-stale Model Context Protocol (MCP) server providing AI assistants direct access to Apple's official **Human Interface Guidelines (HIG)** directly from `developer.apple.com`.

## ✨ Features

- **🔴 100% Live & Auto-Updating:** Fetches Apple's native `.md` endpoints directly from Apple Developer CDN. Zero hardcoded text, zero stale scrapes.
- **⚡ Smart Caching:** Fast response times via local disk (`~/.cache/apple-hig-mcp`) and in-memory cache with 24h TTL.
- **🔍 Full HIG Coverage (160+ Topics):** Comprehensive indexing across Foundations, Components, Patterns, Inputs, Technologies, and Platforms (iOS, macOS, visionOS, watchOS, tvOS).
- **🎨 Liquid Glass & Redesign Insights:** Direct extraction of modern Apple design rules (Liquid Glass dual-layering, 44pt touch targets, continuous curvature squircle, style-over-size button hierarchies, spring animations).
- **🛠️ 6 Specialized Tools:** Search, full guideline retrieval, redesign checklists, and official design resources (Figma kits, SF Symbols).

---

## 🛠️ MCP Tools

| Tool | Description |
|------|-------------|
| `search_hig` | Search across all 160+ Apple HIG topics, titles, descriptions, and smart synonyms (e.g. "liquid glass", "buttons", "haptics"). |
| `get_guideline` | Fetch complete live Markdown documentation for any topic (`materials`, `buttons`, `color`, `dark-mode`, `layout`, etc.). |
| `list_categories` | List all main Apple HIG categories and topic counts. |
| `list_topics` | List topics within a specific category with summaries and slugs. |
| `get_redesign_checklist` | Generate Apple's official checklist for redesigning and polishing apps (iOS, macOS, visionOS). |
| `get_design_resources` | Direct links to official Apple Figma kits, Sketch libraries, SF Symbols, and icon templates. |

---

## 🚀 Setup & Configuration

### Build
```bash
cd apple-hig-mcp
npm install
npm run build
```

### Configuration for Antigravity & Claude Desktop
Add to your `mcp_config.json` or `claude_desktop_config.json`:

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

---

## 🧪 Verification

Run test suite:
```bash
node test.js
node test-mcp-stdio.js
```

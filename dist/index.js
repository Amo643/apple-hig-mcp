#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { AppleHigClient } from './apple-client.js';
const client = new AppleHigClient();
const TOOLS = [
    {
        name: 'search_hig',
        description: 'Search across Apple Human Interface Guidelines topics, titles, descriptions, and categories in real-time.',
        inputSchema: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'The search query or keyword (e.g. "liquid glass", "buttons", "dark mode", "hit target", "typography").'
                },
                category: {
                    type: 'string',
                    description: 'Optional category filter (e.g. "Foundations", "Components", "Platforms", "Patterns", "Inputs").'
                }
            },
            required: ['query']
        }
    },
    {
        name: 'get_guideline',
        description: 'Fetch the complete, live Markdown content of any Apple HIG topic directly from developer.apple.com.',
        inputSchema: {
            type: 'object',
            properties: {
                topic: {
                    type: 'string',
                    description: 'The topic slug, name, or keyword (e.g. "materials", "buttons", "color", "dark-mode", "layout", "typography", "designing-for-macos", "accessibility").'
                }
            },
            required: ['topic']
        }
    },
    {
        name: 'list_categories',
        description: 'List all top-level categories in Apple Human Interface Guidelines with topic counts.',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'list_topics',
        description: 'List all topics within a specific category with their titles, slugs, and summaries.',
        inputSchema: {
            type: 'object',
            properties: {
                category: {
                    type: 'string',
                    description: 'Optional category name to filter by (e.g. "Foundations", "Components", "Patterns", "Platforms"). If omitted, lists all indexed topics.'
                }
            }
        }
    },
    {
        name: 'get_redesign_checklist',
        description: 'Generate an actionable Apple HIG checklist for redesigning and polishing apps to feel native and refined.',
        inputSchema: {
            type: 'object',
            properties: {
                platform: {
                    type: 'string',
                    enum: ['ios', 'macos', 'visionos', 'all'],
                    description: 'Target platform for the checklist (default: "all").'
                }
            }
        }
    },
    {
        name: 'get_design_resources',
        description: 'Get direct download and official links to Apple Design Resources (Figma kits, SF Symbols, app icon templates, device bezels).',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    }
];
const server = new Server({
    name: 'apple-hig-mcp',
    version: '1.0.0'
}, {
    capabilities: {
        tools: {}
    }
});
// Register tools list handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
});
// Register tool execution handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    try {
        switch (name) {
            case 'search_hig': {
                const query = String(args.query || '');
                const category = args.category ? String(args.category) : undefined;
                const results = await client.search(query, category);
                if (results.length === 0) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `No Apple HIG topics matched query "${query}". Try related keywords like "materials", "buttons", "color", "layout", "typography".`
                            }
                        ]
                    };
                }
                const formatted = results
                    .map((r, i) => `${i + 1}. **${r.title}** (\`${r.slug}\`)\n   - Category: ${r.category}\n   - Summary: ${r.summary}\n   - URL: ${r.url}`)
                    .join('\n\n');
                return {
                    content: [
                        {
                            type: 'text',
                            text: `### Found ${results.length} Apple HIG topics for "${query}":\n\n${formatted}\n\n*Use \`get_guideline(topic: "slug")\` to retrieve full documentation.*`
                        }
                    ]
                };
            }
            case 'get_guideline': {
                const topic = String(args.topic || '');
                const doc = await client.getGuideline(topic);
                let output = `# ${doc.title}\n\n`;
                output += `> **Source:** [${doc.url}](${doc.url})\n`;
                if (doc.category)
                    output += `> **Category:** ${doc.category}\n\n`;
                output += doc.content;
                return {
                    content: [
                        {
                            type: 'text',
                            text: output
                        }
                    ]
                };
            }
            case 'list_categories': {
                const categories = await client.listCategories();
                const formatted = categories
                    .map((c) => `- **${c.category}**: ${c.count} topic(s)`)
                    .join('\n');
                return {
                    content: [
                        {
                            type: 'text',
                            text: `### Apple HIG Main Categories\n\n${formatted}\n\n*Use \`list_topics(category: "...")\` to view topics in each category.*`
                        }
                    ]
                };
            }
            case 'list_topics': {
                const category = args.category ? String(args.category) : undefined;
                const topics = await client.listTopics(category);
                const formatted = topics
                    .map((t) => `- **${t.title}** (\`${t.slug}\`) [${t.category}]: ${t.summary || 'Guidelines and best practices.'}`)
                    .join('\n');
                return {
                    content: [
                        {
                            type: 'text',
                            text: `### Apple HIG Topics${category ? ` in "${category}"` : ''} (${topics.length} items):\n\n${formatted}`
                        }
                    ]
                };
            }
            case 'get_redesign_checklist': {
                const platform = String(args.platform || 'all').toLowerCase();
                const checklist = buildRedesignChecklist(platform);
                return {
                    content: [
                        {
                            type: 'text',
                            text: checklist
                        }
                    ]
                };
            }
            case 'get_design_resources': {
                const resources = `### Apple Official Design Resources & Kits

Official links directly from Apple Developer:

1. **Apple Design Resources (Figma & Sketch):**
   - iOS & iPadOS Design Kit: https://developer.apple.com/design/resources/
   - macOS Design Kit: https://developer.apple.com/design/resources/
   - visionOS Design Kit: https://developer.apple.com/design/resources/
   - watchOS Design Kit: https://developer.apple.com/design/resources/

2. **Typography & Iconography:**
   - **SF Symbols 6+** (over 6,000 configurable vector symbols): https://developer.apple.com/sf-symbols/
   - **San Francisco Fonts** (SF Pro, SF Compact, SF Mono, New York): https://developer.apple.com/fonts/

3. **Human Interface Guidelines Web Hub:**
   - Main HIG Portal: https://developer.apple.com/design/human-interface-guidelines
   - What's New in Design: https://developer.apple.com/design/whats-new/
   - WWDC Design Sessions: https://developer.apple.com/videos/design/`;
                return {
                    content: [
                        {
                            type: 'text',
                            text: resources
                        }
                    ]
                };
            }
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return {
            isError: true,
            content: [
                {
                    type: 'text',
                    text: `Error executing Apple HIG tool '${name}': ${errorMsg}`
                }
            ]
        };
    }
});
function buildRedesignChecklist(platform) {
    return `### Apple HIG Master Redesign & App Polish Checklist (${platform.toUpperCase()})

#### 1. Layering & Materials (Content vs Navigation)
- [ ] **Dual-Layer Architecture:** Content layer stays opaque/solid (Standard Materials); navigation/controls float above in **Liquid Glass**.
- [ ] **Never Glass in Content:** Avoid Liquid Glass inside lists, cards, or background content cells.
- [ ] **Adaptive Translucency:** Regular variant for sidebars/alerts; Clear variant (with 35% dimming if bright) for floating media controls.
- [ ] **Specular Edge:** 0.5px white highlight stroke (\`rgba(255,255,255,0.2)\`) mimicking physical light refraction on glass edges.
- [ ] **Saturation Boost:** Pair blur with saturation boost (\`backdrop-filter: blur(24px) saturate(180%)\`) so colors underneath do not look muddy.

#### 2. Geometry & Optical Polish
- [ ] **Continuous Curvature (Squircle):** Use smooth G2 curvature (\`corner-smoothing: 60%\` or superellipse) instead of standard circular radii to avoid harsh light discontinuities.
- [ ] **Subtle Layered Elevation:** Replace heavy single drop-shadows with multi-layered, low-opacity ambient shadows (\`rgba(0,0,0,0.06)\` blur 8px + \`rgba(0,0,0,0.04)\` blur 24px).
- [ ] **Optical Centering:** Center icons and glyphs by visual mass/weight rather than geometric bounding box (e.g. nudging play buttons right).

#### 3. Buttons & Action Hierarchy
- [ ] **Style Over Size:** Keep adjacent buttons the same dimensions; distinguish importance strictly through 4 visual styles:
  1. *Prominent* (Filled with accent color, strictly 1-2 per view).
  2. *Tinted / Glass* (Liquid Glass capsule for secondary actions).
  3. *Gray / Neutral* (Subtle system background for standard items).
  4. *Borderless* (Text or symbol for low-priority actions).
- [ ] **Hit Target Minimum:** At least 44x44 pt on iOS/macOS, 60x60 pt on visionOS.
- [ ] **Mandatory Press State:** Every custom button must display an active pressed state (e.g. scale down to 0.97 + haptic tick).
- [ ] **Semantic Roles:** Destructive actions must trigger warning state/confirmation sheet.

#### 4. Motion & Tactility
- [ ] **Spring Physics:** No linear or generic ease animations. Use damped spring physics (\`response: 0.35s\`, \`damping: 0.8\`).
- [ ] **Fluid Haptics:** Integrate subtle tactile feedback (\`UIImpactFeedbackGenerator\`) on significant state toggles and releases.
- [ ] **Progressive Disclosure:** Reveal complex UI only when needed (popovers, sheets, drawers) rather than cluttering initial view.

#### 5. Typography & Contrast Adaptivity
- [ ] **SF Pro Hierarchy:** Standardize on Large Title, Title, Headline, Body, Caption with Dynamic Type support.
- [ ] **Semantic Colors:** Never hardcode hex colors for surfaces or text. Use semantic tokens (\`label\`, \`secondaryLabel\`, \`systemBackground\`, \`secondarySystemBackground\`).
- [ ] **High Contrast & Dark Mode:** Verify elements retain minimum 4.5:1 contrast in both light mode, dark mode, and "Increase Contrast" accessibility mode.`;
}
// Start stdio transport
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Apple HIG MCP server running on stdio');
}
main().catch((err) => {
    console.error('Fatal error in Apple HIG MCP server:', err);
    process.exit(1);
});

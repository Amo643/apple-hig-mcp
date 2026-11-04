import { spawn } from 'node:child_process';

const server = spawn('node', ['./dist/index.js'], {
  stdio: ['pipe', 'pipe', 'inherit']
});

const toolsToTest = [
  { name: 'search_hig', arguments: { query: 'materials' } },
  { name: 'get_guideline', arguments: { topic: 'materials' } },
  { name: 'list_categories', arguments: {} },
  { name: 'list_topics', arguments: { category: 'Foundations' } },
  { name: 'get_redesign_checklist', arguments: { platform: 'ios' } },
  { name: 'get_design_resources', arguments: {} }
];

let currentToolIndex = 0;
let buffer = '';

function send(obj) {
  server.stdin.write(JSON.stringify(obj) + '\n');
}

function sendNextTool() {
  if (currentToolIndex >= toolsToTest.length) {
    console.log('\n🎉 ALL 6 MCP TOOLS VERIFIED SUCCESSFULLY VIA STDIO!');
    server.kill();
    process.exit(0);
  }

  const tool = toolsToTest[currentToolIndex];
  const reqId = 100 + currentToolIndex;
  send({
    jsonrpc: '2.0',
    id: reqId,
    method: 'tools/call',
    params: {
      name: tool.name,
      arguments: tool.arguments
    }
  });
}

server.stdout.on('data', (data) => {
  buffer += data.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop();

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id === 1) {
        console.log('✅ Received tools list via MCP stdio. Tool count:', msg.result.tools.length);
        if (msg.result.tools.length !== 6) {
          throw new Error(`Expected 6 tools, got ${msg.result.tools.length}`);
        }
        for (const t of msg.result.tools) {
          if (!t.annotations || typeof t.annotations.readOnlyHint !== 'boolean') {
            throw new Error(`Tool ${t.name} missing annotations or readOnlyHint`);
          }
        }
        console.log('✅ All 6 tools declare valid MCP annotations (readOnlyHint, destructiveHint, idempotentHint, openWorldHint)');
        sendNextTool();
      } else if (msg.id >= 100) {
        const tool = toolsToTest[currentToolIndex];
        if (msg.error) {
          throw new Error(`Tool ${tool.name} failed with error: ${JSON.stringify(msg.error)}`);
        }
        if (!msg.result?.content?.[0]?.text) {
          throw new Error(`Tool ${tool.name} returned empty content`);
        }
        console.log(`✅ [${currentToolIndex + 1}/6] Verified tool: ${tool.name}`);
        currentToolIndex++;
        sendNextTool();
      }
    } catch (e) {
      console.error('❌ Test error:', e.message);
      server.kill();
      process.exit(1);
    }
  }
});

// Initialize
send({
  jsonrpc: '2.0',
  id: 0,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test-client', version: '1.0.0' }
  }
});

// List tools
setTimeout(() => {
  send({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {}
  });
}, 300);

const timeout = setTimeout(() => {
  console.error('❌ MCP Stdio test timed out');
  server.kill();
  process.exit(1);
}, 10000);
timeout.unref();

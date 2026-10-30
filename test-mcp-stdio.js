import { spawn } from 'node:child_process';

const server = spawn('node', ['./dist/index.js'], {
  stdio: ['pipe', 'pipe', 'inherit']
});

let buffer = '';

server.stdout.on('data', (data) => {
  buffer += data.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop(); // keep last incomplete

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id === 1) {
        console.log('✅ Received tools list via MCP stdio. Tool count:', msg.result.tools.length);
        // Call search_hig
        const callReq = {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'search_hig',
            arguments: { query: 'liquid glass' }
          }
        };
        server.stdin.write(JSON.stringify(callReq) + '\n');
      } else if (msg.id === 2) {
        console.log('✅ Received tool execution result for search_hig:');
        console.log(msg.result.content[0].text.slice(0, 150) + '...');
        server.kill();
        process.exit(0);
      }
    } catch (e) {
      // not json or partial
    }
  }
});

// Send initialize request
const initReq = {
  jsonrpc: '2.0',
  id: 0,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test-client', version: '1.0.0' }
  }
};

server.stdin.write(JSON.stringify(initReq) + '\n');

// Send list tools request
setTimeout(() => {
  const listReq = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {}
  };
  server.stdin.write(JSON.stringify(listReq) + '\n');
}, 500);

setTimeout(() => {
  console.error('❌ MCP Stdio test timed out');
  server.kill();
  process.exit(1);
}, 5000);

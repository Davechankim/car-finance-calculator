#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createTaxLawMcpServer } from './server';

const MAX_MCP_INPUT_BYTES = 1_048_576;

async function main(): Promise<void> {
  const server = createTaxLawMcpServer();
  const transport = new StdioServerTransport(
    process.stdin,
    process.stdout,
    { maxBufferSize: MAX_MCP_INPUT_BYTES },
  );

  await server.connect(transport);
}

main().catch(() => {
  // stdout is reserved for MCP JSON-RPC messages. Never print credential-bearing
  // exception details, request URLs, or upstream response bodies.
  console.error('읽기 전용 세금·법령 MCP 서버를 시작하지 못했습니다.');
  process.exitCode = 1;
});

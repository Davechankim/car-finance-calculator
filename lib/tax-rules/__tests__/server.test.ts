import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it } from 'vitest';

import { APPROVED_TAX_RULE_ID } from '../snapshot';
import {
  READ_ONLY_TOOL_NAMES,
  SERVER_INSTRUCTIONS,
  createTaxLawMcpServer,
} from '../../../mcp/server';

const clients: Client[] = [];
const servers: ReturnType<typeof createTaxLawMcpServer>[] = [];

async function connectedClient(): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createTaxLawMcpServer({ env: {} });
  const client = new Client({ name: 'tax-law-mcp-test', version: '0.1.0' });
  servers.push(server);
  clients.push(client);
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return client;
}

afterEach(async () => {
  await Promise.allSettled(clients.splice(0).map((client) => client.close()));
  await Promise.allSettled(servers.splice(0).map((server) => server.close()));
});

describe('read-only tax law MCP server', () => {
  it('정확히 네 개의 읽기 전용 도구만 공개하고 승인/쓰기 도구는 두지 않는다', async () => {
    const client = await connectedClient();
    const listed = await client.listTools();
    const names = listed.tools.map((tool) => tool.name);

    expect(client.getInstructions()).toBe(SERVER_INSTRUCTIONS);
    expect(SERVER_INSTRUCTIONS.length).toBeLessThanOrEqual(512);
    expect(names).toEqual([...READ_ONLY_TOOL_NAMES]);
    expect(names.some((name) => (
      /(^|_)(approve|write|create|update|delete|submit|pay)(_|$)/i.test(name)
    ))).toBe(false);
    for (const tool of listed.tools) {
      expect(tool.annotations?.readOnlyHint).toBe(true);
      expect(tool.annotations?.destructiveHint).toBe(false);
      expect(tool.annotations?.idempotentHint).toBe(true);
    }
    expect(listed.tools[0].annotations?.openWorldHint).toBe(false);
    expect(listed.tools.slice(1).every(
      (tool) => tool.annotations?.openWorldHint === true,
    )).toBe(true);
    expect(
      listed.tools.find((tool) => tool.name === 'review_law_article_changes')
        ?.inputSchema.properties,
    ).not.toHaveProperty('sinceDate');
  });

  it('승인된 불변 스냅샷을 MCP structuredContent로 조회한다', async () => {
    const client = await connectedClient();
    const response = await client.callTool({
      name: 'get_approved_tax_rule_snapshot',
      arguments: {
        ruleSetId: APPROVED_TAX_RULE_ID,
        asOfDate: '2026-07-28',
      },
    });

    expect(response.isError).not.toBe(true);
    const structured = response.structuredContent as {
      snapshot: {
        id: string;
        status: string;
        effectiveFrom: string;
        sourceUrl: string;
      };
    };
    expect(structured.snapshot).toMatchObject({
      id: APPROVED_TAX_RULE_ID,
      status: 'approved',
      effectiveFrom: '2026-01-01',
    });
    expect(structured.snapshot.sourceUrl).toMatch(/^https:\/\/www\.law\.go\.kr/);
  });

  it('공식 조회 도구에 OC가 없으면 비밀 없는 MCP 오류로 종료한다', async () => {
    const client = await connectedClient();
    const response = await client.callTool({
      name: 'get_official_law_article',
      arguments: { lawName: '소득세법', article: '127' },
    });

    expect(response.isError).toBe(true);
    expect(response.content).toEqual([
      expect.objectContaining({
        type: 'text',
        text: expect.stringContaining('LAW_OPEN_API_OC'),
      }),
    ]);
  });
});

import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  StdioClientTransport,
  getDefaultEnvironment,
} from '@modelcontextprotocol/sdk/client/stdio.js';

import { APPROVED_TAX_RULE_ID } from '../lib/tax-rules/snapshot';
import { READ_ONLY_TOOL_NAMES } from '../mcp/server';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const codexConfig = await readFile(
  new URL('../.codex/config.toml', import.meta.url),
  'utf8',
);
assert.match(codexConfig, /\[mcp_servers\.kr_tax_law\]/);
assert.match(codexConfig, /command = "node"/);
assert.match(codexConfig, /args = \["--import", "tsx", "mcp\/stdio\.ts"\]/);
assert.match(codexConfig, /env_vars = \["LAW_OPEN_API_OC"\]/);
for (const toolName of READ_ONLY_TOOL_NAMES) {
  assert.ok(
    codexConfig.includes(`"${toolName}"`),
    `Codex MCP 설정에 허용 도구가 없습니다: ${toolName}`,
  );
}
const liveCheck = process.argv.includes('--live');
const credential = process.env.LAW_OPEN_API_OC?.trim();
if (liveCheck) {
  assert.ok(
    credential,
    '실공식 API 확인에는 LAW_OPEN_API_OC 환경변수가 필요합니다.',
  );
}
const childEnvironment = getDefaultEnvironment();
if (credential) childEnvironment.LAW_OPEN_API_OC = credential;

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ['--import', 'tsx', 'mcp/stdio.ts'],
  cwd: projectRoot,
  env: childEnvironment,
  stderr: 'pipe',
  maxBufferSize: 1_048_576,
});
const client = new Client({
  name: 'kr-car-finance-tax-law-smoke',
  version: '0.1.0',
});

try {
  await client.connect(transport);

  const listed = await client.listTools();
  assert.deepEqual(
    listed.tools.map((tool) => tool.name),
    [...READ_ONLY_TOOL_NAMES],
  );

  const result = await client.callTool({
    name: 'get_approved_tax_rule_snapshot',
    arguments: {
      ruleSetId: APPROVED_TAX_RULE_ID,
      asOfDate: '2026-07-28',
    },
  });
  assert.notEqual(result.isError, true);
  assert.equal(
    (result.structuredContent as { snapshot?: { id?: string } } | undefined)
      ?.snapshot?.id,
    APPROVED_TAX_RULE_ID,
  );

  if (liveCheck) {
    const official = await client.callTool({
      name: 'get_official_law_article',
      arguments: {
        lawName: '지방세법',
        article: '127',
      },
    });
    if (official.isError === true) {
      const content = Array.isArray(official.content) ? official.content : [];
      const safeMessage = content.find(
        (item): item is { type: 'text'; text: string } =>
          typeof item === 'object' &&
          item !== null &&
          'type' in item &&
          item.type === 'text' &&
          'text' in item &&
          typeof item.text === 'string',
      )?.text ?? '알 수 없는 안전 오류';
      throw new Error(`공식 법령 실조회 실패: ${safeMessage}`);
    }
    assert.equal(
      (official.structuredContent as {
        result?: { lawName?: string; article?: string; source?: { target?: string } };
      } | undefined)?.result?.lawName,
      '지방세법',
    );
    assert.equal(
      (official.structuredContent as {
        result?: { article?: string };
      } | undefined)?.result?.article,
      '012700',
    );
  }

  process.stdout.write(
    [
      `MCP stdio 연결 확인: ${listed.tools.length}개 읽기 전용 도구`,
      `규칙 ${APPROVED_TAX_RULE_ID}`,
      liveCheck ? '공식 지방세법 제127조 실조회 확인' : null,
    ].filter(Boolean).join(', ') + '\n',
  );
} finally {
  await client.close();
}

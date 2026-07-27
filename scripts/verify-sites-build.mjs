import { access, readFile } from 'node:fs/promises';

const requiredFiles = [
  'dist/server/index.js',
  'dist/.openai/hosting.json',
];

for (const file of requiredFiles) {
  try {
    await access(file);
  } catch {
    throw new Error(`Sites 배포 산출물이 없습니다: ${file}`);
  }
}

const parseJson = async (file) => {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    throw new Error(`올바른 JSON 파일이 아닙니다: ${file}`);
  }
};

const sourceConfig = await parseJson('.openai/hosting.json');
const builtConfig = await parseJson('dist/.openai/hosting.json');
const allowedKeys = new Set(['project_id', 'd1', 'r2']);
const unexpectedKeys = Object.keys(sourceConfig).filter((key) => !allowedKeys.has(key));

if (
  typeof sourceConfig.project_id !== 'string' ||
  sourceConfig.project_id.trim() === ''
) {
  throw new Error('.openai/hosting.json에 project_id가 필요합니다.');
}

if (unexpectedKeys.length > 0) {
  throw new Error(
    `.openai/hosting.json에 허용되지 않은 키가 있습니다: ${unexpectedKeys.join(', ')}`,
  );
}

if (JSON.stringify(sourceConfig) !== JSON.stringify(builtConfig)) {
  throw new Error('빌드 산출물의 Sites 설정이 소스 설정과 일치하지 않습니다.');
}

console.log('Sites 배포 산출물 검증 완료');

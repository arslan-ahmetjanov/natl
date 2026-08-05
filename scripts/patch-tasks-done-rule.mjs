import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = 'c:/Users/arsla/Desktop/natl';
const agentsPath = join(root, 'AGENTS.md');
let t = readFileSync(agentsPath, 'utf8');

t = t.replace(
  '3. Статус задачи: `todo` → `doing` → `done` (или `blocked` с причиной).\n4. Не расширять скоуп за «Не входит».\n5. Отвечать пользователю на языке запроса (сейчас — русский, если не сказано иначе).\n6. Секреты',
  '3. Статус задачи: `todo` → `doing` → `done` (или `blocked` с причиной).\n4. Когда задача закрыта (`done`, критерии выполнены): **удалить** файл задачи из `tasks/` и строку из `tasks/README.md` (`ROADMAP.md` / обзорные файлы не удалять).\n5. Не расширять скоуп за «Не входит».\n6. Отвечать пользователю на языке запроса (сейчас — русский, если не сказано иначе).\n7. Секреты',
);

if (!t.includes('удалить** файл задачи')) {
  console.error('process step replace failed');
  process.exit(1);
}

t = t.replace(
  '- [ ] Статус задачи: `done`\n- [ ] Нет секретов в diff',
  '- [ ] Статус задачи: `done`\n- [ ] Файл задачи удалён из `tasks/`; индекс в `tasks/README.md` обновлён\n- [ ] Нет секретов в diff',
);

t = t.replace(
  '- Обновляет статус задачи и при необходимости `tasks/README.md`.',
  '- После полного закрытия: удаляет файл задачи из `tasks/` и строку из `tasks/README.md` (если ещё не удалили).',
);

writeFileSync(agentsPath, t);
console.log('AGENTS.md patched');

const done = [
  '13-agent-tree-sitter.md',
  '14-agent-llm-gateway.md',
  '15-agent-validate-publish.md',
  '16-agent-packaging.md',
];
for (const f of done) {
  const p = join(root, 'tasks', f);
  if (existsSync(p)) {
    unlinkSync(p);
    console.log('deleted', f);
  }
}

const readme = `# NATL — локальные задачи (prod path)

Папка **gitignored** (см. корневой \`.gitignore\`). Живёт только у разработчика / агента; в npm и remote не попадает.

## Как работать

1. Открыть задачу \`NN-*.md\` целиком.
2. Роли: **Аналитик** → **Разработчик** → **Тестер** → **DevOps** (см. \`AGENTS.md\` / \`.cursor/rules/\`).
3. Статус в шапке файла: \`todo\` → \`doing\` → \`done\` (или \`blocked\` + причина).
4. Когда задача **закрыта** (\`done\`): **удалить** файл из \`tasks/\` и строку из этой таблицы (\`ROADMAP.md\` не удалять).
5. Не расширять скоуп за «Не входит».
6. Порядок API: **core → adapter → cli**; publish — DevOps после Тестера.

## Индекс

Закрытые задачи удаляются из папки (волны A–E и agent MVP \`13\`–\`16\` уже сняты). Активные:

| ID | Файл | Волна | Статус |
|----|------|-------|--------|
| 17 | [17-agent-npm-publish.md](./17-agent-npm-publish.md) | post-MVP | \`todo\` |
| 18 | [18-agent-self-healing.md](./18-agent-self-healing.md) | post-MVP | \`todo\` |
| 19 | [19-agent-gitlab-jenkins.md](./19-agent-gitlab-jenkins.md) | post-MVP | \`todo\` |
| 20 | [20-agent-live-llm-eval.md](./20-agent-live-llm-eval.md) | post-MVP | \`todo\` |

Обновляй таблицу при создании задач; при закрытии — удаляй файл и строку.

## Agent release checks

- Локальная tiny-модель (gitignored runtime): \`node scripts/local-llm/setup.mjs\` → \`cd local-llm && npm start\`
- Пре-релизный suite: [\`tests/agent-release/\`](../tests/agent-release/) (\`pnpm test\`, \`pnpm eval-gate\`, \`pnpm test:live\`)
`;

writeFileSync(join(root, 'tasks', 'README.md'), readme);
console.log('tasks/README.md updated');

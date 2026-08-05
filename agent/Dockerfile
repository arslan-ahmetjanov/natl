# Build from agent/ directory:
#   docker build -t natl-agent .
# Run (OpenAI):
#   docker run --rm -e LLM_API_KEY -e OPENAI_MODEL -v "$PWD:/work" -w /work natl-agent --mode stdout
# Run (Ollama on host):
#   docker run --rm --network host -e NATL_AGENT_PROVIDER=ollama \
#     -e OPENAI_BASE_URL=http://127.0.0.1:11434/v1 -v "$PWD:/work" -w /work natl-agent --mode stdout

FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json ./
COPY tsconfig.json ./
COPY src ./src
COPY examples ./examples
COPY action.yml LICENSE README.md ./

RUN npm install --ignore-scripts \
  && npx tsc -p tsconfig.json \
  && npm prune --omit=dev \
  && npm cache clean --force

# Non-root
USER node

ENTRYPOINT ["node", "/app/dist/cli.js"]
CMD ["--help"]

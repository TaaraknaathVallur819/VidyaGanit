---
name: Socratic Chat Architecture
description: How the Socratic tutor chat is built — rule-based engine, SSE streaming route, and frontend component
---

## Rule-based tutor engine
`artifacts/api-server/src/lib/tutor.ts` — no API key needed. Detects math topic by regex, has hint banks per topic × class level. To swap in OpenAI later, replace `generateSocraticResponse()` with a streaming OpenAI call.

**Why:** User declined Replit AI Integrations upgrade and didn't have an OpenAI key at build time.

**How to apply:** If user later provides OPENAI_API_KEY, run the AI integrations setup and replace the `generateSocraticResponse` call in `chat.ts` with a streaming chat.completions call using a Socratic system prompt.

## SSE streaming endpoint
`POST /api/chat/message` — body: `{ vidyaId, message, history[] }`. Streams words 22ms apart. Orval cannot type SSE responses; frontend uses native fetch + ReadableStream.

## Frontend component
`artifacts/vidya-ganit/src/components/SocraticChat.tsx` — manages messages state, history state, streaming accumulation. Student Workspace tab defaults to this view (defaultValue="workspace").

import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';

export const runtime = 'nodejs';

const inputSchema = z.object({
  productName: z.string().max(100).optional().default(''),
  idea: z.string().min(10).max(10000),
  template: z.string().max(100),
  mode: z.enum(['Quick Draft','Standard','Detailed'])
});

const prompts = {
  'Quick Draft': 'Be concise. Cover only the essential product, users, goals, functional requirements, non-functional requirements, risks and success metrics.',
  Standard: 'Produce a complete professional PRD with practical detail. Avoid invented facts; label assumptions clearly.',
  Detailed: 'Produce an exceptionally thorough PRD. Include edge cases, acceptance criteria, dependencies, architecture considerations, risks, rollout, observability and measurable success criteria. Label assumptions clearly.'
} as const;

export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid product input.' }, { status: 400 });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return Response.json({ error: 'Gemini is not configured. Add GEMINI_API_KEY to the server environment.' }, { status: 503 });

  const { productName, idea, template, mode } = parsed.data;
  const prompt = `You are a principal product manager and technical writer. Generate a decision-ready Product Requirements Document in Markdown.

Rules:
- Never invent customer research, metrics, integrations, regulations, budgets, or commitments. Mark unknowns as assumptions or open questions.
- Prefer testable requirements and concrete acceptance criteria.
- Separate goals from non-goals.
- Include edge cases, dependencies, risks, rollout, and measurable success metrics.
- ${prompts[mode]}

Product name: ${productName || 'Unnamed product'}
Template: ${template}
Product idea:
${idea}

Sections:
1. Executive Summary
2. Problem Statement
3. Goals & Non-Goals
4. Target Users & Personas
5. User Stories / Jobs To Be Done
6. User Experience & Core Flows
7. Functional Requirements
8. Non-Functional Requirements
9. Data & System Architecture
10. Integrations & Dependencies
11. Acceptance Criteria
12. Analytics & Success Metrics
13. Security & Privacy Considerations
14. Risks & Mitigations
15. Rollout & Milestones
16. Open Questions
17. Appendix
`;

  try {
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({ model: 'gemini-1.5-pro' });
    const stream = await model.generateContentStream(prompt);
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream.stream) controller.enqueue(encoder.encode(chunk.text()));
          controller.close();
        } catch (error) { controller.error(error); }
      }
    });
    return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) {
    console.error('Gemini generation failed', error);
    return Response.json({ error: 'PRD generation failed. Check the Gemini configuration and try again.' }, { status: 502 });
  }
}

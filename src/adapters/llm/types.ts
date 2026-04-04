// Canonical request/response contract for all LLM provider adapters.
// Mirrors the PMAdapter pattern in src/adapters/types.ts.

export interface LLMRequest {
  model: string;
  systemPrompt: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  tools: unknown[];   // each adapter casts to its native SDK type
  toolName: string;   // tool to force via tool_choice
  maxTokens: number;
  temperature: number;
}

export interface LLMAdapter {
  provider: string;
  /** Execute a forced tool-use call. Returns the tool's input payload. */
  call(req: LLMRequest): Promise<Record<string, unknown>>;
}

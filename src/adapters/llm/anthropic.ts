import Anthropic from '@anthropic-ai/sdk';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import type { LLMAdapter, LLMRequest } from './types';

export class AnthropicAdapter implements LLMAdapter {
  provider = 'anthropic';
  private client: Anthropic | null = null;

  private getClient(): Anthropic {
    if (!this.client) this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    return this.client;
  }

  async call(req: LLMRequest): Promise<Record<string, unknown>> {
    const msg = await this.getClient().messages.create({
      model:       req.model,
      max_tokens:  req.maxTokens,
      temperature: req.temperature,
      system:      req.systemPrompt,
      messages:    req.messages,
      tools:       req.tools as Tool[],
      tool_choice: { type: 'tool', name: req.toolName },
    });

    const toolUse = msg.content.find(b => b.type === 'tool_use');
    return (toolUse && toolUse.type === 'tool_use'
      ? toolUse.input
      : {}) as Record<string, unknown>;
  }
}

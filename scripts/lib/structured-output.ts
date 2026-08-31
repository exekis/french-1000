import OpenAI from 'openai';
import { zodResponseFormat, zodTextFormat } from 'openai/helpers/zod';
import type { ZodType } from 'zod/v4';

type StructuredOutputOptions<T> = {
  client: OpenAI;
  model: string;
  name: string;
  schema: ZodType<T>;
  systemPrompt: string;
  userPrompt: string;
  compatibleEndpoint: boolean;
};

export type StructuredOutputResult<T> = {
  id: string;
  parsed: T;
  usage: unknown;
};

export function parseStructuredJson<T>(raw: string, schema: ZodType<T>): T {
  const trimmed = raw.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end < start) {
    throw new Error('Model response did not contain a JSON object');
  }
  return schema.parse(JSON.parse(trimmed.slice(start, end + 1)));
}

export function createModelClient(baseURL?: string): OpenAI {
  if (!baseURL) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required');
    }
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  const hostname = new URL(baseURL).hostname;
  if (!['127.0.0.1', 'localhost', '::1'].includes(hostname)) {
    throw new Error('Compatible model endpoints must use a loopback URL');
  }
  return new OpenAI({ apiKey: 'local', baseURL });
}

export async function requestStructuredOutput<T>({
  client,
  model,
  name,
  schema,
  systemPrompt,
  userPrompt,
  compatibleEndpoint,
}: StructuredOutputOptions<T>): Promise<StructuredOutputResult<T>> {
  if (!compatibleEndpoint) {
    const response = await client.responses.parse({
      model,
      store: false,
      input: `${systemPrompt}\n\n${userPrompt}`,
      text: { format: zodTextFormat(schema, name) },
    });
    if (response.status !== 'completed' || !response.output_parsed) {
      throw new Error(
        `Structured response did not complete: ${JSON.stringify(
          response.incomplete_details ?? response.error,
        )}`,
      );
    }
    return {
      id: response.id,
      parsed: response.output_parsed,
      usage: response.usage,
    };
  }

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: zodResponseFormat(schema, name),
  });
  const message = completion.choices[0]?.message as
    | ((typeof completion.choices)[number]['message'] & {
        reasoning_content?: string;
      })
    | undefined;
  const raw = message?.content?.trim() || message?.reasoning_content?.trim();
  if (!raw) {
    throw new Error('Compatible model endpoint returned no structured text');
  }
  return {
    id: completion.id,
    parsed: parseStructuredJson(raw, schema),
    usage: completion.usage,
  };
}

export type OllamaRepository = {
  /** Send a prompt to Ollama with structured output format, returns parsed response or null on error */
  generate: <T>(params: { prompt: string; format: Record<string, unknown> }) => Promise<T | null>;
};

/**
 * Repository for Ollama /api/generate interactions.
 * Model is bound at construction — one instance per model.
 */
export class OllamaRepositoryImpl implements OllamaRepository {
  constructor(
    private readonly ollamaUrl: string,
    private readonly model: string,
  ) {}

  async generate<T>(params: {
    prompt: string;
    format: Record<string, unknown>;
  }): Promise<T | null> {
    try {
      const res = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          prompt: params.prompt,
          stream: false,
          format: params.format,
        }),
      });

      if (!res.ok) {
        console.error(`ollama repository: ${res.status} ${res.statusText}`);
        return null;
      }

      const json = (await res.json()) as { response?: string };
      const raw = json.response ?? "";
      const trimmed = raw.trim();
      if (!trimmed) return null;

      return JSON.parse(trimmed) as T;
    } catch (err) {
      console.error(`ollama repository: ${String(err)}`);
      return null;
    }
  }
}

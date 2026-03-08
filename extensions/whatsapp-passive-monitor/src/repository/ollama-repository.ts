export type OllamaRepository = {
  /** Send a prompt to Ollama with structured output format, returns parsed response or null on error */
  generate: <T>(params: {
    prompt: string;
    format: Record<string, unknown>;
    model: string;
  }) => Promise<T | null>;
};

/**
 * Repository for Ollama /api/generate interactions.
 * Model is passed per generate() call — a single instance serves all models.
 */
export class OllamaRepositoryImpl implements OllamaRepository {
  // Only these models are allowed through generate()
  private static readonly SUPPORTED_MODELS = new Set(["llama3.1:8b", "qwen3.5:4b"]);

  constructor(private readonly ollamaUrl: string) {}

  async generate<T>(params: {
    prompt: string;
    format: Record<string, unknown>;
    model: string;
  }): Promise<T | null> {
    if (!OllamaRepositoryImpl.SUPPORTED_MODELS.has(params.model)) {
      throw new Error(`Unsupported model: "${params.model}"`);
    }

    try {
      const res = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: params.model,
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

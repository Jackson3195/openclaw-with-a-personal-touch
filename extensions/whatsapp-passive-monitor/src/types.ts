// Stored message row from SQLite
export type StoredMessage = {
  id: number;
  conversation_id: string;
  sender: string;
  sender_name: string | null;
  content: string;
  timestamp: number; // ms epoch
  direction: "inbound" | "outbound";
  channel_id: string;
};

// Minimal logger type — compatible with PluginLogger from openclaw/plugin-sdk
export type Logger = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
};

// Plugin configuration with defaults
export type PluginConfig = {
  ollamaUrl: string;
  model: string;
  debounceMs: number;
  contextMessageLimit: number;
  dbPath: string;
  outputDir: string;
};

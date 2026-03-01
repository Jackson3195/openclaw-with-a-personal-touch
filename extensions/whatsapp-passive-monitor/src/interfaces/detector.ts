import type { Command } from "./command.ts";

// Shared execution context — every detector receives this
export type DetectorExecCtx = {
  conversationId: string;
};

// Each detector defines its own deps (D) and result (R)
// Example: MeetingDetector deps = { messageRepo, ollamaUrl, model }
export type Detector<D, R> = Command<D, DetectorExecCtx, R>;

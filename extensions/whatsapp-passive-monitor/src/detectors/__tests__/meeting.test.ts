import { describe, it, expect, vi } from "vitest";
import type { AgentRepository } from "../../repository/agent-repository.ts";
import type { MessageRepository } from "../../repository/message-repository.ts";
import type { OllamaRepository } from "../../repository/ollama-repository.ts";
import type { Logger, StoredMessage } from "../../types.ts";
import { meetingDetector } from "../meeting.ts";

const sampleMessages: StoredMessage[] = [
  {
    id: 1,
    conversation_id: "chat-1",
    sender: "+44700000001",
    sender_name: "Alice",
    content: "Hey are you free Saturday?",
    timestamp: 1700000000000,
    direction: "inbound",
    channel_id: "whatsapp",
  },
  {
    id: 2,
    conversation_id: "chat-1",
    sender: "me",
    sender_name: null,
    content: "Sure, 2pm works",
    timestamp: 1700000060000,
    direction: "outbound",
    channel_id: "whatsapp",
  },
];

const createMockRepo = (messages: StoredMessage[] = sampleMessages): MessageRepository => ({
  insertMessage: vi.fn(),
  getConversation: vi.fn().mockReturnValue(messages),
});

const createMockOllama = (result: unknown = null): OllamaRepository => ({
  generate: vi.fn().mockResolvedValue(result),
});

const createMockAgentRepo = (success = true): AgentRepository => ({
  send: vi.fn().mockResolvedValue({ success, error: success ? undefined : "agent error" }),
});

const createMockLogger = (): Logger => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
});

describe("meetingDetector", () => {
  // --- Ollama classification ---

  it("queries the message repository with conversationId and limit 20", async () => {
    const repo = createMockRepo();
    const ollama = createMockOllama({ meetingDetected: false });
    const agentRepo = createMockAgentRepo();
    const logger = createMockLogger();

    const execute = meetingDetector({ messageRepo: repo, ollama, agentRepo, logger });
    await execute({ conversationId: "chat-1" });

    expect(repo.getConversation).toHaveBeenCalledWith("chat-1", { limit: 20 });
  });

  it("embeds formatted conversation in the Ollama prompt", async () => {
    const repo = createMockRepo();
    const ollama = createMockOllama({ meetingDetected: false });
    const agentRepo = createMockAgentRepo();
    const logger = createMockLogger();

    const execute = meetingDetector({ messageRepo: repo, ollama, agentRepo, logger });
    await execute({ conversationId: "chat-1" });

    const call = (ollama.generate as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.prompt).toContain("Alice: Hey are you free Saturday?");
    expect(call.prompt).toContain("You: Sure, 2pm works");
  });

  it("sends structured output format to Ollama", async () => {
    const repo = createMockRepo();
    const ollama = createMockOllama({ meetingDetected: false });
    const agentRepo = createMockAgentRepo();
    const logger = createMockLogger();

    const execute = meetingDetector({ messageRepo: repo, ollama, agentRepo, logger });
    await execute({ conversationId: "chat-1" });

    const call = (ollama.generate as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.format).toEqual({
      type: "object",
      properties: { meetingDetected: { type: "boolean" } },
      required: ["meetingDetected"],
    });
  });

  it("prompt contains all 7 classification rules", async () => {
    const repo = createMockRepo();
    const ollama = createMockOllama({ meetingDetected: false });
    const agentRepo = createMockAgentRepo();
    const logger = createMockLogger();

    const execute = meetingDetector({ messageRepo: repo, ollama, agentRepo, logger });
    await execute({ conversationId: "chat-1" });

    const call = (ollama.generate as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const rules = [
      "physically being in the same place",
      "Both parties must agree or confirm",
      "initially declines but then changes their mind",
      "Sarcastic or joking",
      "arranging something for OTHER people",
      "cancelled meetup",
      "Picking up an item from a doorstep",
    ];
    for (const rule of rules) {
      expect(call.prompt).toContain(rule);
    }
  });

  // --- No meeting detected ---

  it("returns meetingDetected: false when Ollama does not detect a meeting", async () => {
    const repo = createMockRepo();
    const ollama = createMockOllama({ meetingDetected: false });
    const agentRepo = createMockAgentRepo();
    const logger = createMockLogger();

    const execute = meetingDetector({ messageRepo: repo, ollama, agentRepo, logger });
    const result = await execute({ conversationId: "chat-1" });

    expect(result.meetingDetected).toBe(false);
    expect(result.agentNotified).toBe(false);
  });

  it("returns meetingDetected: false when Ollama returns null", async () => {
    const repo = createMockRepo();
    const ollama = createMockOllama(null);
    const agentRepo = createMockAgentRepo();
    const logger = createMockLogger();

    const execute = meetingDetector({ messageRepo: repo, ollama, agentRepo, logger });
    const result = await execute({ conversationId: "chat-1" });

    expect(result.meetingDetected).toBe(false);
    expect(result.agentNotified).toBe(false);
  });

  it("does not call agentRepo.send when Ollama returns false", async () => {
    const repo = createMockRepo();
    const ollama = createMockOllama({ meetingDetected: false });
    const agentRepo = createMockAgentRepo();
    const logger = createMockLogger();

    const execute = meetingDetector({ messageRepo: repo, ollama, agentRepo, logger });
    await execute({ conversationId: "chat-1" });

    expect(agentRepo.send).not.toHaveBeenCalled();
  });

  // --- Meeting detected → agent notification ---

  it("calls agentRepo.send when Ollama detects a meeting", async () => {
    const repo = createMockRepo();
    const ollama = createMockOllama({ meetingDetected: true });
    const agentRepo = createMockAgentRepo();
    const logger = createMockLogger();

    const execute = meetingDetector({ messageRepo: repo, ollama, agentRepo, logger });
    await execute({ conversationId: "chat-1" });

    expect(agentRepo.send).toHaveBeenCalledOnce();
  });

  it("agent prompt contains the formatted conversation", async () => {
    const repo = createMockRepo();
    const ollama = createMockOllama({ meetingDetected: true });
    const agentRepo = createMockAgentRepo();
    const logger = createMockLogger();

    const execute = meetingDetector({ messageRepo: repo, ollama, agentRepo, logger });
    await execute({ conversationId: "chat-1" });

    const prompt = (agentRepo.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(prompt).toContain("Alice: Hey are you free Saturday?");
    expect(prompt).toContain("You: Sure, 2pm works");
  });

  it("agent prompt instructs to confirm and offer to create event", async () => {
    const repo = createMockRepo();
    const ollama = createMockOllama({ meetingDetected: true });
    const agentRepo = createMockAgentRepo();
    const logger = createMockLogger();

    const execute = meetingDetector({ messageRepo: repo, ollama, agentRepo, logger });
    await execute({ conversationId: "chat-1" });

    const prompt = (agentRepo.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(prompt).toContain("calendar event");
    expect(prompt).toContain("summary");
  });

  it("returns agentNotified: true when agent send succeeds", async () => {
    const repo = createMockRepo();
    const ollama = createMockOllama({ meetingDetected: true });
    const agentRepo = createMockAgentRepo(true);
    const logger = createMockLogger();

    const execute = meetingDetector({ messageRepo: repo, ollama, agentRepo, logger });
    const result = await execute({ conversationId: "chat-1" });

    expect(result.meetingDetected).toBe(true);
    expect(result.agentNotified).toBe(true);
  });

  it("returns agentNotified: false when agent send fails", async () => {
    const repo = createMockRepo();
    const ollama = createMockOllama({ meetingDetected: true });
    const agentRepo = createMockAgentRepo(false);
    const logger = createMockLogger();

    const execute = meetingDetector({ messageRepo: repo, ollama, agentRepo, logger });
    const result = await execute({ conversationId: "chat-1" });

    expect(result.meetingDetected).toBe(true);
    expect(result.agentNotified).toBe(false);
  });
});

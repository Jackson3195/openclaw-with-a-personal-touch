import type { Detector } from "../interfaces/detector.ts";
import type { MessageRepository } from "../repository/message-repository.ts";
import type { OllamaRepository } from "../repository/ollama-repository.ts";
import type { StoredMessage } from "../types.ts";

export type MeetingDetectorDeps = {
  messageRepo: MessageRepository;
  ollama: OllamaRepository;
};

export type MeetingDetectorResult = {
  meetingDetected: boolean;
};

/**
 * Meeting detector command.
 * Queries the message repository for the last 20 messages, formats them,
 * sends to Ollama for classification, and returns the result.
 */
export const createMeetingDetector: Detector<MeetingDetectorDeps, MeetingDetectorResult> = (
  deps,
) => {
  // Structured output schema — Ollama guarantees the response matches this shape
  const MEETING_FORMAT = {
    type: "object",
    properties: {
      meetingDetected: { type: "boolean" },
    },
    required: ["meetingDetected"],
  };

  // How many messages the meeting detector pulls from the repository
  const CONTEXT_LIMIT = 20;

  /**
   * Format a timestamp (ms epoch) as HH:MM.
   */
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  };

  /**
   * Format StoredMessage[] into a readable conversation string.
   * Outbound messages are labelled "You", inbound use sender_name or sender.
   */
  const formatConversation = (messages: StoredMessage[]): string =>
    messages
      .map((m) => {
        const time = formatTime(m.timestamp);
        const name = m.direction === "outbound" ? "You" : (m.sender_name ?? m.sender);
        return `[${time}] ${name}: ${m.content}`;
      })
      .join("\n");

  /**
   * Build the complete classification prompt with conversation embedded.
   * v3 prompt — 97% accuracy with llama3.1:8b (7 rules)
   */
  const buildPrompt = (conversation: string): string =>
    `You are a classifier. Read the following WhatsApp conversation and determine whether the participants in the conversation are arranging to meet each other in person.

Rules:
- "Meeting up" means physically being in the same place together. Online calls, video chats, gaming sessions, and virtual meetings do NOT count.
- Both parties must agree or confirm. Vague intentions like "we should catch up soon" without a specific plan do NOT count.
- If someone initially declines but then changes their mind and agrees, that COUNTS as meeting up.
- Sarcastic or joking arrangements (e.g. "meet on the moon") do NOT count.
- If they are arranging something for OTHER people (not themselves), that does NOT count.
- A cancelled meetup does NOT count, even if they say "maybe next week".
- Picking up an item from a doorstep without face-to-face interaction does NOT count.

--- Conversation ---
${conversation}

Respond with JSON only: {"meetingDetected": true or false}`;

  const { messageRepo, ollama } = deps;

  return async (ctx) => {
    const { conversationId } = ctx;

    const messages = messageRepo.getConversation(conversationId, { limit: CONTEXT_LIMIT });
    const conversation = formatConversation(messages);
    const prompt = buildPrompt(conversation);

    const result = await ollama.generate<{ meetingDetected: boolean }>({
      prompt,
      format: MEETING_FORMAT,
    });

    return { meetingDetected: result?.meetingDetected === true };
  };
};

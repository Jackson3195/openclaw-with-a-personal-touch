import { describe, it, expect, vi } from "vitest";
import type { EscalationRepository } from "../../repository/escalation-repository.ts";
import type { Logger } from "../../types.ts";
import { acceptEscalation } from "../accept-escalation.ts";

const createMockEscalationRepo = (): EscalationRepository => ({
  insertEscalation: vi.fn(),
  getLastEscalation: vi.fn(),
  markCreated: vi.fn(),
  deleteEscalation: vi.fn(),
});

const createMockLogger = (): Logger => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
});

describe("acceptEscalation", () => {
  it("calls markCreated with the escalation id", async () => {
    const escalationRepo = createMockEscalationRepo();
    const logger = createMockLogger();
    const execute = acceptEscalation({ escalationRepo, logger });

    await execute({ escalationId: 42 });

    expect(escalationRepo.markCreated).toHaveBeenCalledWith(42);
  });

  it("returns { accepted: true }", async () => {
    const execute = acceptEscalation({
      escalationRepo: createMockEscalationRepo(),
      logger: createMockLogger(),
    });

    const result = await execute({ escalationId: 42 });

    expect(result).toEqual({ accepted: true });
  });

  it("logs the acceptance", async () => {
    const logger = createMockLogger();
    const execute = acceptEscalation({
      escalationRepo: createMockEscalationRepo(),
      logger,
    });

    await execute({ escalationId: 42 });

    expect(logger.info).toHaveBeenCalled();
  });
});

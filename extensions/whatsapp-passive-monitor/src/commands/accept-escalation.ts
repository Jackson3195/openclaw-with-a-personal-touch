import type { Command } from "../interfaces/command.ts";
import type { EscalationRepository } from "../repository/escalation-repository.ts";
import type { Logger } from "../types.ts";

export type AcceptEscalationDeps = {
  escalationRepo: EscalationRepository;
  logger: Logger;
};

export type AcceptEscalationCtx = {
  escalationId: number;
};

export type AcceptEscalationResult = {
  accepted: boolean;
};

// Marks an escalation as created — called by the agent skill after
// a calendar event has been successfully created.
export const acceptEscalation: Command<
  AcceptEscalationDeps,
  AcceptEscalationCtx,
  AcceptEscalationResult
> = (deps) => {
  const { escalationRepo, logger } = deps;

  return async (ctx) => {
    escalationRepo.markCreated(ctx.escalationId);
    logger.info(`accept-escalation: marked escalation ${ctx.escalationId} as created`);
    return { accepted: true };
  };
};

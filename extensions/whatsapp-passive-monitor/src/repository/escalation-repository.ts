import type { SqliteRepository, PreparedStatement } from "./sqlite-repository.js";

// Stored escalation row from SQLite (window_message_ids parsed from JSON)
export type StoredEscalation = {
  id: number;
  conversation_id: string;
  escalation_type: string;
  window_message_ids: number[];
  created: boolean;
  created_at: number;
};

export type EscalationRepository = {
  /** Insert a new escalation and return the created row */
  insertEscalation: (params: {
    conversationId: string;
    escalationType: string;
    windowMessageIds: number[];
  }) => StoredEscalation;
  /** Get the most recent escalation for a conversation, or null */
  getLastEscalation: (conversationId: string) => StoredEscalation | null;
  /** Mark an escalation as created by id */
  markCreated: (id: number) => void;
  /** Delete an escalation by id (used for rollback on agent send failure) */
  deleteEscalation: (id: number) => void;
};

// Raw row shape from SQLite (window_message_ids is a JSON string, created is 0/1)
type EscalationRow = {
  id: number;
  conversation_id: string;
  escalation_type: string;
  window_message_ids: string;
  created: number;
  created_at: number;
};

/**
 * Escalation persistence layer.
 * Owns the escalations table schema and INSERT/SELECT/UPDATE SQL.
 * Window message IDs are stored as JSON arrays in SQLite TEXT columns.
 */
export class EscalationRepositoryImpl implements EscalationRepository {
  private readonly insertStmt: PreparedStatement;
  private readonly queryStmt: PreparedStatement;
  private readonly markCreatedStmt: PreparedStatement;
  private readonly deleteStmt: PreparedStatement;

  constructor(db: SqliteRepository) {
    // Create schema (if it doesn't exist)
    db.exec(`
      CREATE TABLE IF NOT EXISTS escalations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        escalation_type TEXT NOT NULL,
        window_message_ids TEXT NOT NULL,
        created INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_esc_conv ON escalations (conversation_id, created_at DESC);
    `);

    // Prepared statements
    this.insertStmt = db.prepare(`
      INSERT INTO escalations (conversation_id, escalation_type, window_message_ids, created, created_at)
      VALUES (?, ?, ?, 0, ?)
    `);

    // Order by id DESC — autoincrement guarantees insertion order even when
    // created_at timestamps collide (same ms)
    this.queryStmt = db.prepare(`
      SELECT id, conversation_id, escalation_type, window_message_ids, created, created_at
      FROM escalations
      WHERE conversation_id = ?
      ORDER BY id DESC
      LIMIT 1
    `);

    this.markCreatedStmt = db.prepare(`
      UPDATE escalations SET created = 1 WHERE id = ?
    `);

    this.deleteStmt = db.prepare(`
      DELETE FROM escalations WHERE id = ?
    `);
  }

  insertEscalation(params: {
    conversationId: string;
    escalationType: string;
    windowMessageIds: number[];
  }): StoredEscalation {
    this.insertStmt.run(
      params.conversationId,
      params.escalationType,
      JSON.stringify(params.windowMessageIds),
      Date.now(),
    );
    // Just inserted — guaranteed to exist
    return this.getLastEscalation(params.conversationId)!;
  }

  getLastEscalation(conversationId: string): StoredEscalation | null {
    const rows = this.queryStmt.all(conversationId) as EscalationRow[];
    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      id: row.id,
      conversation_id: row.conversation_id,
      escalation_type: row.escalation_type,
      window_message_ids: JSON.parse(row.window_message_ids) as number[],
      created: Boolean(row.created),
      created_at: row.created_at,
    };
  }

  markCreated(id: number): void {
    this.markCreatedStmt.run(id);
  }

  deleteEscalation(id: number): void {
    this.deleteStmt.run(id);
  }
}

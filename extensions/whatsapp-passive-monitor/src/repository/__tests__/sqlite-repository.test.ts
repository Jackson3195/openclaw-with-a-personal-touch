import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteRepositoryImpl, type SqliteRepository } from "../sqlite-repository.js";

describe("SqliteRepository", () => {
  let tmpDir: string;
  let dbPath: string;
  let db: SqliteRepository;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpm-sqlite-test-"));
    dbPath = path.join(tmpDir, "test.db");
    db = new SqliteRepositoryImpl(dbPath);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ---- Database setup ----

  it("creates the database file on init", () => {
    expect(fs.existsSync(dbPath)).toBe(true);
  });

  it("is idempotent — opening the same path twice does not error", () => {
    db.close();
    // Re-open on same path and assign to db so afterEach closes it
    db = new SqliteRepositoryImpl(dbPath);
  });

  // ---- exec ----

  it("exec runs DDL statements", () => {
    db.exec("CREATE TABLE IF NOT EXISTS test_t (id INTEGER PRIMARY KEY, val TEXT)");

    // Verify table exists by inserting and querying
    const insert = db.prepare("INSERT INTO test_t (val) VALUES (?)");
    insert.run("hello");

    const query = db.prepare("SELECT val FROM test_t");
    const rows = query.all();
    expect(rows).toHaveLength(1);
  });

  // ---- prepare().run ----

  it("prepare().run inserts a row", () => {
    db.exec("CREATE TABLE test_t (id INTEGER PRIMARY KEY, val TEXT)");

    const insert = db.prepare("INSERT INTO test_t (val) VALUES (?)");
    insert.run("row-1");

    const query = db.prepare("SELECT val FROM test_t");
    const rows = query.all() as { val: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].val).toBe("row-1");
  });

  // ---- prepare().all ----

  it("prepare().all returns rows", () => {
    db.exec("CREATE TABLE test_t (id INTEGER PRIMARY KEY, val TEXT)");

    const insert = db.prepare("INSERT INTO test_t (val) VALUES (?)");
    insert.run("a");
    insert.run("b");
    insert.run("c");

    const query = db.prepare("SELECT * FROM test_t ORDER BY id");
    const rows = query.all() as { id: number; val: string }[];
    expect(rows).toHaveLength(3);
    expect(rows[0].val).toBe("a");
    expect(rows[1].val).toBe("b");
    expect(rows[2].val).toBe("c");
  });
});

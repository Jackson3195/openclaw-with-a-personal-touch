// Curried command: construct with dependencies, execute with shared context
export type Command<D, E, R> = (deps: D) => (ctx: E) => Promise<R>;

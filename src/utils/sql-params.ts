/** Collects positional parameters for raw SQL: `params.add(value)` → `$n`. */
export class SqlParams {
  readonly values: unknown[] = [];

  add(value: unknown): string {
    this.values.push(value);
    return `$${this.values.length}`;
  }
}

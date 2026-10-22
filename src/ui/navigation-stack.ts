/** UI history is transient; it never becomes part of a game save. */
export class NavigationStack<T> {
  private pages: T[] = [];
  get current(): T | undefined { return this.pages.at(-1); }
  get canGoBack(): boolean { return this.pages.length > 1; }
  open(page: T): void { this.pages = [page]; }
  push(page: T): void { if (page !== this.current) this.pages.push(page); }
  back(): T | undefined { this.pages.pop(); return this.current; }
  clear(): void { this.pages = []; }
}

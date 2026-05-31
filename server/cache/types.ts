export interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

export interface CacheProvider {
  get<T>(key: string): Promise<CacheEntry<T> | undefined>;
  set<T>(key: string, entry: CacheEntry<T>): Promise<void>;
}

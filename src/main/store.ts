import type { EventData } from '../shared/types'

interface StoreSchema {
  event: EventData | null
}

export class AppStore {
  // electron-store v9+ is ESM-only; use dynamic import to load it in the CJS main process
  private constructor(private store: {
    get(key: 'event', defaultValue: null): EventData | null
    set(key: 'event', value: EventData | null): void
  }) {}

  static async create(): Promise<AppStore> {
    const { default: Store } = await import('electron-store')
    const store = new Store<StoreSchema>({
      name: 'sprint-series-data',
      defaults: { event: null }
    })
    return new AppStore(store)
  }

  getEvent(): EventData | null {
    return this.store.get('event', null)
  }

  saveEvent(event: EventData): void {
    this.store.set('event', event)
  }

  clearEvent(): void {
    this.store.set('event', null)
  }
}

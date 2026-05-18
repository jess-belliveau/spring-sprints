import Store from 'electron-store'
import type { EventData } from '../shared/types'

interface StoreSchema {
  event: EventData | null
}

export class AppStore {
  private store: Store<StoreSchema>

  constructor() {
    this.store = new Store<StoreSchema>({
      name: 'sprint-series-data',
      defaults: { event: null }
    })
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

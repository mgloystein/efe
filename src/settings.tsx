'use strict';

export interface FileCryptoPluginSettings {
  Keys: {
    [key: string]: KeySet
  }
  keyIdProperty: string

  // idleTTL is the time in seconds to hold on to an authorization
  idleTTL: number

  DEBUG_MODE: boolean
}

export interface KeySet {
  id: string
  key: string
  name?: string
  hint?: string
  idleTTL?: number
}

export interface KeyMap {
  [key: string]: KeySet
}

export interface KeyBundle {
  idleTTL?: number;
  keySet: KeySet
  passphrase: string
}

export const DEFAULT_SETTINGS: FileCryptoPluginSettings = {
  keyIdProperty: '.kid',
  idleTTL: 60,
  Keys: {},
  DEBUG_MODE: false
}
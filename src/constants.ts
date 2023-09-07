import { Notice } from "obsidian"

const {
  name, id
} = require('../manifest.json')
const prefix = id

export const APP_NAME = name
export const SECURED_GLYPH = 'check-in-circle'
export const CHANGE_IN_PROGRESS_GLYPH = 'open-vault'
export const ENCRYPT_FILE_GLYPH = 'vault'
export const NEW_KEY_GLYPH = 'install'

export const VIEW_TYPE_ENCRYPTED_EDITOR = `${prefix}-encrypted-editor`

export const ENCRYPTION_SERVICE_EVENTS = `${prefix}-encryption-service-events`
export const KEY_LIST_UPDATE_EVENT = `${prefix}-key-list-updated`
export const AUTH_REQUESTED_EVENT = `${prefix}-key-access-request`
export const KEY_CREATED_EVENT = `${prefix}-key-created`
export const KEY_DELETED_EVENT = `${prefix}-key-deleted`

export const catcher = (err: any) => {
  console.debug(err)
  new Notice("Something went wrong. Try that again")
}

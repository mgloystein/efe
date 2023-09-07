import {
  App,
  Modal,
  Setting,
  Notice,
  TextComponent,
  ButtonComponent
} from 'obsidian'
import {
  FileCryptoPluginSettings
} from '../settings'
import {
  set,
  extend
} from 'lodash'

export type KeyGeneratorCallback = (req: KeyGeneratorRequest) => void

export interface KeyGeneratorRequest {
  passphrase: string
  name?: string
  hint?: string
  idleTTL?: number
}

export const DEFAULT_SETTINGS: KeyGeneratorRequest = {
  passphrase: '',
}

export class KeyGeneratorModal extends Modal {
  cb: KeyGeneratorCallback
  keyRequest: KeyGeneratorRequest
  settings: FileCryptoPluginSettings

  constructor(app: App, settings: FileCryptoPluginSettings, cb: KeyGeneratorCallback) {
    super(app);
    this.cb = cb
    this.keyRequest = { ...DEFAULT_SETTINGS }
    this.settings = settings
  }

  submitRequest(): boolean {
    if (this.keyRequest.passphrase === '') {
      new Notice('Passphrase is required and cannot be an empty string')
      return false
    } else if (this.keyRequest.passphrase.length > 64) {
      new Notice('Passphrase character limit arbitrarily set to 64')
      return false
    }
    try {
      this.cb(this.keyRequest)
    } catch (err) {
      console.debug(err)
      new Notice('Something didn\'t work...')
      return false
    }
    return true
  }

  onOpen() {
    const { titleEl, contentEl } = this;
    titleEl.setText('Create a new key');
    new Setting(contentEl)
      .setName("Passphrase for encryption key")
      .addText((text: TextComponent) =>
        text.onChange((value) => {
          set(this.keyRequest, 'passphrase', value)
        }));
    new Setting(contentEl)
      .setName("Friendly name")
      .addText((text: TextComponent) => {
        text.setPlaceholder('Key Name')
        text.onChange((value) => {
          set(this.keyRequest, 'name', value)
        })
      });
    new Setting(contentEl)
      .addButton((button: ButtonComponent) =>
        button
          .setButtonText('Create')
          .onClick((evt: MouseEvent) => {
            this.submitRequest() && this.close()
          }))
      .addButton((button: ButtonComponent) =>
        button
          .setButtonText('Cancel')
          .onClick((evt: MouseEvent) => {
            this.close()
          }))
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
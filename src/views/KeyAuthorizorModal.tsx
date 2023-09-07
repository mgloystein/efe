import {
  App,
  ButtonComponent,
  Modal,
  Notice,
  Setting,
  TextComponent
} from 'obsidian'

import { FileCryptoPluginSettings, KeySet } from '../settings'

export type PassphraseCallback = (req: string) => void

export class KeyAuthorizerModal extends Modal {
  cb: PassphraseCallback
  key: KeySet
  passphrase: string

  constructor(app: App, key: KeySet, cb: PassphraseCallback) {
    super(app);
    this.cb = cb
    this.key = key
  }

  submitRequest(): boolean {
    if (this.passphrase === '') {
      new Notice('Passphrase is required and cannot be an empty string')
      return false
    }
    this.cb(this.passphrase)
    return true
  }

  onOpen() {
    const { titleEl, contentEl } = this;
    titleEl.setText(`Authorize Key "${this.key.name || this.key.id}"`);
    new Setting(contentEl)
      .setName("Passphrase")
      .addText((text: TextComponent) =>
        text.onChange((value) => {
          this.passphrase = value
        }));
    new Setting(contentEl)
      .addButton((button: ButtonComponent) =>
        button
          .setButtonText('Authorize')
          .onClick((evt: MouseEvent) => {
            this.submitRequest() && this.close()
          }))
      .addButton((button) =>
        button
          .setButtonText('Cancel')
          .onClick((evt: MouseEvent) => {
            this.close()
          }))
  }

  onClose() {
    this.contentEl.empty();
  }
}
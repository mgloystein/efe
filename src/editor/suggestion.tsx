'use strict';

import {
  EditorSuggest,
  Editor,
  App,
  EditorPosition,
  TFile,
  EditorSuggestContext,
  EditorSuggestTriggerInfo
} from 'obsidian'
import {
  FileCryptoPluginSettings,
  KeyMap,
  KeySet
} from '../settings'
import * as constants from '../constants'
import { PubSub } from 'pubsub-ts'

interface charMap {
  [key: string]: string
}

const regExEscape: charMap = {
  '.': '\\.',
  '^': '\^',
  '$': '\$',
  '\\': '\\\\',
  '*': '\*',
  '+': '\+',
  '?': '\?',
  '(': '\(',
  ')': '\)',
  '[': '\[',
  ']': '\]',
  '{': '\{',
  '}': '\}',
  '|': '\|',
  '/': '\/'
}

export class EncryptionKeySuggest extends EditorSuggest<string> {
  kids: KeyMap

  editor: Editor | null
  lineNumber: number | null

  readonly lineMatcher: RegExp
  readonly kidLine: RegExp
  readonly subscription: PubSub.Subscriber
  readonly FM_KEY: string

  constructor(app: App, settings: FileCryptoPluginSettings, subscription: PubSub.Subscriber) {
    super(app)
    this.FM_KEY = settings.keyIdProperty
    this.subscription = subscription

    this.update(settings.Keys)

    const chars = this.FM_KEY.split('').map(char => regExEscape[char] || char);
    const minSet = chars.splice(0, this.FM_KEY.length / 2);

    this.lineMatcher = new RegExp(['^', minSet.join(''), chars.join('?'), '?:? ?'].join(''));
    this.kidLine = new RegExp('^' + this.FM_KEY + ': .+$');

    this.subscription.on(constants.KEY_LIST_UPDATE_EVENT, (evt: any) => {
      this.update(evt.body.keys)
    })
    this.subscription.start()
  }

  reset() {
    this.editor = null
    this.lineNumber = null
  }

  renderSuggestion(value: string, el: HTMLElement): void {
    const key = this.kids[value]
    if (key.name) {
      el.setText(`${key.name} (${key.id.substring(0, 6)}...)`)
    } else {
      el.setText(value)
    }
  }

  selectSuggestion(value: string, evt: MouseEvent | KeyboardEvent): void {
    if (this.lineNumber !== null && this.editor !== null) {
      const line = evt instanceof KeyboardEvent ? `${this.FM_KEY}: ${value}\n` : `${this.FM_KEY}: ${value}`

      this.editor.setLine(this.lineNumber, line)
      this.editor.setCursor(
        this.lineNumber === this.editor.lineCount() ?
          line.length - 1 : { line: this.lineNumber + 1, ch: 0 }
      )
      this.reset()
    }
  }

  update(kids: { [key: string]: KeySet }) {
    this.kids = { ...kids }
    this.reset()
  }

  isInFrontmatter(cursor: EditorPosition, editor: Editor): boolean {
    if (!editor.getLine(0).startsWith('---')) {
      return false
    }

    // TODO: Do this with streams
    for (let i = 1; i < cursor.line; i++) {
      if (editor.getLine(i) === '---') {
        return false
      }
    }
    return true;
  }

  hasKID(cursor: EditorPosition, editor: Editor): boolean {
    for (let i = 1; i < cursor.line; i++) {
      if (editor.getLine(i).match(this.kidLine)) {
        return true
      }
    }
    return false;
  }

  onTrigger(cursor: EditorPosition, editor: Editor, file: TFile | null): EditorSuggestTriggerInfo | null {
    const query = editor.getLine(cursor.line).substring(0, cursor.ch)
    if (!this.lineMatcher.test(query)) {
      return null
    }

    if (!this.isInFrontmatter(cursor, editor)) {
      return null
    }

    if (this.hasKID(cursor, editor)) {
      return null
    }

    this.editor = editor
    this.lineNumber = cursor.line
    return {
      start: {
        line: cursor.line,
        ch: 0
      },
      end: {
        line: cursor.line,
        ch: cursor.ch
      },
      query
    }
  }

  getSuggestions(context: EditorSuggestContext): string[] | Promise<string[]> {
    return Promise.resolve(Object.keys(this.kids))
  }
}
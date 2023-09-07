import { MarkdownEditView, FileView, WorkspaceLeaf } from 'obsidian'
import * as constants from '../constants'

export class FileEditorView extends FileView {
  getViewType(): string {
    return constants.VIEW_TYPE_ENCRYPTED_EDITOR
  }

  constructor(leaf: WorkspaceLeaf) {
    super(leaf)
  }

  override onload(): void {
    console.log(this)
  }

  override onunload(): void {

  }
}
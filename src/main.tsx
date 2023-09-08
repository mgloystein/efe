'use strict'

import {
	Plugin,
	stringifyYaml,
	TFile,
	Notice,
	PluginManifest,
	App
} from 'obsidian'

import {
	FileCryptoPluginSettings,
	DEFAULT_SETTINGS
} from './settings'

// import { FileEditorView } from './views'
import { EncryptionKeySuggest } from './editor'
import { extend } from 'lodash'

import * as constants from './constants'
import * as encryption from './encryption'

const frontmatterMatcher = /---\s*[\s\S]*?\s*---/g

export default class FileEncryptPlugin extends Plugin {
	settings: FileCryptoPluginSettings
	encryptionService: encryption.Service

	constructor(app: App, manifest: PluginManifest) {
		super(app, manifest)
	}

	async onload() {
		await this.loadSettings()

		this.encryptionService = encryption.getService(this, this.settings)

		// Set up editor
		const suggestions = new EncryptionKeySuggest(
			this.app, this.settings,
			this.encryptionService.subscribe()
		)
		this.registerEditorSuggest(suggestions)

		// this.registerView(constants.VIEW_TYPE_ENCRYPTED_EDITOR, leaf => new FileEditorView(leaf))

		// Set up encryption actions
		const fnEncryptActiveFile = () => {
			const file = this.app.workspace.getActiveFile()
			if (file !== null) {
				this.prepareFile(file)
			}
		}

		this.addRibbonIcon(
			constants.ENCRYPT_FILE_GLYPH,
			'Encrypt Current File',
			fnEncryptActiveFile
		)

		this.addCommand({
			id: 'file-encrypt-encrypt-current-file',
			name: 'Encrypt the current file',
			editorCallback: fnEncryptActiveFile
		})

		const fnCreateNewKey = () => this.encryptionService.createKey()
			.then(kid => new Notice(`Created key with id "${kid}"`))

		this.addRibbonIcon(
			constants.NEW_KEY_GLYPH,
			'New Encryption Key',
			fnCreateNewKey
		)

		this.addCommand({
			id: 'file-encrypt-new-key',
			name: 'Create a new key for File Encrypt',
			editorCallback: fnCreateNewKey
		})
	}

	private async getEditorText(file: TFile): Promise<string> {
		return file.vault.read(file)
	}

	private prepareFile(file: TFile, kid?: string) {
		this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			const keyId = kid ? kid : frontmatter[this.settings.keyIdProperty]
			if (!keyId) {
				return new Notice('Couldn\'t identify key')
			}
			this.encryptionService.authorizeKey(keyId).then(async (isAuthorized) => {
				if (!isAuthorized) {
					return new Notice('Couldn\'t authorize key')
				}

				frontmatter[this.settings.keyIdProperty] = keyId

				const fmData = Buffer.from(`---\n${stringifyYaml(frontmatter)}---\n`)

				const contents = await this.getEditorText(file)
				const body = contents.replace(frontmatterMatcher, '')
				try {
					const bData = this.encryptionService.encrypt(keyId, Buffer.from(body))

					const newContents = Buffer.concat([fmData, bData])

					console.debug(`writing ${newContents.byteLength} bytes`)
					await file.vault.modifyBinary(file, newContents)
				} catch (err) {
					console.debug(err)
					new Notice('Well, this is\'t right.')
				}
			})
		})
	}

	onunload() {
		this.encryptionService.unload()
	}

	async loadSettings() {
		const settings = await this.loadData()
		console.log(126, settings)
		this.settings = extend({}, DEFAULT_SETTINGS, settings)
	}

	saveSettings() {
		return this.saveData(this.settings)
	}
}
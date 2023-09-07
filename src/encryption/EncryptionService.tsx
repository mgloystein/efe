import { cloneDeep, extend } from 'lodash';
import {
  App,
  Plugin,
  moment,
} from 'obsidian'
import { FileCryptoPluginSettings, KeyBundle, KeySet } from 'src/settings';
import * as constants from '../constants'
import { KeyAuthorizerModal, KeyGeneratorModal, KeyGeneratorRequest } from 'src/views';
import * as crypto from 'crypto'
import { PubSub } from 'pubsub-ts';

let service: Service
const alg = 'aes-256-cbc'

export interface Service {
  authorizeKey(keyId: string): Promise<boolean>
  createKey(): Promise<string>

  encrypt(keyId: string, bData: Buffer): Buffer
  decrypt(keyId: string, bData: Buffer): Buffer

  subscribe(): PubSub.Subscriber
  unload(): void
}

export class Authorization {
  readonly kid: string
  readonly secret: string
  readonly isValid: () => boolean
  readonly renew: () => void

  constructor(kid: string, secret: string, ttl?: number | null) {
    let expiration = ttl && ttl > 0 ? moment().add(moment.duration(ttl, 'second')) : null
    this.kid = kid
    this.secret = secret

    this.isValid = () => {
      return !expiration || expiration.isAfter(moment())
    }
    this.renew = () => {
      expiration = !expiration ? null : moment().add(moment.duration(ttl, 'second'))
    }
  }
}

class encryptionService {
  app: App
  settings: FileCryptoPluginSettings

  loadData: () => Promise<any>
  saveData: (data: any) => Promise<void>

  readonly eventsQueue: PubSub.Publisher
  readonly authList: Map<string, Authorization> = new Map()

  constructor() {
    this.eventsQueue = new PubSub.Publisher()
  }

  subscribe(): PubSub.Subscriber {
    const sub = new PubSub.Subscriber()
    this.eventsQueue.add(sub)
    return sub
  }

  authorizeKey(keyId: string): Promise<boolean> {
    this.eventsQueue.notify(constants.AUTH_REQUESTED_EVENT, { keyId })

    if (this.authList.has(keyId)) {
      if (this.authList.get(keyId)?.isValid() || false) {
        return Promise.resolve(true)
      }
      this.authList.delete(keyId)
    }

    const result = new Promise<boolean>((resolve) => {
      const ketSey: KeySet = this.settings.Keys[keyId]
      if (ketSey) {
        return new KeyAuthorizerModal(this.app, ketSey, (passphrase) => {
          this.authList.set(keyId, new Authorization(
            keyId,
            passphrase,
            ketSey.idleTTL || this.settings.idleTTL
          ))
          resolve(true)
        }).open()
      }
      resolve(false)
    })
    return result
  }

  encrypt(keyId: string, bData: Buffer): Buffer {
    const keySet = this.settings.Keys[keyId]
    if (!keySet) {
      throw new Error('Unknown key')
    }
    const passphrase = this.lookupPassphrase(keyId)
    if (passphrase === '') {
      throw new Error('Key is not authorized')
    }
    return this.xcrypt(keySet, passphrase, bData, 'createCipheriv')
  }

  decrypt(keyId: string, bData: Buffer): Buffer {
    const keySet = this.settings.Keys[keyId]
    if (!keySet) {
      throw new Error('Unknown key')
    }
    const passphrase = this.lookupPassphrase(keyId)
    if (passphrase === '') {
      throw new Error('Key is not authorized')
    }
    return this.xcrypt(keySet, passphrase, bData, 'createDecipheriv')
  }

  private xcrypt(
    keySet: KeySet,
    passphrase: string,
    bData: Buffer,
    action: 'createDecipheriv' | 'createCipheriv'
  ) {
    const key = this.deriveKey(keySet, passphrase)
    const iv = crypto.randomBytes(16)
    const cipher = crypto[action](alg, key.toString(), iv)
    const enc = cipher.update(bData)
    const com = Buffer.concat([enc, cipher.final()])
    return com
  }

  private deriveKey(keySet: KeySet, passphrase: string) {
    const signer = crypto.createSign("sha256")
    signer.write(passphrase)
    signer.end()

    const signature = signer.sign({ key: keySet.key, passphrase }, 'hex')
    const md5 = crypto.createHash("md5")
    const key = md5.update(signature).digest('hex')
    return key
  }

  private lookupPassphrase(kid: string): string {
    if (!this.authList.has(kid)) { return '' }

    const authorization = this.authList.get(kid)
    if (!authorization) { return '' }

    if (!authorization.isValid()) { return '' }

    authorization.renew()
    return authorization.secret
  }

  createKey(): Promise<string> {
    const result = new Promise<string>((resolve) => {
      new KeyGeneratorModal(this.app, this.settings, (req: KeyGeneratorRequest) => {
        const keySet = this.generatePrivateKey(req)
        const { passphrase } = req
        this.settings.Keys[keySet.id] = keySet

        this.authList.set(keySet.id, new Authorization(
          keySet.id,
          passphrase,
          keySet.idleTTL || this.settings.idleTTL
        ))

        this.saveData(this.settings).then(() => {
          this.eventsQueue.notify(constants.KEY_LIST_UPDATE_EVENT, {
            keyId: keySet.id,
            keys: cloneDeep(this.settings.Keys)
          })
          this.eventsQueue.notify(constants.KEY_CREATED_EVENT, { keyId: keySet.id })
        })
        resolve(keySet.id)
      }).open()
    })

    return result
  }

  private generatePrivateKey(req: KeyGeneratorRequest): KeySet {
    const { passphrase, hint, name, idleTTL } = req
    const keyPair = crypto.generateKeyPairSync('ec', {
      namedCurve: 'secp521r1',
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
        cipher: alg,
        passphrase
      }
    })

    return {
      key: keyPair.privateKey, hint, name, idleTTL,
      id: crypto.createHash("sha256").update(keyPair.publicKey).digest('base64'),
    }
  }

  unload() {
    this.authList.clear()
  }
}

export function getService(parent?: Plugin, settings?: FileCryptoPluginSettings): Service {
  if (!service) {
    if (parent) {
      const { app } = parent;

      service = new encryptionService()
      extend(service, {
        saveData: parent.saveData.bind(parent),
        loadData: parent.loadData.bind(parent),
        settings,
        app
      })
    } else {
      throw new Error('Hmm? That\'s not what\'s supposed to happen')
    }
  }
  return service
}
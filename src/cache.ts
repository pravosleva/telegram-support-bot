import { Cache, Config } from './interfaces'
import TelegramAddon from './addons/telegram'
import * as YAML from 'yaml'
import * as fs from 'fs'
import { getConfigPath } from '~/utils'
import { type Server } from 'socket.io'

class Singleton {
  private _state: Cache
  private static instance: Singleton
  private _io: Server
  private _bot: TelegramAddon
  private _config: Config

  constructor() {
    this._io = null
    this._bot = null as TelegramAddon,
    this._config = YAML.parse(
      fs.readFileSync(getConfigPath(process.env.NODE_ENV), 'utf8')
    )
    this._state = {
      ticketID: undefined,
      ticketIDs: new Set(),
      ticketStatus: {},
      ticketSent: new Map(),
      html: '',
      noSound: '',
      markdown: '',
    }
  }
  public static getInstance(): Singleton {
    if (!Singleton.instance) Singleton.instance = new Singleton()
    return Singleton.instance
  }

  public setBot(bot: TelegramAddon): void {
    this._bot = bot
  }
  public setTicketID(ticketID: number): void {
    this._state.ticketID = ticketID
  }
  public setIO(io: Server) {
    this._io = io
  }

  public get ticketID() {
    return this._state.ticketID
  }
  public get ticketIDs() {
    return this._state.ticketIDs
  }
  public get ticketStatus() {
    return this._state.ticketStatus
  }
  public get ticketSent() {
    return this._state.ticketSent
  }
  public get html() {
    return this._state.html
  }
  public get noSound() {
    return this._state.noSound
  }
  public get markdown() {
    return this._state.markdown
  }
  public get io() {
    return this._io
  }
  public get bot() {
    return this._bot
  }
  public get config() {
    return this._config
  }
}

// log({ label: '- cache create (before)', msgs: [] })

const cache = Singleton.getInstance()

// log({ label: '- cache created (after)', msgs: [
//   cache.config
// ] })

export default cache

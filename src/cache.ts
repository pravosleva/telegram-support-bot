import { Cache, Config } from './interfaces';
import TelegramAddon from './addons/telegram';
import * as YAML from 'yaml';
import * as fs from 'fs';

const cache: Cache = {
  ticketID: '',
  ticketIDs: [],
  ticketStatus: {},
  ticketSent: [],
  html: '',
  noSound: '',
  markdown: '',
  io: {},
  bot: {} as TelegramAddon,
  config: {} as Config,
};

const isDev = process.env.NODE_ENV === 'development';
console.log(process.env.NODE_ENV)
const configFile = isDev
  ? './config/config.dev.yaml'
  : './config/config.yaml';

cache.config = YAML.parse(
  fs.readFileSync(configFile, 'utf8'),
);

export default cache;

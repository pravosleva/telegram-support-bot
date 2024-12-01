import { log } from '~/utils';

const Database = require('better-sqlite3');
const db = new Database('./config/support.db', {
  /* verbose: console.log */
}); // debugging

try {
  db.prepare(`ALTER TABLE supportees ADD category TEXT;`).run();
} catch (e) {}
db.prepare(
    `CREATE TABLE IF NOT EXISTS supportees
    (id INTEGER PRIMARY KEY AUTOINCREMENT, ` +
    `userid TEXT, status TEXT, category TEXT);`,
).run();

const check = function(
    userid: any,
    category: any,
    callback: (arg0: any) => void,
) {
  const searchDB = db
      .prepare(
          `select * from supportees where (userid = ` +
        `${userid} or id = ${userid}) ` +
        `${category ? `AND category = '${category}'` : ''}`,
      )
      .all();
  callback(searchDB);
};

const getOpen = function(
  userid: number,
  category: string | null,
  callback: (ticket?: {
    userid: string;
    id: number;
    status: string;
    category: string | null;
  }) => void
) {
  const cmd = [
    'select * from supportees where ',
    `(userid = ${userid} or id = ${userid}) `,
    `AND status='open' `,
    category ? `AND category = '${category}'` : '',
  ].join('')
  const searchDB = db.prepare(cmd).get();
  log({ label: `db.getOpen(${userid}, ${category}, cb) -> searchDB is ${typeof searchDB}`, type: 'info', msgs: [
    searchDB, // SAMPLE: undefined | { id: 8, userid: '432590698', status: 'open', category: null }
  ] })
  callback(searchDB);
};

const getId = function(
    userid: number,
    callback: (ticket?: {
      userid: string;
      id: { toString: () => string }
    }) => void
) {
  const cmd = `select * from supportees where (userid = ${userid} or id = ${userid})`
  const searchDB = db.prepare(cmd).get();
  // log({ label: `db.getId(arg0, ...rst) -> searchDB (${typeof searchDB})`, type: 'info', msgs: [
  //   searchDB, // SAMPLE: { id: 1, userid: '432590698', status: 'open', category: null }
  //   `arg0: userid= ${userid} (${typeof userid})`,
  // ] })
  callback(searchDB);
};

const checkBan = function(
    userid: number,
    callback: { (ticket: any): any; (arg0: any): void },
) {
  const cmd = [
    // TODO: id only
    `select * from supportees where (userid = ${userid} or id = ${userid}) AND status='banned'`,
  ].join('')
  const searchDB = db.prepare(cmd).get();
  callback(searchDB);
};

const closeAll = function() {
  db.prepare(`UPDATE supportees SET status='closed'`).run();
};

const reopen = function(ticketId: number, category: string | null) {
  const cmd = [
    `UPDATE supportees SET status='open' `,
    // `WHERE userid=${userid} or id=${taskId} `,
    `WHERE id=${ticketId}${category ? ` AND category = '${category}'` : ''}`
  ].join('')
  db.prepare(cmd).run();
};

const add = function(
  userid: number,
  status: 'closed' | 'open' | 'banned',
  category: string | number | null,
) {
  // log({ label: `db.add(${userid}[${typeof userid}], ${status}, ${category})`, type: 'warn', msgs: [
  //   'called'
  // ] })
  let msg;
  let cmd = ''
  switch (status) {
    case 'closed':
      cmd = [
        `UPDATE supportees SET status='closed' WHERE `,
        `(userid=${userid} or id=${userid})`,
        !!category ? ` AND category = '${category}'` : '',
      ].join('')
      msg = db
        .prepare(cmd)
        .run();
      log({ label: `db add(${userid}[${typeof userid}], ${status}[${typeof status}], ${category}[${typeof category}]) // case1 (closed) -> msg = db.prepare(cmd).run()`, type: 'info', msgs: [
        msg, // SAMPLE: { changes: 5, lastInsertRowid: 0 }
      ] });
      break;
    case 'open':
      // db.prepare(`DELETE FROM supportees WHERE userid='${userid}'` +
      //    ` or id='${userid}'`).run();
      cmd = [
        `REPLACE INTO supportees (userid, status${category ? `, category` : ''}) `,
        `VALUES (${userid}, '${status}'${category ? ` ,'${category}'` : ''})`
      ].join('')
      msg = db
        .prepare(cmd)
        .run();
      break;
    case 'banned':
      cmd = [
        `REPLACE INTO supportees (userid, status, category) `,
        `VALUES (${userid}, '${status}', 'BANNED')`
      ].join('')
      msg = db
        .prepare(cmd)
        .run();
      break;
    default:
      break;
  }
  // log({ label: cmd, type: 'cmd.db', msgs: [
  //   msg, // SAMPLE: { changes: 1, lastInsertRowid: 20 }
  // ] });
  return msg.changes;
};

const open = function(
    callback: {
    (userList: {
      [x: string]: {
        [x: string]: {
          toString: () => {
            (): any;
            new (): any;
            indexOf(/* verbose: console.log */ arg0: string): any;
            padStart: {
              (
                // debugging
                arg0: number,
                arg1: string
              ): {
                (): any;
                new (): any;
                toString: { (): string; new (): any };
              };
              new (): any;
            };
          };
        };
      };
    }): void;
    (tickets: string | any[]): void;
    (arg0: any): void;
  },
    category: string | any[],
) {
  let searchText = '';
  for (let i = 0; i < category.length; i++) {
    if (i == 0) {
      searchText += `= '${category[i]}'`;
    } else {
      searchText += ` OR category = '${category[i]}'`;
    }
  }

  const searchDB = db
      .prepare(
        `select * from supportees where status = 'open' ` +
        `and (category ${category.length > 0 ? searchText : 'is NULL'})`,
      )
      .all();

  callback(searchDB);
};

export {open, add, check, getOpen, checkBan, getId, closeAll, reopen};

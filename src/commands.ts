import * as db from './db';
import cache from './cache';
import * as middleware from './middleware';
import { Context } from './interfaces';
import { log } from '~/utils'

/**
 * Display help depending on the group
 * @param {Object} ctx
 */
function helpCommand(ctx: Context) {
  if (!ctx.session.admin) {
    middleware.reply(ctx, cache.config.language.helpCommandText, {
      parse_mode: cache.config.parse_mode,
    });
  } else {
    middleware.reply(ctx, cache.config.language.helpCommandStaffText, {
      parse_mode: cache.config.parse_mode,
    });
  }
}

/**
 * Close all open tickets
 * @param {Object} ctx
 */
function clearCommand(ctx: Context) {
  if (!ctx.session.admin) return;
  db.closeAll();
  // cache.ticketIDs.length = 0;
  cache.ticketIDs.clear();
  cache.ticketStatus.length = 0;
  cache.ticketSent.length = 0;
  middleware.reply(
    ctx,
    'All tickets closed.',
    { parse_mode: cache.config.parse_mode }, /* .notifications(false) */
  );
}

/**
 * Display open tickets
 * @param {Object} ctx
 */
function openCommand(ctx: Context) {
  if (!ctx.session.admin) return;
  const groups: any = [];
  // Search all labels for this group
  if (
    cache.config.categories !== undefined &&
    cache.config.categories.length > 0
  ) {
    cache.config.categories.forEach((element: any, index: number) => {
      // No subgroup
      if (element.subgroups == undefined) {
        if (element.group_id == ctx.chat.id) {
          groups.push(element.name);
        }
      } else {
        element.subgroups.forEach(
          (innerElement: { group_id: any; name: any }, index: any) => {
            if (innerElement.group_id == ctx.chat.id) {
              groups.push(innerElement.name);
            }
          },
        );
      }
    });
  }
  // Get open tickets for any maintained label
  db.open(function (userList: any) {
    let openTickets = '';

    for (const i in userList) {
      if (
        userList[i]['userid'] !== null &&
        userList[i]['userid'] !== undefined
      ) {
        let ticketInfo = '';
        if (userList[i]['userid'].toString().indexOf('WEB') > -1) {
          ticketInfo = '(web)';
        }
        if (userList[i]['userid'].toString().indexOf('SIGNAL') > -1) {
          ticketInfo = '(signal)';
        }
        openTickets +=
          '#T' +
          userList[i]['id'].toString().padStart(6, '0').toString() +
          ' ' +
          ticketInfo +
          '\n';
      }
    }
    middleware.reply(
      ctx,
      `*${cache.config.language.openTickets}*\n\n${openTickets || cache.config.language.noOpenTickets}`,
      // eslint-disable-next-line new-cap
      { parse_mode: cache.config.parse_mode }, /* .notifications(false) */
    );
  }, groups);
}

/**
 * Close ticket
 * @param {Object} ctx
 */
function closeCommand(ctx: Context) {
  if (!ctx.session.admin) return;
  const groups: any = [];
  // Search all labels for this group
  if (cache.config.categories) {
    cache.config.categories.forEach((element: any, index: number) => {
      // No subgroup
      if (
        cache.config.categories[index].subgroups == undefined ||
        cache.config.categories[index].subgroups.length == 0
        ) {
        if (cache.config.categories[index].group_id == ctx.chat.id) {
          groups.push(cache.config.categories[index].name);
        }
      } else {
        cache.config.categories[index].subgroups.forEach(
          (innerElement: { group_id: any; name: any }, index: any) => {
            if (innerElement.group_id == ctx.chat.id) {
              groups.push(innerElement.name);
            }
          },
        );
      }
    });
  }
  // Check if in reply to bot
  if (!ctx.message.reply_to_message.from.is_bot) {
    return;
  }
  // Get open tickets for any maintained label
  let replyText = ctx.message.reply_to_message.text;

  if (replyText == undefined) {
    replyText = ctx.message.reply_to_message.caption;
  }
  // Ticket ID
  let ticketId: any = -1;
  ticketId = replyText.match(
    new RegExp('#T' + '(.*)' + ' ' + cache.config.language.from),
  );
  if (ticketId) {
    ticketId = ticketId[1];
  }
  if (ticketId == undefined) {
    return;
  }
  // get userid from ticketid
  db.open(function (tickets: any) {
    log({ label: 'closeCommand -> db.open -> cb (tickets)', type: 'info', msgs: [
      tickets, // SAMPLE: { id: 5, userid: '432590698', status: 'open', category: null }[]
    ] })
    if (tickets == undefined) {
      console.log('Close command: tickets undefined');
      return;
    }
    let userid = 0;
    for (let i = 0; i < tickets.length; i++) {
      if (tickets[i].id.toString().padStart(6, '0') == ticketId) {
        db.add(tickets[i].userid, 'closed', tickets[i].category);
      }
      userid = tickets[i].userid;
    }
    middleware.reply(
      ctx,
      [
        cache.config.language.ticket,
        `#T${ticketId.toString().padStart(6, '0')}`,
        cache.config.language.closed
      ].join(' '),
      // eslint-disable-next-line new-cap
      { parse_mode: cache.config.parse_mode }, /* .notifications(false) */
    );
    middleware.msg(
      userid,
      [
        cache.config.language.ticket,
        `#T${ticketId.toString().padStart(6, '0')}`,
        `${cache.config.language.closed}\n\n${cache.config.language.ticketClosed}`,
      ].join(' '),
      { parse_mode: cache.config.parse_mode }, /* .notifications(false) */
    );
    // delete cache.ticketIDs[userid];
    cache.ticketIDs.delete(userid);
    delete cache.ticketStatus[userid];
    delete cache.ticketSent[userid];
  }, groups);
}

/**
 * Ban user
 * @param {Object} ctx
 */
function banCommand(ctx: Context) {
  if (!ctx.session.admin) return;
  // Get open tickets for any maintained label
  const replyText = ctx.message.reply_to_message.text;

  let ticketId: any = -1;
  ticketId = replyText.match(
    new RegExp('#T' + '(.*)' + ' ' + cache.config.language.from),
  );
  if (ticketId) {
    ticketId = ticketId[1];
  }
  if (ticketId == undefined) {
    return;
  }

  // get userid from ticketid
  db.getId(
    ticketId,
    (ticket: { userid: string; id: { toString: () => string } }) => {
      db.add(Number(ticket.userid), 'banned', '');

      middleware.msg(
        ctx.chat.id,
        cache.config.language.usr_with_ticket +
        ' #T' +
        ticket.id.toString().padStart(6, '0') +
        ' ' +
        cache.config.language.banned,
        { parse_mode: cache.config.parse_mode }, /* .notifications(false) */
      );
    },
  );
}

/**
 * Reopen ticket
 * @param {Object} ctx
 */
function reopenCommand(ctx: Context) {
  if (!ctx.session.admin) return;
  // Get open tickets for any maintained label
  const replyText = ctx.message.reply_to_message.text;

  let ticketId: any = -1;
  ticketId = replyText.match(
    new RegExp('#T' + '(.*)' + ' ' + cache.config.language.from),
  );
  if (ticketId) {
    ticketId = ticketId[1];
  }
  if (ticketId == undefined) {
    return;
  }

  // get userid from ticketid
  db.getId(
    ticketId,
    function (ticket?: { userid: string; id: number }) {
      log({ label: `reopenCommand -> db.getId(${ticketId}) -> cb (before db.reopen)`, type: 'info', msgs: [
        `ticketId= ${ticketId} (${typeof ticketId})`, // SAMPLE: ticketId= 000004 (string)
        'ticket object:',
        ticket, // SAMPLE: { id: 5, userid: '432590698', status: 'closed', category: null }
      ] })

      db.reopen(ticket.id, null);

      middleware.msg(
        ctx.chat.id,
        [
          cache.config.language.usr_with_ticket,
          `#T${ticket.id.toString().padStart(6, '0')}`,
          cache.config.language.ticketReopened,
        ].join(' '),
        { parse_mode: cache.config.parse_mode }, /* .notifications(false) */
      );

      middleware.msg(
        ticket.userid,
        [
          `#T${ticket.id.toString().padStart(6, '0')}`,
          cache.config.language.ticketReopened,
        ].join(' '),
        { parse_mode: cache.config.parse_mode }, /* .notifications(false) */
      );
    },
  );
}

/**
 * Unban user
 * @param {Object} ctx
 */
function unbanCommand(ctx: Context) {
  if (!ctx.session.admin) return;
  // Get open tickets for any maintained label
  const replyText = ctx.message.reply_to_message.text;

  let ticketId: any = -1;
  ticketId = replyText.match(
    new RegExp('#T' + '(.*)' + ' ' + cache.config.language.from),
  );
  if (ticketId) {
    ticketId = ticketId[1];
  }
  if (ticketId == undefined) {
    return;
  }

  // get userid from ticketid
  db.getId(
    ticketId,
    (ticket: { userid: string; id: { toString: () => string } }) => {
      db.add(Number(ticket.userid), 'closed', '');
      middleware.msg(
        ctx.chat.id,
        cache.config.language.usr_with_ticket +
        ' #T' +
        ticket.id.toString().padStart(6, '0') +
        ' ' +
        'unbanned',
        { parse_mode: cache.config.parse_mode },
        /* .notifications(false) */
      );
    }
  );
}

export {
  banCommand,
  openCommand,
  closeCommand,
  unbanCommand,
  clearCommand,
  reopenCommand,
  helpCommand,
};

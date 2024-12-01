import cache from './cache';
import * as middleware from './middleware';
import * as db from './db';
import { Context, TMessage } from './interfaces';
import { log } from '~/utils';

/** Message template helper
 * @param {String} name
 * @param {Object} message
 * @param {Boolean} anon
 * @return {String} text
 */
function ticketMsg(
  name: string,
  message: TMessage
) {
  log({ label: 'staff: ticketMsg(name, message)', type: 'info', msgs: [
    name,
    message,
  ] })

  const esc: any = middleware.strictEscape;
  if (cache.config.clean_replies) {
    return [
      `${esc(message.text)} // ${esc(message.from.first_name)}`,
      '\n\n--- _Original message_ ---\n',
      esc(message.reply_to_message.text || message.reply_to_message.caption || 'No text or caption'),
      '\n---',
    ].join('');
  }
  if (cache.config.anonymous_replies) {
    return [
      `${cache.config.language.dear} ${esc(name)}`,
      '\n\n',
      esc(message.text),
      '\n\n',
      cache.config.language.regards,
      '\n',
      cache.config.language.regardsGroup,
      '\n\n--- _Original message_ ---\n',
      esc(message.reply_to_message.text || message.reply_to_message.caption || 'No text or caption'),
      '\n---',
    ].join('');
  }
  return [
    `${cache.config.language.dear} ${esc(name)},`,
    '\n\n',
    esc(message.text),
    '\n',
    `${cache.config.language.regards} // ${esc(message.from.first_name)}`,
    '\n\n--- _Original message_ ---\n',
    esc(message.reply_to_message.text || message.reply_to_message.caption || 'No text or caption'),
    '\n---',
  ].join('');
}

/**
 * Private chat
 * @param {Object} ctx
 * @param {Object} msg
 */
function privateReply(ctx: Context) {
  log({ label: 'staff: privateReply(ctx, msg)', type: 'info', msgs: [
    ctx.message,
  ] })

  // Msg to other end
  middleware.msg(
    ctx.session.modeData.userid,
    ticketMsg(` ${ctx.session.modeData.name}`, ctx.message),
    {
      parse_mode: cache.config.parse_mode,
      reply_markup: {
        html: '',
        inline_keyboard: [
          [
            cache.config.direct_reply
              ? {
                text: cache.config.language.replyPrivate,
                url: `https://t.me/${ctx.from.username}`,
              }
              : {
                text: cache.config.language.replyPrivate,
                callback_data:
                  ctx.from.id +
                  '---' +
                  ctx.message.from.first_name +
                  '---' +
                  ctx.session.modeData.category +
                  '---' +
                  ctx.session.modeData.ticketid,
              },
          ],
        ],
      },
    },
  );
  // Confirmation message
  middleware.msg(ctx.chat.id, cache.config.language.msg_sent, {});
}

/**
 * Reply to tickets in staff chat.
 * @param {Context} ctx Bot context.
 */
function chat(ctx: Context) {
  let replyText = '';
  // check whether person is an admin
  if (!ctx.session.admin) {
    return;
  }
  // try whether a text or an image/video is replied to
  try {
    // replying to non-ticket
    if (ctx.message == undefined || ctx.message.reply_to_message == undefined) {
      return;
    }
    replyText = ctx.message.reply_to_message.text;
    if (typeof replyText === 'undefined') {
      replyText = ctx.message.reply_to_message.caption;
    }

    let userid = replyText.match(
      new RegExp('#T' + '(.*)' + ' ' + cache.config.language.from),
    );
    if (userid === null || userid === undefined) {
      userid = replyText.match(
        new RegExp('#T' + '(.*)' + '\n' + cache.config.language.from),
      );
    }

    // replying to non-ticket
    if (userid === null || userid === undefined) {
      return;
    }

    db.getOpen(
      Number(userid[1]),
      ctx.session.groupCategory,
      function (ticket: { userid: string }) {
        if (userid === null || userid === undefined) {
          return;
        }
        const name = replyText.match(
          new RegExp(
            cache.config.language.from +
            ' ' +
            '(.*)' +
            ' ' +
            cache.config.language.language,
          ),
        );
        // replying to closed ticket
        if (userid === null || ticket == undefined) {
          middleware.reply(ctx, cache.config.language.ticketClosedError);
        }

        // replying to non-ticket
        if (ticket == undefined || name == null || name == undefined) {
          return;
        }
        cache.ticketStatus[userid[1]] = false;

        // To user
        // Web user
        if (ticket.userid.indexOf('WEB') > -1) {
          try {
            const socketId = ticket.userid.split('WEB')[1];
            cache.io
              .to(socketId)
              .emit('chat_staff', ticketMsg(name[1], ctx.message));
          } catch (e) {
            // To staff msg error
            middleware.msg(
              ctx.chat.id,
              `Web chat already closed.`,
              {
                parse_mode: cache.config.parse_mode,
              }, /* .notifications(false) */
            );
            console.log(e);
          }
        } else {
          middleware.msg(
            ticket.userid,
            ticketMsg(name[1], ctx.message),
            // eslint-disable-next-line new-cap
            { parse_mode: cache.config.parse_mode },
          );
        }
        const esc: any = middleware.strictEscape;
        // To staff msg sent
        middleware.msg(
          ctx.chat.id,
          `${cache.config.language.msg_sent} ${esc(name[1])}`,
          // eslint-disable-next-line new-cap
          { parse_mode: cache.config.parse_mode }, /* .notifications(false) */
        );
        // console.log(`Answer: ` + ticketMsg(name[1], ctx.message));
        // cache.ticketSent[userid[1]] = null;
        cache.ticketSent.delete(Number(userid[1]))
        // Check if auto close ticket
        if (cache.config.auto_close_tickets) {
          if (!isNaN(Number(userid[1])))
            db.add(Number(userid[1]), 'closed', null)
          else {
            log({ label: 'staff // chat -> db.getOpen Error (db.add not called)', type: 'error', msgs: [
              `userid: ${String(userid)} (${typeof userid})`,
              `userid[1]: ${userid[1]} (${typeof userid[1]})`,
            ] })
            throw new Error('ERR: staff // chat -> db.getOpen Error (db.add not called)')
          }
        }
      },
    );
  } catch (e: Error | any) {
    console.log(e);
    middleware.msg(
      cache.config.staffchat_id,
      `An error occured, please report this to your admin:\n\n${e?.message || 'No err?.message'}`,
      // eslint-disable-next-line new-cap
      { parse_mode: cache.config.parse_mode }, /* .notifications(false) */
    );
  }
}

export { privateReply, chat };

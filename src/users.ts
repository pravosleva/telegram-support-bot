import { Context } from './interfaces';
import cache from './cache';
import * as db from './db';
import * as middleware from './middleware';
import { log } from '~/utils';

/** Message template helper
 * @param {String} ticket
 * @param {Object} message
 * @param {Boolean} anon
 * @param {String} autoReplyInfo
 * @return {String} text
 */
function ticketMsg(
  ticket: { toString: () => string },
  message: {
    from: { first_name: string | any[]; language_code: any };
    text: string | any[];
  },
  tag: string,
  anon = true,
  autoReplyInfo: any,
) {
  let link = '';
  if (!anon) {
    link = `tg://user?id=${cache.ticketID}`;
  }
  const esc: any = middleware.strictEscape;
  return (
    `${cache.config.language.ticket} ` +
    `#T${ticket.toString().padStart(6, '0')} ${cache.config.language.from} ` +
    `[${esc(message.from.first_name)}](${link})` +
    ` ${cache.config.language.language}: ` +
    `${message.from.language_code} ${tag}\n\n` +
    `${esc(message.text)}\n\n` +
    (autoReplyInfo ? `_${autoReplyInfo}_` : '')
  );
}

/** Ticket auto reply for common questions
 * @param {context} ctx Bot context.
 * @param {bot} bot Bot object.
 * @param {chat} chat Bot chat.
 * @return {boolean}
 */
function autoReply(ctx: Context) {
  const strings = cache.config.autoreply;
  for (const i in strings) {
    if (ctx.message.text.toString().indexOf(strings[i]['question']) > -1) {
      // Define message
      const msg = cache.config.clean_replies ? strings[i]['answer'] :
        `${cache.config.language.dear} ` +
        `${ctx.message.from.first_name},\n\n` +
        `${strings[i]['answer']}\n\n` +
        `${cache.config.language.regards}\n` +
        `${cache.config.language.automatedReplyAuthor}\n\n` +
        `_${cache.config.language.automatedReply}_`;

      // Send message with keyboard
      middleware.reply(ctx, msg, { parse_mode: cache.config.parse_mode });
      return true;
    }
  }
  return false;
}

/**
 * Ticket handling and spam protection.
 * @param {context} ctx Bot context.
 * @param {chat} chat Bot chat.
 */
function chat(ctx: Context, chat: { id: number; first_name: string; username?: string; type: string; }) {
  cache.setTicketID(ctx.message.from.id);

  // Check if auto reply works
  let isAutoReply = false;
  if (autoReply(ctx)) {
    isAutoReply = true;
    if (!cache.config.show_auto_replied) {
      return;
    }
  }
  const autoReplyInfo = isAutoReply ?
    cache.config.language.automatedReplySent :
    undefined;

  // if (cache.ticketIDs[cache.ticketID] === undefined) {
  //   cache.ticketIDs.push(cache.ticketID);
  // }
  if (!cache.ticketIDs.has(cache.ticketID)) {
    cache.ticketIDs.add(cache.ticketID)
  }
  cache.ticketStatus[cache.ticketID] = true;

  const ticketSentCounterFromCache = cache.ticketSent.get(cache.ticketID)
  switch (true) {
    case typeof ticketSentCounterFromCache === 'undefined':
      // NOTE: 1. Was not sent early
      // log({ label: 'users:case1 // Was not sent early', msgs: [
      //   `cache.ticketID: ${cache.ticketID} (${typeof cache.ticketID})`,
      // ] })

      // Get Ticket ID from DB
      db.getOpen(
        chat.id,
        ctx.session.groupCategory,
        (ticket) => {
          if (!isAutoReply && cache.config.autoreply_confirmation) {
            middleware.msg(
              chat.id,
              [
                cache.config.language.confirmationMessage,
                cache.config.show_user_ticket
                  ? `\n${cache.config.language.ticket} #T${ticket.id.toString().padStart(6, '0')}`
                  : ''
              ].join(''),
            );
          }

          // To staff
          middleware.msg(
            cache.config.staffchat_id,
            ticketMsg(
              ticket.id,
              ctx.message,
              ctx.session.groupTag,
              cache.config.anonymous_tickets,
              autoReplyInfo,
            ),
            { parse_mode: cache.config.parse_mode },
          );

          // Check if group flag is set and is not admin chat
          if (
            !!ctx.session.group &&
            ctx.session.group != cache.config.staffchat_id
          ) {
            // Send to group-staff chat
            middleware.msg(
              ctx.session.group,
              ticketMsg(
                ticket.id,
                ctx.message,
                ctx.session.groupTag,
                cache.config.anonymous_tickets,
                autoReplyInfo,
              ),
              cache.config.allow_private ?
                {
                  parse_mode: cache.config.parse_mode,
                  reply_markup: {
                    html: '',
                    inline_keyboard: [
                      [
                        {
                          text: cache.config.language.replyPrivate,
                          callback_data:
                            ctx.from.id +
                            '---' +
                            ctx.message.from.first_name +
                            '---' +
                            ctx.session.groupCategory +
                            '---' +
                            ticket.id,
                        },
                      ],
                    ],
                  },
                } :
                {
                  parse_mode: cache.config.parse_mode
                },
            );
          }
        },
      );
      // wait 5 minutes before this message appears again and do not
      // send notification sounds in that time to avoid spam
      setTimeout(function () {
        // cache.ticketSent[cache.ticketID] = undefined;
        cache.ticketSent.delete(cache.ticketID)
      }, cache.config.spam_time);
      cache.ticketSent.set(cache.ticketID, 0);
      break
    case ticketSentCounterFromCache < cache.config.spam_cant_msg:
      // NOTE: 2. Could be sent again
      // log({ label: 'users:case2 // Could be sent again', msgs: [
      //   `cache.ticketID: ${cache.ticketID} (${typeof cache.ticketID})`,
      // ] })

      // cache.ticketSent[cache.ticketID]++;
      cache.ticketSent.set(cache.ticketID, ticketSentCounterFromCache + 1)

      db.getOpen(
        cache.ticketID,
        ctx.session.groupCategory,
        function (ticket: { id: { toString: () => string } }) {
          middleware.msg(
            cache.config.staffchat_id,
            ticketMsg(
              ticket.id,
              ctx.message,
              ctx.session.groupTag,
              cache.config.anonymous_tickets,
              autoReplyInfo,
            ),
            { parse_mode: cache.config.parse_mode },
          );
          if (
            !!ctx.session.group &&
            ctx.session.group != cache.config.staffchat_id
          ) {
            middleware.msg(
              ctx.session.group,
              ticketMsg(
                ticket.id,
                ctx.message,
                ctx.session.groupTag,
                cache.config.anonymous_tickets,
                autoReplyInfo,
              ),
              { parse_mode: cache.config.parse_mode },
            );
          }
        },
      );
      break
    case ticketSentCounterFromCache >= cache.config.spam_cant_msg:
      // NOTE: 3. Cant be sent again
      // log({ label: '- users:case3 // Cant be sent again', msgs: [
      //   `cache.ticketID: ${cache.ticketID} (${typeof cache.ticketID})`,
      // ] })

      // cache.ticketSent[cache.ticketID]++;
      cache.ticketSent.set(cache.ticketID, ticketSentCounterFromCache + 1)

      middleware.msg(chat.id, cache.config.language.blockedSpam, {
        parse_mode: cache.config.parse_mode,
      });
      break
    default:
      break
  }
  
  // log({ label: 'users:common', msgs: [
  //   `cache.ticketID: ${cache.ticketID} (${typeof cache.ticketID})`,
  // ] })

  db.getOpen(
    cache.ticketID,
    ctx.session.groupCategory,
    function (ticket: { id: { toString: () => string } }) {
      // log({ label: '(!!) users: db.getOpen -> cb' , msgs: [] });
      ticketMsg(
        ticket.id,
        ctx.message,
        ctx.session.groupTag,
        cache.config.anonymous_tickets,
        autoReplyInfo,
      );
    },
  );
}

export { chat };

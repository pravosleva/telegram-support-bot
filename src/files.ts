import * as db from './db';
import cache from './cache';
import * as middleware from './middleware';
import TelegramAddon from './addons/telegram';
import {Context, ModeData} from './interfaces';
import { log } from '~/utils'

/**
 * Helper for private reply
 * @param {Object} ctx
 * @return {Object}
 */
function replyMarkup(ctx: Context): object {
  return {
    html: '',
    inline_keyboard: [
      [
        cache.config.direct_reply ?
          {
            text: cache.config.language.replyPrivate,
            url: `https://t.me/${ctx.from.username}`,
          } :
          {
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
  };
}

/**
 * Forward video files to staff.
 * @param {string} type document, photo, video.
 * @param {bot} bot Bot object.
 * @param {context} ctx Bot context.
 */
function fileHandler(type: string, bot: TelegramAddon, ctx: Context) {
  // replying to non-ticket
  let userid: RegExpMatchArray | null;
  let replyText: string;
  if (
    ctx.message !== undefined &&
    ctx.message.reply_to_message !== undefined &&
    ctx.session.admin
  ) {
    replyText = ctx.message.reply_to_message.text;
    if (typeof replyText === 'undefined') replyText = ctx.message.reply_to_message.caption;
    if (!replyText) throw new Error('ERR: No replyText!')
    
    userid = replyText.match(new RegExp('#T' + '(.*)' + ' ' + cache.config.language.from));

    if (userid === null || userid === undefined) {
      userid = replyText.match(new RegExp('#T' + '(.*)' + '\n' + cache.config.language.from));
    }

    log({ label: 'files: fileHandler', msgs: [
      `replyText= ${replyText} (${typeof replyText})`,
      `userid= ${userid} (${typeof userid})`,
    ] })

    // replying to non-ticket
    if (userid == null) return;
  }
  forwardFile(
    ctx,
    (userInfo: string) => {
      // console.log(`--- userInfo: ${userInfo} (${typeof userInfo})`)
      let receiverId = cache.config.staffchat_id;
      let msgId = ctx.message.chat.id;
      let isPrivate = false;

      // if (userid === null || userid === undefined) {
      //   return;
      // }
      // if admin
      if (ctx.session.admin && userInfo === undefined) {
        // null check here
        if (userid != null) {
          msgId = Number(userid[1]);
        } else {
          return;
        }
      }
      db.getOpen(
          msgId,
          ctx.session.groupCategory,
          async function(ticket: any) {
            if (ticket == undefined) {
              if (ctx.session.admin && userInfo === undefined) {
              // replying to closed ticket
                middleware.reply(ctx, cache.config.language.ticketClosedError);
              } else {
                middleware.reply(ctx, cache.config.language.textFirst);
              }
              return;
            }
            const msgLines: string[] = [
              `${cache.config.language.ticket} #T${ticket.id.toString().padStart(6, '0')} ${userInfo}`,
            ]
            // let captionText = []
            // cache.config.language.ticket +
            // ' #T' +
            // ticket.id.toString().padStart(6, '0') +
            // ' ' +
            // userInfo +
            if (!!ctx.message.caption) {
              // msgLines.push('\n')
              msgLines.push(ctx.message.caption)
            }
            // if (ctx.session.admin && !userInfo) {
            //   receiverId = ticket.userid;
            // }
            if (!!ctx.session.modeData.userid) {
              receiverId = ctx.session.modeData.userid;
              isPrivate = true;
            }
            const fileId = (await ctx.getFile()).file_id;
            switch (type) {
              case 'document':
                bot.sendDocument(receiverId, fileId, {
                  caption: msgLines.join('\n\n'),
                  reply_markup: isPrivate ? replyMarkup(ctx) : {},
                });
                if (
                  !!ctx.session.group &&
                ctx.session.group !== cache.config.staffchat_id &&
                ctx.session.modeData != {} as ModeData
                ) {
                  bot.sendDocument(ctx.session.group, fileId, {
                    caption: msgLines.join('\n\n'),
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
                  });
                }
                break;
              case 'photo':
                // log({ label: 'files: forwardFile -> db.getOpen cb -> case photo', msgs: [
                //   'msgLines:',
                //   msgLines,
                //   `userInfo is ${userInfo} (${typeof userInfo})`, // SAMPLE: from Den Language: ru\n\n
                // ] })

                bot.sendPhoto(receiverId, fileId, {
                  caption: msgLines.join('\n\n'),
                  reply_markup: isPrivate ? replyMarkup(ctx) : {},
                });
                if (
                  !!ctx.session.group
                  && ctx.session.group !== cache.config.staffchat_id
                  && ctx.session.modeData != {} as ModeData
                ) {
                  bot.sendPhoto(ctx.session.group, fileId, {
                    caption: msgLines.join('\n\n'),
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
                  });
                }
                break;
              case 'video':
                bot.sendVideo(receiverId, fileId, {
                  caption: msgLines.join('\n\n'),
                  reply_markup: isPrivate ? replyMarkup(ctx) : {},
                });
                if (
                  !!ctx.session.group &&
                ctx.session.group !== cache.config.staffchat_id &&
                ctx.session.modeData != {} as ModeData
                ) {
                  bot.sendVideo(ctx.session.group, fileId, {
                    caption: msgLines.join('\n\n'),
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
                  });
                }
                break;
            }
            // Confirmation message
            if (!cache.config.autoreply_confirmation) return;

            let message = ''

            const msgs = [
              cache.config.language.confirmationMessage,            
            ]
            if (!!cache.config.show_user_ticket) {
              msgs.push(`\n${cache.config.language.yourTicketId} #T${ticket.id.toString().padStart(6, '0')}`)
            }

            message = msgs.join('')

            // if admin
            if (ctx.session.admin && userInfo === undefined) {
              const name = replyText.match(new RegExp(`${cache.config.language.from} (.*) ${cache.config.language.language}`));

              if (name == null && name == undefined) return;

              message = `${cache.config.language.file_sent} ${name[1]}`;
            }
            middleware.msg(ctx.chat.id, message);
          },
      );
    }
  );
}

/**
 * Handle caching for sent files.
 * @param {context} ctx Bot context.
 * @param {callback} callback Bot callback.
 */
function forwardFile(
    ctx: Context,
    callback: (userInfo: string) => void
) {
  db.getOpen(
    ctx.message.from.id,
    ctx.session.groupCategory,
    function(ticket: any) {
      let ok = false;
      if (
        typeof ticket == 'undefined' ||
        ticket.status == undefined ||
        ticket.status == 'closed'
      ) {
        db.add(ctx.message.from.id, 'open', null);
        ok = true;
      }

      const sentTicketCounterFromCache = cache.ticketSent.get(cache.ticketID)
      switch (true) {
        case ok || (typeof ticket !== 'undefined' && ticket.status !== 'banned'):
          // NOTE: 1. Ticket exists & not banned
          switch (true) {
            case typeof sentTicketCounterFromCache === 'undefined':
              // NOTE: 1.1. Not exists in cache
              fowardHandler(ctx, function(userInfo) {
                callback(userInfo);
              });
              // wait 5 minutes before this message appears again and do not
              // send notificatoin sounds in that time to avoid spam
              setTimeout(function() {
                cache.ticketSent.delete(cache.ticketID);
              }, cache.config.spam_time);
              // cache.ticketSent[cache.ticketID] = 0;
              break
            case sentTicketCounterFromCache < cache.config.spam_cant_msg:
              // NOTE: 1.2. Not spam
              cache.ticketSent.set(cache.ticketID, sentTicketCounterFromCache + 1);
              // TODO: add { parse_mode: cache.config.
              // parse_mode }/* .notifications(false) */
              // property for silent notifications
              fowardHandler(ctx, function(userInfo) {
                callback(userInfo);
              });
              break
            case sentTicketCounterFromCache === cache.config.spam_cant_msg:
              // NOTE: 1.3. Its spam
              // cache.ticketSent[cache.ticketID]++;
              cache.ticketSent.set(cache.ticketID, sentTicketCounterFromCache + 1);
              middleware.msg(ctx.chat.id, cache.config.language.blockedSpam, {
                parse_mode: cache.config.parse_mode,
              });
              break
            default:
              break;
          }
          break
        default:
          break
      }
    },
  );
}

/**
 * Check if msg comes from user or admin.
 * @param {context} ctx Bot context.
 * @param {callback} callback Bot callback.
 */
function fowardHandler(
    ctx: Context,
    callback: (userInfo?: string) => void,
) {
  let userInfo;
  ctx.getChat().then(function(chat: { type: string }) {
    if (chat.type === 'private') {
      cache.setTicketID(ctx.message.from.id)
      userInfo =
        `${cache.config.language.from} ${ctx.message.from.first_name} ` +
        `${cache.config.language.language}: ` +
        `${ctx.message.from.language_code}`;

      if (ctx.session.group === undefined) {
        userInfo =
          `${cache.config.language.from} ${ctx.message.from.first_name} ` +
          `${cache.config.language.language}: ` +
          `${ctx.message.from.language_code}`;
      }
      // console.log(`--- userInfo: ${userInfo} (${typeof userInfo})`)
      callback(userInfo);
    } else {
      callback(undefined);
    }
  });
}

export {fileHandler, forwardFile, fowardHandler};

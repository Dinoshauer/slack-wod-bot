var Botkit = require('botkit'),
    moment = require('moment'),
    utils = require('./utils'),
    wod = require('./wod');

require('moment-range');

if (!process.env.SLACK_API_KEY) {
  console.log('Error: Specify SLACK_API_KEY in environment');
  process.exit(1);
}

if (!process.env.HEROKU_URL) {
  console.log('Warning: Running without keepalive');
} else {
  utils.keepAlive(process.env.HEROKU_URL);
}

var controller = Botkit.slackbot(),
    bot = controller.spawn({
      token: process.env.SLACK_API_KEY
    });

bot.startRTM(function (err, bot, payload) {
  if (err) {
    throw new Error('Could not connect to Slack');
  }
});

controller.hears(
  ['wipe wod list'],
  ['direct_message', 'direct_mention', 'mention'],
  function (bot, message) {
    console.log(message);

    bot.startConversation(message, function (error, convo) {
      convo.ask('Are you sure? Answer with "yes", "no"', [
        {
          pattern: bot.utterances.yes,
          callback: function(response, convo) {
            convo.say('I won\'t remember a thing!');
            wod.wipeWodList(function (err, res) {
              if (err) {
                console.log(err);
                convo.say('I couldn\'t wipe the list :(');
                convo.next();
              } else {
                convo.say('I forgot ' + res + ' WODs... :robot_face:');
                convo.next();
              }
            });
          }
        },
        {
          pattern: bot.utterances.no,
          callback: function(response, convo) {
            convo.say('Cool. I\'ll leave it for now :)');
            convo.next();
          }
        }
      ]);
    });

});

controller.hears(
  ['new wod list here: <(.*)>'],
  ['direct_message', 'direct_mention', 'mention', 'ambient'],
  function (bot, message) {
    bot.startConversation(message, function (error, convo) {
      convo.sayFirst('Great! I\'m going to download the list @ ' + message.match[1]);
      wod.downloadPdf(message.match[1], function (err, res) {
        if (err) {
          console.error('error!', err.statusCode);
          convo.say('Something happened when downloading the list :(');
          convo.stop();
        }
        console.log('Downloaded new list', res.statusCode);
        convo.say('List downloaded. Parsing. Meep, morp... Zorp.')
        wod.parseWodPdf(res.body, function (err, wods) {
          if (err) {
            console.error('error!', err);
            convo.say('Something bad happened when parsing the pdf! :<');
            convo.stop();
          }
          console.log('Parsed list');
          convo.say('I totally parsed that list! I\'ll try and save it now');
          wod.saveWodList(wods, function (err, results) {
            if (err) {
              console.error('error!', err);
              convo.say('I couldn\'t save the list to memory!');
              convo.stop();
            }
            console.log('List saved.')
            convo.say('Everything is great! I saved the list!');
          });
        });
      });
    });
});

controller.hears(
  ['wod today\??'],
  ['direct_message', 'direct_mention', 'mention', 'ambient'],
  function (bot, message) {
    var start = moment().startOf('day'),
        target = start;
    console.log(message);
    wod.replyWithWod(target, bot, message, 'today');
});

controller.hears(
  ['wod tomorrow\??'],
  ['direct_message', 'direct_mention', 'mention', 'ambient'],
  function (bot, message) {
    var start = moment().startOf('day'),
        target = start.add(1, 'day');
    console.log(message);
    wod.replyWithWod(target, bot, message, 'tomorrow');
});

controller.hears(
  ['wod yesterday\??'],
  ['direct_message', 'direct_mention', 'mention', 'ambient'],
  function (bot, message) {
    var start = moment().startOf('day'),
        target = start.subtract(1, 'day');
    console.log(message);
    wod.replyWithWod(target, bot, message, 'yesterday');
});

controller.hears(
  ['wod (mon|tues|wednes|thurs|fri|satur|sun)day\??'],
  ['direct_message', 'direct_mention', 'mention', 'ambient'],
  function (bot, message) {
    var start = moment().startOf('isoWeek'),
        target = start.day(message.match[1]);
    console.log(message);
    wod.replyWithWod(target, bot, message, message.match[1]);
});

controller.hears(
  ['wod next (mon|tues|wednes|thurs|fri|satur|sun)day\??'],
  ['direct_message', 'direct_mention', 'mention', 'ambient'],
  function (bot, message) {
    var start = moment().add(1, 'week').startOf('week'),
        target = start.day(message.match[1]);
    console.log(message);
    wod.replyWithWod(target, bot, message, message.match[1]);
});

controller.hears(
  ['wods next week\??'],
  ['direct_message', 'direct_mention', 'mention', 'ambient'],
  function (bot, message) {
    var start = moment().add(1, 'week').startOf('week'),
        end = moment().add(1, 'week').endOf('week'),
        targets = moment.range(start, end);
    console.log(message);

    targets.by('days', function (target) {
      wod.getWod(target.toISOString(), function (err, res) {
        wod.replyWithWod(target, bot, message, 'next ' + target.format('dddd'));
      });
    });
});

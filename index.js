var Botkit = require('botkit');
var config = require("config");

var token = config.get('token');

var allowed = [1, 2, 3, 5, 8, 13, 21, 40]

var controller = Botkit.slackbot({
    debug: true
});

controller.spawn({
    token: token
}).startRTM()


var sizing = {
  numberOfUsers: undefined,
  currentChannel: undefined,
  ticketNum: undefined,
  sizes: {}
}

function resetSizing() {
  sizing = {
    numberOfUsers: sizing.numberOfUsers,
    currentChannel: undefined,
    ticketNum: undefined,
    sizes: {}
  }
}

function findClosestNumber(num, allowed) {
  for (var i in allowed) {
    if (allowed[i] >= num)
      return allowed[i]
  }
  return allowed[allowed.length-1]
}

function getAverage(sizes) {
  var sum = 0;
  for (var i in sizes) {
    sum += sizes[i]
  }
  var average = sum / Object.keys(sizes).length
  return findClosestNumber(average, allowed)
}

function sizeCheck(size) {
  return allowed.indexOf(size) != -1
}

controller.hears(['^size$'], 'ambient,direct_mention,direct_message', function(bot,message) {
  sizing.currentChannel = message.channel;
  bot.startConversation(message, function(err,convo) {

    var askTicket = function(response, convo) {
      convo.ask('Which ticket? e.g. #12', function(response, convo) {
        if (response.text == 'cancel') {
          convo.say('Cancelled');
          convo.next();
        }
        sizing.ticketNum = response.text;
        convo.say("I am ready to size ticket " + sizing.ticketNum + " with " + sizing.numberOfUsers + " people")
        convo.next();
      })
    }
    convo.ask('How many people are sizing?', function(response, convo) {
      if (response.text == 'cancel') {
        convo.say('Cancelled');
        convo.next();
      }
      sizing.numberOfUsers = parseInt(response.text);
      convo.say('Cool, ' + sizing.numberOfUsers + ' people');
      askTicket(response, convo);
      convo.next();
    })
  })
})

controller.hears(['size for ([0-9]+) people'], 'ambient,direct_mention,direct_message', function(bot, message){
  sizing.numberOfUsers = parseInt(message.match[1]);
  bot.reply(message, "Ready to size tickets for " + sizing.numberOfUsers + ' people');
})

controller.hears(['(#.*)'], 'ambient,direct_mention,message_received,direct_message', function(bot, message) {
  resetSizing();
  sizing.ticketNum = message.match[1];
  sizing.currentChannel = message.channel;
  bot.reply(message,"Let's size ticket " + sizing.ticketNum + " with " + sizing.numberOfUsers + " people");
})

controller.hears(['([0-9]+)'],'ambient,direct_message,message_received,direct_mention',function(bot, message) {
  var size = parseInt(message.match[1]);
  if (!sizeCheck(size)) {
    bot.reply(message, "Only these numbers are allowed: " + allowed.toString());
    return;
  }
  bot.reply(message, "You have given ticket "+ sizing.ticketNum + " a size of " + size);
  bot.api.users.info({user: message.user}, function(err, response) {
    sizing.sizes[response.user.name] = size;

    // tell the initiator this user has sized
    bot.say( {
      text: response.user.name + ' has sized ticket ', //+ sizing.ticketNum
      channel: sizing.currentChannel
    })

    if (Object.keys(sizing.sizes).length == sizing.numberOfUsers) {
      var average = getAverage(sizing.sizes)
      var text = 'Result for ticket ' + sizing.ticketNum + ': \n';
      for (var name in sizing.sizes) {
        text += name + ': ' + sizing.sizes[name] + '\n';
      }
      bot.say( {
        text: text + 'Size: ' + average,
        channel: sizing.currentChannel
      })
      resetSizing();
    }
  })

})

const Discord = require("discord.js");
const config = require("./config.json");

const fetch = require('node-fetch');
const colors = require('colors');
const mergeImages = require('merge-images-v2');
const Canvas = require('canvas');
const fs = require("fs");
const axios = require('axios');
const cheerio = require('cheerio');
const {
  Readable
} = require('stream');
const rename = require('rename');
var schedule = require('node-schedule');

const client = new Discord.Client();

client.on("ready", () => {
  console.log(`++ Bot Online\n`.bold.brightWhite + `Servers > `.brightYellow + `${client.guilds.size}\n`.brightRed + `Channels > `.brightYellow + `${client.channels.size}\n`.brightRed + `Users > `.brightYellow + `${client.users.size}`.brightRed);
  schedule.scheduleJob('*/1 * * * * *', function() {
    onPlanetUpdate();
  });
});

client.login(config.token);

function errorEmbed(error, correct) {
  var embed = new Discord.RichEmbed()
    .setTitle('Error')
    .setColor('#ff0000')
    .addField(error, correct);
  return embed;
}

function decodeBase64Image(dataString) {
  var matches = dataString.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/),
    response = {};
  if (matches.length !== 3) {
    return new Error('Invalid input string');
  }
  response.type = matches[1];
  response.data = new Buffer(matches[2], 'base64');
  return response;
}

Object.prototype.getByIndex = function(index) {
  return this[Object.keys(this)[index]];
};

const playerdata = JSON.parse(fs.readFileSync("./playerdata.json", "utf8"));
const planets = JSON.parse(fs.readFileSync("./planets.json", "utf8"));

var activePlanets = [];

function onPlanetUpdate() {
  //for (var i = 0; i < Object.keys(playerdata).length; i++) {
  //  playerdata.getByIndex(i).current_planet = false;
  //}

  for (var i = 0; i < Object.keys(planets.planets).length; i++) {
    if (activePlanets.length < 5) {
      if (planets.planets.getByIndex(i).stats.active == true) {
        activePlanets.push(i);
      }
    }
  }

  //console.log(activePlanets);
  /*var currentPlanet = planets.planets.getByIndex(Math.floor(Math.random() * Object.keys(planets.planets).length));
  while (currentPlanet.stats.name == planets.previous_planet) {
    currentPlanet = planets.planets.getByIndex(Math.floor(Math.random() * Object.keys(planets.planets).length));
  }
  planets.previous_planet = currentPlanet.stats.name;
  console.log(currentPlanet.stats.name);
  //client.channels.get('583416800696598571').send(currentPlanet.stats.name);*/

  fs.writeFile("./playerdata.json", JSON.stringify(playerdata), (err) => {
    if (err) console.error(err)
  });
  fs.writeFile("./planets.json", JSON.stringify(planets), (err) => {
    if (err) console.error(err)
  });
}

client.on("message", async message => {
  if (message.channel.id !== '583416800696598571') return; //id of saliensimulator channel, hardcoded bc bot is made for a specific server
  if (message.author.bot) return;
  if (message.content.indexOf(config.prefix) !== 0) return;
  //if (message.guild.id != 459435127932715008) return; //bot only works in Summer Saliens server
  var guildWhitelist = client.guilds.get('583416800264323074');

  const args = message.content.slice(config.prefix.length).trim().split(/ +/g);
  const command = args.shift().toLowerCase();

  const getUserID = message.author.id;

  if (command === "register") {
    var playerSteamID;
    if (args.length == 1) {
      if (args[0] == parseInt(args[0], 10)) {
        var parsedID = args[0];
        if (parsedID.length == 17) {
          playerSteamID = parsedID;
          if (!playerdata[message.author.id]) {
            playerdata[message.author.id] = {
              name: `${message.author.username}`,
              xp: 0,
              rank: 0,
              steam64: `${playerSteamID}`,
              current_planet: false
            };
            var successEmbed = new Discord.RichEmbed()
              .setTitle(`Success!`)
              .setColor('#00ff00');
            message.channel.send(successEmbed);
          } else {
            message.channel.send(errorEmbed("User Aleady Registered", ">register steam64"));
          }
        } else {
          message.channel.send(errorEmbed("Not a Steam64 ID", ">register steam64"));
        }
      } else {
        message.channel.send(errorEmbed("Not a Steam64 ID", ">register steam64"));
      }
    } else if (args.length < 1) {
      message.channel.send(errorEmbed("Please Specify ID", ">register steam64"));
    } else {
      message.channel.send(errorEmbed("Too Many Arguments", ">register steam64"));
    }
  }

  if (command === "stats") {
    var userID;
    if (args.length == 1) {
      if (/((<@![0-9]{18}>)|[0-9]{18})/.test(args[0])) {
        if (/<@![0-9]{18}>/.test(args[0])) {
          userID = args[0].replace(/[<@!>]/g, '');
        } else {
          userID = args[0];
        }
        if (guildWhitelist.member(userID)) {
          if (playerdata[userID]) {
            axios.get(`https://steamcommunity.com/profiles/${playerdata[userID].steam64}`).then((response) => {
              const $ = cheerio.load(response.data)
              if ($('.salien_showcase').find('div').length != 0) {
                var body, arms, eyes, legs, mouth, shirt, hat;
                if ($('#showcase_salien_body').attr('src') != undefined) {
                  body = $('#showcase_salien_body').attr('src')
                } else {
                  body = './null.png'
                }
                if ($('#showcase_salien_arms').attr('src') != undefined) {
                  arms = $('#showcase_salien_arms').attr('src')
                } else {
                  arms = './null.png'
                }
                if ($('#showcase_salien_eyes').attr('src') != undefined) {
                  eyes = $('#showcase_salien_eyes').attr('src')
                } else {
                  eyes = './null.png'
                }
                if ($('#showcase_salien_legs').attr('src') != undefined) {
                  legs = $('#showcase_salien_legs').attr('src')
                } else {
                  legs = './null.png'
                }
                if ($('#showcase_salien_mouth').attr('src') != undefined) {
                  mouth = $('#showcase_salien_mouth').attr('src')
                } else {
                  mouth = './null.png'
                }
                if ($('#showcase_salien_shirt').attr('src') != undefined) {
                  shirt = $('#showcase_salien_shirt').attr('src')
                } else {
                  shirt = './null.png'
                }
                if ($('#showcase_salien_hat').attr('src') != undefined) {
                  hat = $('#showcase_salien_hat').attr('src')
                } else {
                  hat = './null.png'
                }
                mergeImages([body, arms, eyes, legs, mouth, {
                    src: shirt,
                    x: 0,
                    y: 250
                  }, hat], {
                    Canvas: Canvas
                  })
                  .then(b64 => {
                    client.fetchUser(userID).then(value => {
                      let data = b64
                      let imageBuffer = decodeBase64Image(data);
                      const attachment = new Discord.Attachment(imageBuffer.data, 'salien.png');
                      var statEmbed = new Discord.RichEmbed()
                        .setTitle(`Stats`)
                        .attachFile(attachment)
                        .setThumbnail('attachment://salien.png')
                        .addField("Salien Rank", `${playerdata[userID].rank}`)
                        .addField("Total XP", `${playerdata[userID].xp}`)
                        .setFooter(`${value.username}#${value.discriminator}`, `https://cdn.discordapp.com/avatars/${value.id}/${value.avatar}.jpg`)
                        .setTimestamp()
                        .setColor('#e9f634');
                      message.channel.send(statEmbed);
                    }).catch(console.error);
                  });
              } else {
                client.fetchUser(userID).then(value => {
                  const attachment = new Discord.Attachment('./salien_not_found.png', 'salien.png');
                  var statEmbed = new Discord.RichEmbed()
                    .setTitle(`Stats`)
                    .attachFile(attachment)
                    .setThumbnail('attachment://salien.png')
                    .addField("Salien Rank", `${playerdata[userID].rank}`)
                    .addField("Total XP", `${playerdata[userID].xp}`)
                    .setFooter(`${value.username}#${value.discriminator}`, `https://cdn.discordapp.com/avatars/${value.id}/${value.avatar}.jpg`)
                    .setTimestamp()
                    .setColor('#e9f634');
                  message.channel.send(statEmbed);
                }).catch(console.error);
              }
            })
          } else {
            message.channel.send(errorEmbed("User Not Registered", ">register steam64"));
          }
        } else {
          message.channel.send(errorEmbed("User not found", ">stats user"));
        }
      } else {
        message.channel.send(errorEmbed("Please Specify a Valid User", ">stats user"));
      }
    } else if (args.length < 1) {
      message.channel.send(errorEmbed("Please Specify User", ">stats user"));
    } else {
      message.channel.send(errorEmbed("Too Many Arguments", ">stats user"));
    }
  }

  if (command === "testxp") {
    if (playerdata[getUserID]) {
      playerdata[getUserID].xp += 1;
    }
    message.channel.send(playerdata[getUserID].xp);
  }

  if (command === "activeplanets") {
    if (args.length == 0) {
      mergeImages(['./planets/planetbg.jpg', {
          src: `./planets/${planets.planets.getByIndex(activePlanets[0]).stats.image_filename}`,
          x: 733,
          y: 25,
          width: 410,
          height: 410
        }, {
          src: `./planets/${planets.planets.getByIndex(activePlanets[1]).stats.image_filename}`,
          x: 150,
          y: 58,
          width: 358,
          height: 358
        }, {
          src: `./planets/${planets.planets.getByIndex(activePlanets[4]).stats.image_filename}`,
          x: 550,
          y: 300,
          width: 154,
          height: 154
        }, {
          src: `./planets/${planets.planets.getByIndex(activePlanets[3]).stats.image_filename}`,
          x: 350,
          y: 450,
          width: 205,
          height: 205
        }, {
          src: `./planets/${planets.planets.getByIndex(activePlanets[2]).stats.image_filename}`,
          x: 650,
          y: 450,
          width: 256,
          height: 256
        }], {
          Canvas: Canvas,
          width: 1280,
          height: 720
        })
        .then(b64 => {
          let data = b64
          let imageBuffer = decodeBase64Image(data);
          const attachment = new Discord.Attachment(imageBuffer.data, 'planets.png');
          var apEmbed = new Discord.RichEmbed()
            .attachFile(attachment)
            .setImage('attachment://planets.png')
            .setColor('#e9f634')
            .addField(planets.planets.getByIndex(activePlanets[0]).stats.name, `${planets.planets.getByIndex(activePlanets[0]).stats.progress * 100}% Captured, ${planets.planets.getByIndex(activePlanets[0]).stats.total_joins} Players`)
            .addField(planets.planets.getByIndex(activePlanets[1]).stats.name, `${planets.planets.getByIndex(activePlanets[1]).stats.progress * 100}% Captured, ${planets.planets.getByIndex(activePlanets[1]).stats.total_joins} Players`)
            .addField(planets.planets.getByIndex(activePlanets[2]).stats.name, `${planets.planets.getByIndex(activePlanets[2]).stats.progress * 100}% Captured, ${planets.planets.getByIndex(activePlanets[2]).stats.total_joins} Players`)
            .addField(planets.planets.getByIndex(activePlanets[3]).stats.name, `${planets.planets.getByIndex(activePlanets[3]).stats.progress * 100}% Captured, ${planets.planets.getByIndex(activePlanets[3]).stats.total_joins} Players`)
            .addField(planets.planets.getByIndex(activePlanets[4]).stats.name, `${planets.planets.getByIndex(activePlanets[4]).stats.progress * 100}% Captured, ${planets.planets.getByIndex(activePlanets[4]).stats.total_joins} Players`);
          message.channel.send(apEmbed);
        });
    } else {
      message.channel.send(errorEmbed("Command takes no arguments", ">activeplanets"));
    }
  }

  if (command === "help") {
    if (args.length == 0) {
      var helpEmbed = new Discord.RichEmbed()
        .setTitle(`Commands`)
        .addField(">register steam64", `Register to start playing`)
        .addField(">stats user", `Returns user's Salien stats (user can be a ping or id)`)
        .addField(">activeplanets", `Lists active planets and their progress`)
        .setThumbnail('https://cdn.discordapp.com/emojis/462711870512562176.gif?v=1')
        .setColor('#e9f634');
      message.channel.send(helpEmbed);
    } else {
      message.channel.send(errorEmbed("Command takes no arguments", ">help"));
    }
  }

  fs.writeFile("./playerdata.json", JSON.stringify(playerdata), (err) => {
    if (err) console.error(err)
  });

});

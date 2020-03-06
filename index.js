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
  setInterval(function() {
    onPlanetUpdate();
  }, 1000);
  /*let channel = client.channels.get('685257949429366846');
  channel.join().then(connection => {
    function play(aud) {
      const dispatcher = aud.playFile('./battle.mp3', {volume: 1});
      dispatcher.on('end', () => {
        console.log("end");
        play(connection);
      });
    }
    play(connection)
  })*/
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

const delay = ms => new Promise(res => setTimeout(res, ms));

const playerdata = JSON.parse(fs.readFileSync("./playerdata.json", "utf8"));
const planets = JSON.parse(fs.readFileSync("./planets.json", "utf8"));

var activePlanets;

function onPlanetUpdate() {
  activePlanets = [];

  for (var i = 0; i < Object.keys(planets.planets).length; i++) {
    if (activePlanets.length < 5) {
      if (planets.planets.getByIndex(i).stats.active == true) {
        activePlanets.push(i);
      }
    }
  }

  //console.log(activePlanets);

  for (var i = 0; i < activePlanets.length; i++) {
    var activate;
    var indexPlanet = planets.planets.getByIndex(activePlanets[i]);
    if (indexPlanet.stats.progress >= 1) {
      //client.channels.get('583416800696598571').send(`!!! Planet ${activePlanets[i]} Captured`);
      activate = planets.planets.findIndex(planet => (planet.stats.active === false) && (planet.stats.progress < 1));
      indexPlanet.stats.active = false;
      planets.planets.getByIndex(activate).stats.active = true;
      activePlanets = [];
    } else {
      var progDiv = 0;
      for (var n = 0; n < 96; n++) {
        progDiv += indexPlanet.zones.getByIndex(n).progress;
      }
      progDiv = progDiv / 96;
      indexPlanet.stats.progress = progDiv;
    }
  }

  fs.writeFile("./planets.json", JSON.stringify(planets), (err) => {
    if (err) console.error(err)
  });
}

//function to generate default zone data
function genZoneData() {
  const $ = cheerio.load(fs.readFileSync('./ref.html'))
  for (var n = 0; n < Object.keys(planets.planets).length; n++) {
    var planetID = +planets.planets.getByIndex(n).id;
    var td = $(`#planet-${planetID}`).find('td').map(function() {
      return this
    }).get();
    planets.planets.getByIndex(n).stats.zones_easy = $(`#planet-${planetID}`).find('.1').length
    planets.planets.getByIndex(n).stats.zones_medium = $(`#planet-${planetID}`).find('.2').length
    planets.planets.getByIndex(n).stats.zones_hard = $(`#planet-${planetID}`).find('.3').length
    //console.log(`Planet ${planetID}: ${td[n].attribs.class}`);
    //console.log(td);
    for (var i = 0; i < 96; i++) {
      planets.planets.getByIndex(n).zones[i] = {
        id: i + 1,
        difficulty: td[i].attribs.class,
        progress: 0
      }
    }
  }
}

//genZoneData();

function genMap(id) {
  var mapArr = [`https://raw.githubusercontent.com/NunzioArdi/saliengame/master/steamcdn-a.akamaihd.net/steamcommunity/public/assets/saliengame/maps/${planets.planets.getByIndex(id).stats.image_filename}`];
  var rowMult = 0;
  for (var i = 0; i < 96; i++) {
    var difficulty;
    var colMult = i % 12;
    if (i % 12 === 0) {
      rowMult++;
    }
    if (i === 0) {
      rowMult = 0;
      colMult = 0;
    }
    if (planets.planets.getByIndex(id).zones.getByIndex(i).difficulty == 1) {
      difficulty = './easy.png';
    } else if (planets.planets.getByIndex(id).zones.getByIndex(i).difficulty == 2) {
      difficulty = './medium.png';
    } else {
      difficulty = './hard.png';
    }
    mapArr.push({
      src: difficulty,
      x: colMult * 117,
      y: rowMult * 107,
      width: 117,
      height: 107
    })
    mapArr.push({
      src: './progress.png',
      x: (colMult * 117) + 6,
      y: rowMult * 107,
      width: Math.round(planets.planets.getByIndex(id).zones.getByIndex(i).progress * 106) + 1,
      height: 107
    })
    if (planets.planets.getByIndex(id).zones.getByIndex(i).progress === 1) {
      mapArr.push({
        src: './complete.png',
        x: (colMult * 117),
        y: rowMult * 107,
        width: 117,
        height: 107
      })
    }
  }
  mapArr.push('./grid.png');
  return mapArr;
}

function onPlayerBattle(playerID) {
  var activeZones = [];
  for (var i = 0; i < activePlanets.length; i++) {
    for (var n = 0; n < 96; n++) {
      activeZones.push(planets.planets.getByIndex(/*activePlanets[0]*/i).zones.getByIndex(n)); //current mode > hardest zone from activeplanets
      if (planets.planets.getByIndex(/*activePlanets[0]*/i).zones.getByIndex(n).progress >= 1) {
        planets.planets.getByIndex(/*activePlanets[0]*/i).zones.getByIndex(n).progress = 1;
      }
    }
  }
  var maxid = 0;
  activeZones.map(function(obj) {
    if (obj.difficulty > maxid) maxid = +obj.difficulty;
  });
  var zoneIndex = activeZones.findIndex(zone => (zone.difficulty == maxid) && (zone.progress < 1));
  var joinZone = activeZones.getByIndex(zoneIndex).id;

  function getPlanetFromZone(zone) {
    if (zone <= 95) {
      return 0;
    } else if (zone <= 191) {
      return 1;
    } else if (zone <= 287) {
      return 2;
    } else if (zone <= 383) {
      return 3;
    } else {
      return 4;
    }
  }
  var joinPlanet = getPlanetFromZone(zoneIndex);
  playerdata[playerID].current_planet = joinPlanet;
  playerdata[playerID].current_zone = joinZone;
  var difMult;
  if (planets.planets.getByIndex(activePlanets[joinPlanet]).zones.getByIndex(joinZone - 1).difficulty == 3) {
    difMult = 0.01;
    playerdata[playerID].nextxp = 2400;
  } else if (planets.planets.getByIndex(activePlanets[joinPlanet]).zones.getByIndex(joinZone - 1).difficulty == 2) {
    difMult = 0.02;
    playerdata[playerID].nextxp = 1200;
  } else {
    difMult = 0.1;
    playerdata[playerID].nextxp = 600;
  }
  playerdata[playerID].embattled = true;
  planets.planets.getByIndex(activePlanets[joinPlanet]).stats.total_joins += 1;
  setTimeout(function() {
    playerdata[playerID].embattled = false;
    planets.planets.getByIndex(activePlanets[joinPlanet]).zones.getByIndex(joinZone - 1).progress += Math.round(difMult * 100) / 100;
    playerdata[playerID].xp += playerdata[playerID].nextxp;
    planets.planets.getByIndex(activePlanets[joinPlanet]).stats.total_joins -= 1;
    if (playerdata[playerID].xp >= 26400000) {
      playerdata[playerID].rank = 25;
    } else if (playerdata[playerID].xp >= 24000000) {
      playerdata[playerID].rank = 24;
    } else if (playerdata[playerID].xp >= 21600000) {
      playerdata[playerID].rank = 23;
    } else if (playerdata[playerID].xp >= 19200000) {
      playerdata[playerID].rank = 22;
    } else if (playerdata[playerID].xp >= 16800000) {
      playerdata[playerID].rank = 21;
    } else if (playerdata[playerID].xp >= 14400000) {
      playerdata[playerID].rank = 20;
    } else if (playerdata[playerID].xp >= 12000000) {
      playerdata[playerID].rank = 19;
    } else if (playerdata[playerID].xp >= 10800000) {
      playerdata[playerID].rank = 18;
    } else if (playerdata[playerID].xp >= 9600000) {
      playerdata[playerID].rank = 17;
    } else if (playerdata[playerID].xp >= 8400000) {
      playerdata[playerID].rank = 16;
    } else if (playerdata[playerID].xp >= 7200000) {
      playerdata[playerID].rank = 15;
    } else if (playerdata[playerID].xp >= 6000000) {
      playerdata[playerID].rank = 14;
    } else if (playerdata[playerID].xp >= 4800000) {
      playerdata[playerID].rank = 13;
    } else if (playerdata[playerID].xp >= 3600000) {
      playerdata[playerID].rank = 12;
    } else if (playerdata[playerID].xp >= 2400000) {
      playerdata[playerID].rank = 11;
    } else if (playerdata[playerID].xp >= 1200000) {
      playerdata[playerID].rank = 10;
    } else if (playerdata[playerID].xp >= 450000) {
      playerdata[playerID].rank = 9;
    } else if (playerdata[playerID].xp >= 180000) {
      playerdata[playerID].rank = 8;
    } else if (playerdata[playerID].xp >= 72000) {
      playerdata[playerID].rank = 7;
    } else if (playerdata[playerID].xp >= 30000) {
      playerdata[playerID].rank = 6;
    } else if (playerdata[playerID].xp >= 12000) {
      playerdata[playerID].rank = 5;
    } else if (playerdata[playerID].xp >= 4800) {
      playerdata[playerID].rank = 4;
    } else if (playerdata[playerID].xp >= 2400) {
      playerdata[playerID].rank = 3;
    } else if (playerdata[playerID].xp >= 1200) {
      playerdata[playerID].rank = 2;
    } else if (playerdata[playerID].xp >= 0) {
      playerdata[playerID].rank = 1;
    } else {
      playerdata[playerID].rank = 0;
    }
    fs.writeFile("./playerdata.json", JSON.stringify(playerdata), (err) => {
      if (err) console.error(err)
    });
    fs.writeFile("./planets.json", JSON.stringify(planets), (err) => {
      if (err) console.error(err)
    });
  }, 120000);
  //console.log(`Planet: ${activePlanets[joinPlanet]}`);
  //console.log(`Zone: ${joinZone}`);
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
              current_planet: "",
              current_zone: "",
              nextxp: 0,
              embattled: false
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
      if (/((<@!?\d+>)|[0-9]{18})/.test(args[0])) {
        if (/<@!?\d+>/.test(args[0])) {
          userID = args[0].replace(/[<@!?>]/g, '');
        } else {
          userID = args[0];
        }
        //if (guildWhitelist.member(userID)) {
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
        //} else {
        //  message.channel.send(errorEmbed("User not found", ">stats user"));
        //}
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
          src: `./planets/Planet${planets.planets.getByIndex(activePlanets[0]).stats.image_filename}`,
          x: 733,
          y: 25,
          width: 410,
          height: 410
        }, {
          src: `./planets/Planet${planets.planets.getByIndex(activePlanets[1]).stats.image_filename}`,
          x: 150,
          y: 58,
          width: 358,
          height: 358
        }, {
          src: `./planets/Planet${planets.planets.getByIndex(activePlanets[4]).stats.image_filename}`,
          x: 550,
          y: 300,
          width: 154,
          height: 154
        }, {
          src: `./planets/Planet${planets.planets.getByIndex(activePlanets[3]).stats.image_filename}`,
          x: 350,
          y: 450,
          width: 205,
          height: 205
        }, {
          src: `./planets/Planet${planets.planets.getByIndex(activePlanets[2]).stats.image_filename}`,
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
            .addField(`${planets.planets.getByIndex(activePlanets[0]).stats.name} - ${planets.planets.getByIndex(activePlanets[0]).id}`, `${(planets.planets.getByIndex(activePlanets[0]).stats.progress * 100).toFixed(2)}% Captured, ${planets.planets.getByIndex(activePlanets[0]).stats.total_joins} Players`)
            .addField(`${planets.planets.getByIndex(activePlanets[1]).stats.name} - ${planets.planets.getByIndex(activePlanets[1]).id}`, `${(planets.planets.getByIndex(activePlanets[1]).stats.progress * 100).toFixed(2)}% Captured, ${planets.planets.getByIndex(activePlanets[1]).stats.total_joins} Players`)
            .addField(`${planets.planets.getByIndex(activePlanets[2]).stats.name} - ${planets.planets.getByIndex(activePlanets[2]).id}`, `${(planets.planets.getByIndex(activePlanets[2]).stats.progress * 100).toFixed(2)}% Captured, ${planets.planets.getByIndex(activePlanets[2]).stats.total_joins} Players`)
            .addField(`${planets.planets.getByIndex(activePlanets[3]).stats.name} - ${planets.planets.getByIndex(activePlanets[3]).id}`, `${(planets.planets.getByIndex(activePlanets[3]).stats.progress * 100).toFixed(2)}% Captured, ${planets.planets.getByIndex(activePlanets[3]).stats.total_joins} Players`)
            .addField(`${planets.planets.getByIndex(activePlanets[4]).stats.name} - ${planets.planets.getByIndex(activePlanets[4]).id}`, `${(planets.planets.getByIndex(activePlanets[4]).stats.progress * 100).toFixed(2)}% Captured, ${planets.planets.getByIndex(activePlanets[4]).stats.total_joins} Players`);
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
        .addField(">planet id", `Returns the planet stats of the id provided`)
        .addField(">battle", `Joins the best available zone`)
        .addField(">auto", `Automatically battles for you`)
        .setThumbnail('https://cdn.discordapp.com/emojis/462711870512562176.gif?v=1')
        .setColor('#e9f634');
      message.channel.send(helpEmbed);
    } else {
      message.channel.send(errorEmbed("Command takes no arguments", ">help"));
    }
  }

  if (command === "planet") {
    if (args.length == 1) {
      if (planets.planets.findIndex(planet => planet.id === args[0]) != -1) {
        var id = planets.planets.findIndex(planet => planet.id === args[0]);
        var reqPlanet = planets.planets.getByIndex(id);
        var map = genMap(id);
        //console.log(mapArr);
        mergeImages(map, {
            Canvas: Canvas
          })
          .then(b64 => {
            let data = b64
            var baseMap = decodeBase64Image(data);
            const planetImg = new Discord.Attachment(baseMap.data, 'map.png'); //117x107 grid tile size
            var planetEmbed = new Discord.RichEmbed()
              .setTitle(`${reqPlanet.stats.name} - ${reqPlanet.id}`)
              .attachFile(planetImg)
              .setThumbnail(`https://raw.githubusercontent.com/NunzioArdi/saliengame/master/steamcdn-a.akamaihd.net/steamcommunity/public/assets/saliengame/planets/Planet${reqPlanet.stats.image_filename}`)
              .setImage('attachment://map.png')
              .addField("Progress", `${(reqPlanet.stats.progress * 100).toFixed(2)}%`)
              .addField("Players", `${reqPlanet.stats.total_joins}`)
              .addField("Zone Distribution", `${reqPlanet.stats.zones_easy} Easy, ${reqPlanet.stats.zones_medium} Medium, ${reqPlanet.stats.zones_hard} Hard`)
              .setTimestamp()
              .setColor('#e9f634');
            message.channel.send(planetEmbed);
          });
      } else {
        message.channel.send(errorEmbed("Please Specify a Valid Planet", ">planet id"));
      }
    } else if (args.length < 1) {
      message.channel.send(errorEmbed("Please Specify Planet", ">planet id"));
    } else {
      message.channel.send(errorEmbed("Too Many Arguments", ">planet id"));
    }
  }

  if (command === "battle") {
    var battleID = message.author.id;
    if (args.length == 0) {
      if (playerdata[message.author.id]) {
        if (!playerdata[battleID].embattled) {
          var timer = 120;
          var cMult;
          var jZoneDif;
          if (planets.planets.getByIndex(activePlanets[playerdata[battleID].current_planet]).zones.getByIndex(playerdata[battleID].current_zone - 1).difficulty == 3) {
            jZoneDif = "Hard";
          } else if (planets.planets.getByIndex(activePlanets[playerdata[battleID].current_planet]).zones.getByIndex(playerdata[battleID].current_zone - 1).difficulty == 2) {
            jZoneDif = "Medium";
          } else {
            jZoneDif = "Easy";
          }
          if (playerdata[battleID].current_zone == 1) {
            cMult = 0;
          } else {
            cMult = ((playerdata[battleID].current_zone - 1)%12);
          }
          onPlayerBattle(message.author.id);
          var bMapID = planets.planets.findIndex(planet => planet.id == planets.planets.getByIndex(activePlanets[playerdata[battleID].current_planet]).id);
          var battleMap = genMap(bMapID);
          console.log(playerdata[battleID].current_zone)
          console.log((Math.ceil(((playerdata[battleID].current_zone)/12))-1) * 107)
          console.log((Math.ceil(((playerdata[battleID].current_zone)/12))-1))
          console.log(Math.ceil(((playerdata[battleID].current_zone)/12)))
          console.log(cMult);
          battleMap.push({
              src: './target.png',
              x: cMult * 117,
              y: (Math.ceil(((playerdata[battleID].current_zone)/12))-1) * 107,
              width: 117,
              height: 107
            });
          mergeImages(battleMap, {
              Canvas: Canvas
            })
            .then(target => {
              //console.log(target);
              client.fetchUser(message.author.id).then(value => {
                var targetMap = decodeBase64Image(target);
                const battleImg = new Discord.Attachment(targetMap.data, 'map.png'); //117x107 grid tile size
                var battleEmbed = new Discord.RichEmbed()
                  .setTitle(`Joining Zone`)
                  .addField("Planet", `Planet ${planets.planets.getByIndex(activePlanets[playerdata[battleID].current_planet]).id} (${planets.planets.getByIndex(activePlanets[playerdata[battleID].current_planet]).stats.name})`)
                  .addField("Zone", `${playerdata[battleID].current_zone}`)
                  .addField("Difficulty", jZoneDif)
                  .addField("Progress", `${Math.round(planets.planets.getByIndex(activePlanets[playerdata[battleID].current_planet]).zones.getByIndex(playerdata[battleID].current_zone - 1).progress * 100)}%`)
                  .addField("Time Left", `**${timer}s**`)
                  .attachFile(battleImg)
                  .setThumbnail(`https://raw.githubusercontent.com/NunzioArdi/saliengame/master/steamcdn-a.akamaihd.net/steamcommunity/public/assets/saliengame/planets/Planet${planets.planets.getByIndex(activePlanets[playerdata[battleID].current_planet]).stats.image_filename}`)
                  .setImage('attachment://map.png')
                  .setTimestamp()
                  .setFooter(`${value.username}#${value.discriminator}`, `https://cdn.discordapp.com/avatars/${value.id}/${value.avatar}.jpg`)
                  .setColor('#e9f634');
                //message.channel.send(`<@!${battleID}>`);
                message.channel.send(battleEmbed).then(msg => {
                  var battleInt = setInterval(function() {
                    timer -= 5;
                    var newBattleEmbed = new Discord.RichEmbed()
                      .setTitle(`Embattled`)
                      .addField("Planet", `Planet ${planets.planets.getByIndex(activePlanets[playerdata[battleID].current_planet]).id} (${planets.planets.getByIndex(activePlanets[playerdata[battleID].current_planet]).stats.name})`)
                      .addField("Zone", `${playerdata[battleID].current_zone}`)
                      .addField("Difficulty", jZoneDif)
                      .addField("Progress", `${Math.round(planets.planets.getByIndex(activePlanets[playerdata[battleID].current_planet]).zones.getByIndex(playerdata[battleID].current_zone - 1).progress * 100)}%`)
                      .addField("Time Left", `**${timer}s**`)
                      .setThumbnail(`https://raw.githubusercontent.com/NunzioArdi/saliengame/master/steamcdn-a.akamaihd.net/steamcommunity/public/assets/saliengame/planets/Planet${planets.planets.getByIndex(activePlanets[playerdata[battleID].current_planet]).stats.image_filename}`)
                      .setImage('attachment://map.png')
                      .setTimestamp()
                      .setFooter(`${value.username}#${value.discriminator}`, `https://cdn.discordapp.com/avatars/${value.id}/${value.avatar}.jpg`)
                      .setColor('#e9f634');
                    msg.edit(newBattleEmbed)
                    if (timer === 0) {
                      var finalBattleEmbed = new Discord.RichEmbed()
                        .setTitle(`Battle Complete`)
                        .addField("Planet", `Planet ${planets.planets.getByIndex(activePlanets[playerdata[battleID].current_planet]).id} (${planets.planets.getByIndex(activePlanets[playerdata[battleID].current_planet]).stats.name})`)
                        .addField("Zone", `${playerdata[battleID].current_zone}`)
                        .addField("Difficulty", jZoneDif)
                        .addField("Progress", `${Math.round(planets.planets.getByIndex(activePlanets[playerdata[battleID].current_planet]).zones.getByIndex(playerdata[battleID].current_zone - 1).progress * 100)}%`)
                        .addField("Time Left", `**${timer}s**`)
                        .addField("Score", `${playerdata[message.author.id].xp} (+${playerdata[message.author.id].nextxp})`)
                        .setThumbnail(`https://raw.githubusercontent.com/NunzioArdi/saliengame/master/steamcdn-a.akamaihd.net/steamcommunity/public/assets/saliengame/planets/Planet${planets.planets.getByIndex(activePlanets[playerdata[battleID].current_planet]).stats.image_filename}`)
                        .setImage('attachment://map.png')
                        .setTimestamp()
                        .setFooter(`${value.username}#${value.discriminator}`, `https://cdn.discordapp.com/avatars/${value.id}/${value.avatar}.jpg`)
                        .setColor('#e9f634');
                      msg.edit(finalBattleEmbed)
                      clearInterval(battleInt)
                    }
                  }, 5000);
                })
                /*setTimeout(function() {
                  var finishEmbed = new Discord.RichEmbed()
                    .setTitle(`Battle Finished`)
                    .addField("Score", `${playerdata[message.author.id].xp} (+${playerdata[message.author.id].nextxp})`)
                    .setTimestamp()
                    .setColor('#e9f634');
                  message.channel.send(`<@!${battleID}>`);
                  message.channel.send(finishEmbed);
                }, 120000);*/
              }).catch(console.error);
            });
      } else {
        message.channel.send(errorEmbed("You are currently embattled", ">battle"));
      }
    } else {
      message.channel.send(errorEmbed("You are not registered", ">register steam64"));
    }
  } else {
    message.channel.send(errorEmbed("Command takes no arguments", ">battle"));
  }
}

if (command === "auto") {
  var battleID = message.author.id;
  if (args.length == 0) {
    if (playerdata[message.author.id]) {
      schedule.scheduleJob('*/1 * * * * *', function() {
        if (!playerdata[battleID].embattled) {
          var timer = 120;
          var cMult;
          var jZoneDif;
          onPlayerBattle(message.author.id);
          if (planets.planets.getByIndex(activePlanets[playerdata[battleID].current_planet]).zones.getByIndex(playerdata[battleID].current_zone - 1).difficulty == 3) {
            jZoneDif = "Hard";
          } else if (planets.planets.getByIndex(activePlanets[playerdata[battleID].current_planet]).zones.getByIndex(playerdata[battleID].current_zone - 1).difficulty == 2) {
            jZoneDif = "Medium";
          } else {
            jZoneDif = "Easy";
          }
          if (playerdata[battleID].current_zone == 1) {
            cMult = 0;
          } else {
            cMult = ((playerdata[battleID].current_zone - 1)%12);
          }
          var bMapID = planets.planets.findIndex(planet => planet.id == planets.planets.getByIndex(activePlanets[playerdata[battleID].current_planet]).id);
          var battleMap = genMap(bMapID);
          battleMap.push({
              src: './target.png',
              x: cMult * 117,
              y: (Math.ceil(((playerdata[battleID].current_zone)/12))-1) * 107,
              width: 117,
              height: 107
            });
          mergeImages(battleMap, {
              Canvas: Canvas
            })
            .then(target => {
              //console.log(target);
              client.fetchUser(message.author.id).then(value => {
                var targetMap = decodeBase64Image(target);
                const battleImg = new Discord.Attachment(targetMap.data, 'map.png'); //117x107 grid tile size
                var battleEmbed = new Discord.RichEmbed()
                  .setTitle(`Joining Zone`)
                  .addField("Planet", `Planet ${planets.planets.getByIndex(activePlanets[playerdata[battleID].current_planet]).id} (${planets.planets.getByIndex(activePlanets[playerdata[battleID].current_planet]).stats.name})`)
                  .addField("Zone", `${playerdata[battleID].current_zone}`)
                  .addField("Difficulty", jZoneDif)
                  .addField("Progress", `${Math.round(planets.planets.getByIndex(activePlanets[playerdata[battleID].current_planet]).zones.getByIndex(playerdata[battleID].current_zone - 1).progress * 100)}%`)
                  .addField("Time Left", `**${timer}s**`)
                  .attachFile(battleImg)
                  .setThumbnail(`https://raw.githubusercontent.com/NunzioArdi/saliengame/master/steamcdn-a.akamaihd.net/steamcommunity/public/assets/saliengame/planets/Planet${planets.planets.getByIndex(activePlanets[playerdata[battleID].current_planet]).stats.image_filename}`)
                  .setImage('attachment://map.png')
                  .setTimestamp()
                  .setFooter(`${value.username}#${value.discriminator}`, `https://cdn.discordapp.com/avatars/${value.id}/${value.avatar}.jpg`)
                  .setColor('#e9f634');
                //message.channel.send(`<@!${battleID}>`);
                message.channel.send(battleEmbed).then(msg => {
                  var battleInt = setInterval(function() {
                    timer -= 5;
                    var newBattleEmbed = new Discord.RichEmbed()
                      .setTitle(`Embattled`)
                      .addField("Planet", `Planet ${planets.planets.getByIndex(activePlanets[playerdata[battleID].current_planet]).id} (${planets.planets.getByIndex(activePlanets[playerdata[battleID].current_planet]).stats.name})`)
                      .addField("Zone", `${playerdata[battleID].current_zone}`)
                      .addField("Difficulty", jZoneDif)
                      .addField("Progress", `${Math.round(planets.planets.getByIndex(activePlanets[playerdata[battleID].current_planet]).zones.getByIndex(playerdata[battleID].current_zone - 1).progress * 100)}%`)
                      .addField("Time Left", `**${timer}s**`)
                      .setThumbnail(`https://raw.githubusercontent.com/NunzioArdi/saliengame/master/steamcdn-a.akamaihd.net/steamcommunity/public/assets/saliengame/planets/Planet${planets.planets.getByIndex(activePlanets[playerdata[battleID].current_planet]).stats.image_filename}`)
                      .setImage('attachment://map.png')
                      .setTimestamp()
                      .setFooter(`${value.username}#${value.discriminator}`, `https://cdn.discordapp.com/avatars/${value.id}/${value.avatar}.jpg`)
                      .setColor('#e9f634');
                    msg.edit(newBattleEmbed)
                    if (timer === 0) {
                      var finalBattleEmbed = new Discord.RichEmbed()
                        .setTitle(`Battle Complete`)
                        .addField("Planet", `Planet ${planets.planets.getByIndex(activePlanets[playerdata[battleID].current_planet]).id} (${planets.planets.getByIndex(activePlanets[playerdata[battleID].current_planet]).stats.name})`)
                        .addField("Zone", `${playerdata[battleID].current_zone}`)
                        .addField("Difficulty", jZoneDif)
                        .addField("Progress", `${Math.round(planets.planets.getByIndex(activePlanets[playerdata[battleID].current_planet]).zones.getByIndex(playerdata[battleID].current_zone - 1).progress * 100)}%`)
                        .addField("Time Left", `**${timer}s**`)
                        .addField("Score", `${playerdata[message.author.id].xp} (+${playerdata[message.author.id].nextxp})`)
                        .setThumbnail(`https://raw.githubusercontent.com/NunzioArdi/saliengame/master/steamcdn-a.akamaihd.net/steamcommunity/public/assets/saliengame/planets/Planet${planets.planets.getByIndex(activePlanets[playerdata[battleID].current_planet]).stats.image_filename}`)
                        .setImage('attachment://map.png')
                        .setTimestamp()
                        .setFooter(`${value.username}#${value.discriminator}`, `https://cdn.discordapp.com/avatars/${value.id}/${value.avatar}.jpg`)
                        .setColor('#e9f634');
                      msg.edit(finalBattleEmbed)
                      clearInterval(battleInt)
                    }
                  }, 5000);
                })
                /*setTimeout(function() {
                  var finishEmbed = new Discord.RichEmbed()
                    .setTitle(`Battle Finished`)
                    .addField("Score", `${playerdata[message.author.id].xp} (+${playerdata[message.author.id].nextxp})`)
                    .setTimestamp()
                    .setColor('#e9f634');
                  message.channel.send(`<@!${battleID}>`);
                  message.channel.send(finishEmbed);
                }, 120000);*/
              }).catch(console.error);
            });
        }
      })
    } else {
      message.channel.send(errorEmbed("You are not registered", ">register steam64"));
    }
  } else {
    message.channel.send(errorEmbed("Command takes no arguments", ">battle"));
  }
}

fs.writeFile("./playerdata.json", JSON.stringify(playerdata), (err) => {
  if (err) console.error(err)
});

});

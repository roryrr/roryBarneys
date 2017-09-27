//
// This is main file containing code implementing the Express server and functionality for the Express echo bot.
//
'use strict';
//dotenv library for maintaining credential and client secrets
require('dotenv').config();

const APIAI_TOKEN = process.env.APIAI_CLIENT_ACCESS_TOKEN;
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const path = require('path');
var GLOBAL_ID;

//apiai for NLP
const apiaiApp = require('apiai')(APIAI_TOKEN);

//cloudinary library for image manipulation
var cloudinary = require('cloudinary');
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
var messengerButton = "<html><head><title>Facebook Messenger Bot</title></head><body><h1>Facebook Messenger Bot</h1>This is a bot based on Messenger Platform QuickStart. For more details, see their <a href=\"https://developers.facebook.com/docs/messenger-platform/guides/quick-start\">docs</a>.<script src=\"https://button.glitch.me/button.js\" data-style=\"glitch\"></script><div class=\"glitchButton\" style=\"position:fixed;top:20px;right:20px;\"></div></body></html>";
var rr_array_fav = [];
// The rest of the code implements the routes for our Express server.
let app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

// Webhook validation for Facebook developer platform
app.get('/webhook', function(req, res) {
  if (req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === process.env.VERIFY_TOKEN) {
    console.log("Validating webhook howdy");
    res.status(200).send(req.query['hub.challenge']);

  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);
  }
});

// Display the web page
app.get('/', function(req, res) {
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.write(messengerButton);
  res.end();
});

// Message processing
app.post('/webhook', function (req, res) {
  var data = req.body;
  // Make sure this is a page subscription
  if (data.object === 'page') {

    // Iterate over each entry - there may be multiple if batched
    data.entry.forEach(function(entry) {
      var pageID = entry.id;
      var timeOfEvent = entry.time;

      // Iterate over each messaging event
      entry.messaging.forEach(function(event) {
        if (event.message) {
          receivedMessage(event);
        } else if (event.postback) {
          receivedPostback(event);
        } else {
          console.log("Webhook received unknown event: ", event);
        }
      });
    });

    // Assume all went well.
    //
    // You must send back a 200, within 20 seconds, to let us know
    // you've successfully received the callback. Otherwise, the request
    // will time out and we will keep trying to resend.
    res.sendStatus(200);
  }
});
/* Webhook for API.ai to get response from the 3rd party API */
app.post('/ai', (req, res) => {
  console.log('*** Webhook for api.ai query ***');
  console.log(req.body.result);

  if (req.body.result.action === 'weather') {
    console.log('*** weather ***');
    let city = req.body.result.parameters['geo-city'];
    let restUrl = 'http://api.openweathermap.org/data/2.5/weather?APPID='+WEATHER_API_KEY+'&q='+city;

    request.get(restUrl, (err, response, body) => {
      if (!err && response.statusCode == 200) {
        let json = JSON.parse(body);
        console.log(json);
        let tempF = ~~(json.main.temp * 9/5 - 459.67);
        let tempC = ~~(json.main.temp - 273.15);
        let msg = 'The current condition in ' + json.name + ' is ' + json.weather[0].description + ' and the temperature is ' + tempF + ' ℉ (' +tempC+ ' ℃).'
        return res.json({
          speech: msg,
          displayText: msg,
          source: 'weather'
        });
      } else {
        let errorMessage = 'I failed to look up the city name.';
        return res.status(400).json({
          status: {
            code: 400,
            errorType: errorMessage
          }
        });
      }
    })
  }
  else if (req.body.result.action === 'site-wide-general-top') {
    var rr_array =[];
    rr_array.length = 0;
    console.log("nagma");
    var req_url = process.env.STAGING_URL;
    var queryParameters = { apiKey: process.env.API_KEY,
          apiClientKey: process.env.API_CLIENT_KEY,
          userId: process.env.USER_ID,
          sessionId: process.env.SESSION_ID,
          placements: process.env.PLACEMENTS_ID};
      request({
      uri: req_url,
      qs: queryParameters,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 5.1.1; A1 Build/LMY47V) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.116 Mobile Safari/537.36'
        },
      method: 'GET',
      }, function (error, response, body) {
            if (!error && response.statusCode == 200) {
              //parsing the json response from RR cloud
              body = JSON.parse(body);
                    rr_array = body.placements[0].recommendedProducts;
                    // return sendGenericMessageForApiAi(rr_array);

                    sendGenericMessage(GLOBAL_ID, rr_array);
              // The Description is:  "descriptive string"
            } else {
            console.log('Pavan api.ai, ERROR');
            }
          });
  }

  else if (req.body.result.action === 'user-searches-products') {
    var findGender="", findColor="", findProductName="";
    findGender = req.body.result.parameters['user-gender'];
    findColor = req.body.result.parameters['color'];
    findProductName = req.body.result.parameters['product-name'];
    var rr_array =[];
    var findMyStart = Math.floor((Math.random() * 50) + 1).toString();
    rr_array.length = 0;
    console.log("nagma");
    var req_url = process.env.FIND_URL;
    var queryParameters = { apiKey: process.env.API_KEY,
          apiClientKey: process.env.API_CLIENT_KEY,
          userId: process.env.USER_ID,
          sessionId: process.env.SESSION_ID,
          placements: process.env.PLACEMENTS_ID_FIND,
          lang: "en",
          facet: "",
          query: findProductName,
          start: findMyStart,
          rows: "5"};
        request({
          uri: req_url,
          qs: queryParameters,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 5.1.1; A1 Build/LMY47V) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.116 Mobile Safari/537.36'
            },
          method: 'GET',
          }, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                  //parsing the json response from RR cloud
                  body = JSON.parse(body);
                  console.log("powerranger");
                  console.log(findProductName);
                        rr_array = body.placements[0].docs;
                        sendGenericMessageForSearch(GLOBAL_ID, rr_array);
              // The Description is:  "descriptive string"
            } else {
            console.log('Pavan api.ai, ERROR');
            }
          });
  }

});

// //function to generate the payload for fb via api.ai
// function sendGenericMessageForApiAi(arrayHere){
//   var itemList = [];
//   arrayHere.forEach(i=>{
//      itemList.push(
//      {
//       "title":i.name,
//       "subtitle":i.brand,
//       "item_url":process.env.BNY_HOME + i.linkId,
//       //manipulating the image using Cloudinary
//       "image_url":cloudinary.url(i.imageId,{ type: 'fetch', height: 170, width: 170, crop: 'scale', quality: 100, fetch_format: 'jpg'}),
//       "buttons" : [
//           {
//             "type": "postback",
//             "title": "Try something similar",
//             "payload": "similar"+i.id
//           }, {
//             "type": "postback",
//             "title": "Add to favorites",
//             "payload": "fav"+i.id
//           }]
//      });
//   });
//   console.log("api.ai dabang");
//   console.log(itemList);
//   var messageData = {
//     "facebook": {
//       "attachment": {
//         "type": "template",
//         "payload": {
//           "template_type": "generic",
//           "image_aspect_ratio": "square",
//           "elements": itemList
//         }
//       }
//     }
//   };
//
//   return messageData;
//
// }

// Incoming events handling (this handles both user text input and also text from payload that comes from FB api)
function receivedMessage(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;
  GLOBAL_ID = senderID;
  console.log("Received message for urmila user %d and page %d at %d with message:",
    senderID, recipientID, timeOfMessage);
  console.log(JSON.stringify(message));
  function dummyForReturn(){
    return senderID;
  }
  var messageId = message.mid;

  var messageText = message.text;
  var messageAttachments = message.attachments;

  if (messageText) {
    // If we receive a text message, check to see if it matches a keyword
    // and send back the template example. Otherwise, just echo the text we received.

    let apiai = apiaiApp.textRequest(messageText, {
        sessionId: 'tabby_cat', // use any arbitrary id
        contexts: [
          {
            name: "generic",
            parameters: {
            facebook_user_id: senderID
        }
      }
      ]
      });

      apiai.on('response', (response) => {
        // Got a response from api.ai. Let's POST to Facebook Messenger
        let aiText = response.result.fulfillment.speech;
        var messageData = {
          recipient: {
            id: senderID
          },
          message: {
            text: aiText
          }
        };

        callSendAPI(messageData);
      });

      apiai.on('error', (error) => {
        console.log("Pikachu" + error);
      });

      apiai.end();

    // callFindApi(senderID, messageText);
  } else if (messageAttachments) {
    sendTextMessage(senderID, "Message with attachment received");
  }
}

function receivedPostback(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfPostback = event.timestamp;

  // The 'payload' param is a developer-defined field which is set in a postback
  // button for Structured Messages.
  var payload = event.postback.payload;

  console.log("Received postback talpa for user %d and page %d with payload '%s' " +
    "at %d", senderID, recipientID, payload, timeOfPostback);

  // When a postback is called, we'll send a message back to the sender to
  // let them know it was successful
  if(payload == 'start'){
  sendLoginOption(senderID);
  }
  else if (payload == 'browse') {
    sendCategoryOptions(senderID);
  }
  else if (payload == 'bye') {
    sayGoodBye(senderID);
  }
  else if (payload.match(/(BNY-)/g)) {
    callRrApi(senderID, payload);
  }
  else if (payload == 'guest') {
    sendAvailableOptionList(senderID);
  }
  else if (payload.match(/(similar)/g)) {
    callRrApi(senderID, payload);
  }
  else if (payload.match(/(fav)/g)) {
    console.log("Anushka %s", payload);
    callRrFavApi(senderID, payload);
  }
  else if (payload == 'fvList') {
    returnFavList(senderID);
  }
}

//////////////////////////
// Sending helpers
//////////////////////////
function sendTextMessage(recipientId, messageText) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText
    }
  };

  callSendAPI(messageData);
}


function sendLoginOption(recipientId){
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: "Welcome to Barneys! Please choose an option.",
            image_url:"https://res.cloudinary.com/goodsearch/image/upload/v1436553720/hi_resolution_merchant_logos/barneys-new-york_coupons.jpg",
            buttons:[
              {
                type: "account_link",
                // title: "Login",
                // payload: "login"
                url: "https://www.barneys.com"
              },
              {
                type: "postback",
                title: "Continue as guest",
                payload: "guest"
              }
            ]
          }
        ]
        }
      }
    }
  };
    callSendAPI(messageData);
}
//sending basic menu
function sendAvailableOptionList(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: "Great! Here’s a summary of what we can do",
            buttons:[
              {
                type: "postback",
                title: "Browse the Store",
                payload: "browse"
              },
              {
                type: "web_url",
                url: "http://labs.richrelevance.com/storre/",
                title: "Visit our Website"
              },
              {
                type: "postback",
                title: "Leave experience",
                payload: "bye"
              }
            ]
          }
        ]
        }
      }
    }
  };
    callSendAPI(messageData);
  }

  //Sending categories options
  function sendCategoryOptions(recipientId) {
    var messageData = {
      recipient: {
        id: recipientId
      },
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "generic",
            elements: [{
              title: "Select a category",
              subtitle: "Swipe right/left for more options",
              buttons:[
                {
                  type: "postback",
                  title: "Women",
                  payload: "BNY-women"
                },
                {
                  type: "postback",
                  title: "Men",
                  payload: "BNY-men"
                },
                {
                  type: "postback",
                  title: "Beauty",
                  payload: "BNY-womens-beauty"
                }
              ]
            },
            {
              title: "Select a category",
              subtitle: "Swipe right/left for more options",
              buttons:[
                {
                  type: "postback",
                  title: "Home",
                  payload: "BNY-home"
                },
                {
                  type: "postback",
                  title: "Kids",
                  payload: "BNY-kids"
                },
                {
                  type: "web_url",
                  url: "http://labs.richrelevance.com/storre/",
                  title: "Visit our Website"
                }
              ]
            }
          ]
          }
        }
      }
    };
      callSendAPI(messageData);
    }
//Goodbye response
function sayGoodBye(recipientId){
  var messageData = {
    recipient: {
      id: recipientId
    },
    message:{
    attachment:{
      type: "image",
      payload: {
        url: cloudinary.url("https://media1.giphy.com/media/aMeoYTJm7dwuQ/giphy.gif",{ type: 'fetch', height: 170, width: 170, crop: 'scale', quality: 50, fetch_format: 'auto'})
      }
    }
  }
};
sendTextMessage(recipientId, "Here’s looking at you, kid.");
callSendAPI(messageData);
setTimeout(function() { sendTextMessage(recipientId, "Come back any time to start shopping!") }, 2500);

}

function sendGenericMessage(recipientId, arrayHere) {
  var itemList = [];
arrayHere.forEach(i=>{
   itemList.push(
   {
    "title":i.name,
    "subtitle":i.brand,
    "item_url":i.productURL,
    //manipulating the image using Cloudinary
    "image_url":cloudinary.url(i.imageURL,{ type: 'fetch', height: 120, crop: 'pad', quality: 100, fetch_format: 'jpg'}),
    "buttons" : [
        {
          "type": "postback",
          "title": "Try something similar",
          "payload": "similar"+i.id
        }, {
          "type": "postback",
          "title": "Add to favorites",
          "payload": "fav"+i.id
        }]
   });
});
console.log("dabang");
console.log(itemList);
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          image_aspect_ratio: "square",
          elements: itemList
        }
      }
    }
  };

  callSendAPI(messageData);
}


function sendGenericMessageForSearch(recipientId, arrayHere) {
  var itemList = [];
arrayHere.forEach(i=>{
   itemList.push(
   {
    "title":i.name,
    "subtitle":i.brand,
    "item_url":process.env.BNY_HOME + i.linkId,
    //manipulating the image using Cloudinary
    "image_url":cloudinary.url(i.imageId,{ type: 'fetch', height: 120, crop: 'pad', quality: 100, fetch_format: 'jpg'}),
    "buttons" : [
        {
          "type": "postback",
          "title": "Try something similar",
          "payload": "similar"+i.id
        }, {
          "type": "postback",
          "title": "Add to favorites",
          "payload": "fav"+i.id
        }]
   });
});
console.log("shahrukh");
console.log(itemList);
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          image_aspect_ratio: "square",
          elements: itemList
        }
      }
    }
  };

  callSendAPI(messageData);
}
//block that makes a call to RR api
function callRrApi(sid, queryString){
  var rr_array =[];
  rr_array.length = 0;
  var mySt = Math.floor((Math.random() * 50) + 1).toString();
  if(queryString == "default"){
    var req_url = process.env.STAGING_URL;
    var queryParameters = { apiKey: process.env.API_KEY,
          apiClientKey: process.env.API_CLIENT_KEY,
          userId: process.env.USER_ID,
          sessionId: process.env.SESSION_ID,
          placements: process.env.PLACEMENTS_ID};
  }
  else if(queryString.match(/(BNY-)/g)){
    var req_url = process.env.STAGING_URL;
    var queryParameters = { apiKey: process.env.API_KEY,
          apiClientKey: process.env.API_CLIENT_KEY,
          st: mySt,
          count: '5',
          userId: process.env.USER_ID,
          sessionId: process.env.SESSION_ID,
          placements: process.env.PLACEMENTS_ID_CAT,
          categoryId: queryString};
  }
  else if (queryString.match(/(similar)/g)) {
    var req_url = process.env.STAGING_URL;
    var queryParameters = { apiKey: process.env.API_KEY,
          apiClientKey: process.env.API_CLIENT_KEY,
          userId: process.env.USER_ID,
          sessionId: process.env.SESSION_ID,
          placements: process.env.PLACEMENTS_ID_SIMILAR,
          productId: queryString.slice(7)};
  }
  else if (queryString.match(/(favorite)/g)) {
    var req_url = process.env.GET_PRODUCTS_URL;
    var queryParameters = { apiKey: process.env.API_KEY,
          apiClientKey: process.env.API_CLIENT_KEY,
          productId: queryString.slice(8)};
  }
  request({
    uri: req_url,
    qs: queryParameters,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 5.1.1; A1 Build/LMY47V) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.116 Mobile Safari/537.36'
      },
    method: 'GET',
    }, function (error, response, body) {
          if (!error && response.statusCode == 200) {
            //parsing the json response from RR cloud
            body = JSON.parse(body);
            if(body.status == "error"){
              console.log("nenu cheppala");
            }
            else {

            if (queryString.match(/(favorite)/g)) {
              console.log("undertaker wwe");
              console.log(body);
              rr_array = body.products;
            }
            else {
                  rr_array = body.placements[0].recommendedProducts;
                }
            sendGenericMessage(sid, rr_array);
            // The Description is:  "descriptive string"
          } }else {
            sendTextMessage(sid, 'Pavan, ERROR');
          }
        });
      }

      //Block that call Find api

      function callFindApi(sid, queryString){
        var rr_array =[];
        rr_array.length = 0;
          request({
          uri: "https://staging.richrelevance.com/rrserver/api/find/v1/dbeab3c977a08905?facet=&query="+queryString+"&lang=en&start=0&rows=5&placement=generic_page.rory_search&userId=ulichi&sessionId=mysession",
          headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 5.1.1; A1 Build/LMY47V) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.116 Mobile Safari/537.36'
            },
          method: 'GET',
          }, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                  //parsing the json response from RR cloud
                  body = JSON.parse(body);
                        rr_array = body.placements[0].docs;
                        sendGenericMessageForSearch(sid, rr_array);
                  // The Description is:  "descriptive string"
                } else {
                  sendTextMessage(sid, 'Pavan, ERROR');
                }
              });
            }

      //Block that calls RR api(add to favorites)
      function callRrFavApi(sid, queryString){
        console.log("Favorite anushka called");
          var req_url = process.env.PROD_URL;
          var queryParameters = { apiKey: process.env.BY_FAV_API_KEY,
                u: process.env.USER_ID,
                s: process.env.SESSION_ID,
                p: queryString.slice(3),
                targetType: process.env.BY_FAV_TARGETTYPE,
                actionType: process.env.BY_FAV_ACTIONTYPE};
        request({
          uri: req_url,
          qs: queryParameters,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 5.1.1; A1 Build/LMY47V) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.116 Mobile Safari/537.36'
            },
          method: 'GET',
          }, function (error, response, body) {
            console.log("anushka inside function");
                if (!error && response.statusCode == 200) {
                  sendTextMessage(sid, 'Item added to favorites');
                  // The Description is:  "descriptive string"
                } else {
                  sendTextMessage(sid, 'Anushka, ERROR');
                }
              });
            }

            //Block that returns Favorite List
            function returnFavList(sid){
              var rr_array_temp;
                var queryParameters = { apiKey: process.env.BY_FAV_API_KEY,
                      fields: process.env.BY_FAV_FIELDS,
                      };
              request({
                uri: process.env.PROD_FAV_URL,
                qs: queryParameters,
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Linux; Android 5.1.1; A1 Build/LMY47V) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.116 Mobile Safari/537.36'
                  },
                method: 'GET',
                }, function (error, response, body) {
                      if (!error && response.statusCode == 200) {
                        body = JSON.parse(body);
                        console.log("samantha4 inside function");
                        console.log(body.pref_product.NEUTRAL);
                        rr_array_temp = "favorite" + body.pref_product.NEUTRAL.join("|");
                        console.log("Rajinikanth");
                        console.log(rr_array_temp);
                        callRrApi(sid, rr_array_temp);
                        } else {
                        // console.log('Google log start golden');
                        // console.log(body) // Print the google web page.
                        // console.log('Google log end golden');
                        sendTextMessage(sid, 'Anushka, ERROR');
                      }
                    });
                  }

function callSendAPI(messageData) {
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: process.env.PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: messageData

  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

      console.log("Successfully sent generic message with id %s to recipient %s",
        messageId, recipientId);
    } else {
      console.error("Unable to send message.");
      console.error(response);
      console.error(error);
    }
  });
}

// Set Express to listen out for HTTP requests
var server = app.listen(process.env.PORT || 3000, function () {
  console.log("Listening on port %s", server.address().port);
});

//
// This is main file containing code implementing the Express server and functionality for the Express echo bot.
//
// 'use strict';
const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const path = require('path');
//dotenv library for maintaining credential and client secrets
require('dotenv').config();

//cloudinary library for image manipulation
var cloudinary = require('cloudinary');
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
var messengerButton = "<html><head><title>Facebook Messenger Bot</title></head><body><h1>Facebook Messenger Bot</h1>This is a bot based on Messenger Platform QuickStart. For more details, see their <a href=\"https://developers.facebook.com/docs/messenger-platform/guides/quick-start\">docs</a>.<script src=\"https://button.glitch.me/button.js\" data-style=\"glitch\"></script><div class=\"glitchButton\" style=\"position:fixed;top:20px;right:20px;\"></div></body></html>";
//Declaring variables that store data from the response of RR API
// var rr_array = [];
// var rr_array_temp = [];
var rr_array_fav = [];
// rr_array_fav = [];
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
  // console.log(req.body);
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

// Incoming events handling (this handles both user text input and also text from payload that comes from FB api)
function receivedMessage(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;

  console.log("Received message for user %d and page %d at %d with message:",
    senderID, recipientID, timeOfMessage);
  console.log(JSON.stringify(message));

  var messageId = message.mid;

  var messageText = message.text;
  var messageAttachments = message.attachments;

  if (messageText) {
    // If we receive a text message, check to see if it matches a keyword
    // and send back the template example. Otherwise, just echo the text we received.
    switch (messageText) {
      case 'generic':
        callRrApi(senderID, "default");
        break;
      // case 'show':
      //   callRrApi(senderID);
      //   break;
      default:
        sendTextMessage(senderID, messageText);
    }
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
  // console.log('ranbir');
  // console.log(cloudinary.url(i.imageURL,{ type: 'fetch', width: 170, height: 170, crop: 'fit', fetch_format: 'jpg' }));
  // console.log('ranbir');
   itemList.push(
   {
    "title":i.name,
    "subtitle":i.brand,
    "item_url":i.productURL,
    //manipulating the image using Cloudinary
    "image_url":cloudinary.url(i.imageURL,{ type: 'fetch', height: 170, width: 170, crop: 'scale', quality: 100, fetch_format: 'jpg'}),
    "buttons" : [
      {
          "type": "web_url",
          "url": i.productURL,
          "title": "View details"
        },
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
//block that makes a call to RR api
function callRrApi(sid, queryString){
  var rr_array =[];
  var req_url = process.env.STAGING_URL;
  if(queryString == "default"){
    var queryParameters = { apiKey: process.env.API_KEY,
          apiClientKey: process.env.API_CLIENT_KEY,
          userId: process.env.USER_ID,
          sessionId: process.env.SESSION_ID,
          placements: process.env.PLACEMENTS_ID};
  }
  else if(queryString.match(/(BNY-)/g)){
    var queryParameters = { apiKey: process.env.API_KEY,
          apiClientKey: process.env.API_CLIENT_KEY,
          userId: process.env.USER_ID,
          sessionId: process.env.SESSION_ID,
          placements: process.env.PLACEMENTS_ID,
          categoryId: queryString};
  }
  else if (queryString.match(/(similar)/g)) {
    var queryParameters = { apiKey: process.env.API_KEY,
          apiClientKey: process.env.API_CLIENT_KEY,
          userId: process.env.USER_ID,
          sessionId: process.env.SESSION_ID,
          placements: process.env.PLACEMENTS_ID_SIMILAR,
          productId: queryString.slice(7)};
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
            rr_array = body.placements[0].recommendedProducts;
            sendGenericMessage(sid, rr_array);
            // The Description is:  "descriptive string"
            // console.log("Got a response dhoni: ", rr_array[0].clickURL);
            // sendTextMessage(sid, 'Pavan check logs');
          } else {
            // console.log('Google log start golden');
            // console.log(body) // Print the google web page.
            // console.log('Google log end golden');
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
                  // console.log("Got a response dhoni: ", rr_array[0].clickURL);
                  // sendTextMessage(sid, 'Pavan check logs');
                } else {
                  // console.log('Google log start golden');
                  // console.log(body) // Print the google web page.
                  // console.log('Google log end golden');
                  sendTextMessage(sid, 'Anushka, ERROR');
                }
              });
            }

            //Block that returns Favorite List
            function returnFavList(sid){
              var rr_array_temp = [];
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
                        // body = JSON.parse(body);
                        rr_array_temp = body.pref_product.NEUTRAL;
                        console.log("Rajinikanth");
                        console.log(rr_array_temp);
                        dataBuilder(sid, rr_array_temp);
                        setTimeout(function() {
                          if(rr_array_fav.length > 0){
                            sendGenericMessage(sid, rr_array_fav);
                          }
                          else {
                            sendTextMessage(sid, "You don't have any items.");
                          }
                           }, 2500);

                        // // The Description is:  "descriptive string"
                        // console.log("Got a response dhoni: ", rr_array[0].clickURL);
                        // sendTextMessage(sid, 'Pavan check logs');
                      } else {
                        // console.log('Google log start golden');
                        // console.log(body) // Print the google web page.
                        // console.log('Google log end golden');
                        sendTextMessage(sid, 'Anushka, ERROR');
                      }
                    });
                  }

function dataBuilder(d, myArray){
  // var j = 0;
  rr_array_fav.length = 0;
    myArray.forEach(i=>{
      var req_url = process.env.STAGING_URL;
      var queryParameters = { apiKey: process.env.BY_FAV_API_KEY,
            apiClientKey: process.env.API_CLIENT_KEY,
            placements: process.env.PLACEMENTS_ID_ECHO,
            productId: i,
            };
    request({
      uri: req_url,
      qs: queryParameters,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 5.1.1; A1 Build/LMY47V) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.116 Mobile Safari/537.36'
        },
      method: 'GET',
    },(error, response, body) => {
        console.log("ash inside function");
            if (!error && response.statusCode == 200) {
              body = JSON.parse(body);
              console.log("Imran");
              console.log(body);
              rr_array_fav.push(body.placements[0].recommendedProducts[0]);
               console.log("yeshvitha");
               console.log("talpa");
               //console.log(rr_array[j]);
              //  j++;
              // console.log(rr_array);
              // rr_array.push(body);
              // sendTextMessage(d, 'warming up');
              // The Description is:  "descriptive string"
              // console.log("Got a response dhoni: ", rr_array[0].clickURL);
              // sendTextMessage(sid, 'Pavan check logs');
            } else {
              // console.log('Google log start golden');
              // console.log(body) // Print the google web page.
              // console.log('Google log end golden');
              sendTextMessage(d, 'Anushka, ERROR');
            }
            console.log("Deepika start");
            // console.log(rr_array_fav);
            // sendGenericMessage(d, rr_array_fav);
          });
    });
 //
}

function callSendAPI(messageData) {
  // console.log("Dunkirk start");
  // console.log(process.env.PAGE_ACCESS_TOKEN);
  // console.log(process.env.VERIFY_TOKEN);
  // console.log("Dunkirk end");
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

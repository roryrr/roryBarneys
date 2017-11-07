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
    var reqPromise = require('request-promise');
    var GLOBAL_ID;
    var GLOBAL_PRODUCT_NAME, GLOBAL_PRODUCT_BRAND, GLOBAL_PRODUCT_GENDER, GLOBAL_PRODUCT_COLOR, GLOBAL_PRODUCT_SIZE;
    var productCountStart;
    var facet_array = [];
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
                  if (event.message.is_echo) {
                    console.log("I caught you");
                  }
                  else {
                      receivedMessage(event);
                  }
                }else if (event.postback) {
                  receivedPostback(event);
                }
                else {
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
        var options = {
          uri: restUrl,
          qs: {
            APPID: WEATHER_API_KEY,
            q: city
          },
          headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 5.1.1; A1 Build/LMY47V) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.116 Mobile Safari/537.36'
            },
          json: true
        };
        reqPromise(options)
          .then(function(json){
            let tempF = ~~(json.main.temp * 9/5 - 459.67);
            let tempC = ~~(json.main.temp - 273.15);
            let msg = 'The current condition in ' + json.name + ' is ' + json.weather[0].description + ' and the temperature is ' + tempF + ' ℉ (' +tempC+ ' ℃).'
            return res.json({
              speech: msg,
              displayText: msg,
              source: 'weather'
            });
          })
          .catch(function(err) {
            console.log("Weather Api call failed");
          });
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
        var options = {

        };
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
                        // setTimeout(function() { v2_restartAnytime(GLOBAL_ID) }, 7000);
                  // The Description is:  "descriptive string"
                } else {
                console.log('Pavan api.ai, ERROR');
                }
              });
      }

      else if (req.body.result.action === 'user-searches-products') {
        productCountStart = 0;
        GLOBAL_PRODUCT_GENDER="", GLOBAL_PRODUCT_COLOR="", GLOBAL_PRODUCT_NAME="", GLOBAL_PRODUCT_BRAND="", GLOBAL_PRODUCT_SIZE="";
        GLOBAL_PRODUCT_GENDER = req.body.result.parameters['user-gender'];
        GLOBAL_PRODUCT_COLOR = req.body.result.parameters['color'].capitalize();
        GLOBAL_PRODUCT_BRAND = req.body.result.parameters['brand'];
        GLOBAL_PRODUCT_SIZE = req.body.result.parameters['user-size'];
        if (req.body.result.parameters['product-name']) {
            GLOBAL_PRODUCT_NAME = req.body.result.parameters['product-name'];
        }
        else {
          GLOBAL_PRODUCT_NAME = 'shirt';
        }
        if (req.body.result.parameters['brand']) {
            GLOBAL_PRODUCT_BRAND = 'brand:\"'+req.body.result.parameters['brand']+'\"';
        }
        if (req.body.result.parameters['user-size']) {
            GLOBAL_PRODUCT_SIZE = 'size:\"'+req.body.result.parameters['user-size']+'\"';
        }
        if (req.body.result.parameters['user-gender']) {
            GLOBAL_PRODUCT_GENDER = 'gender:\"'+req.body.result.parameters['user-gender']+'\"';
        }
        if (req.body.result.parameters['color']) {
            GLOBAL_PRODUCT_COLOR = 'color:\"'+(req.body.result.parameters['color'].capitalize())+'\"';
        }
        var rr_array =[];
        // var findMyStart = Math.floor((Math.random() * 30) + 1).toString();
        rr_array.length = 0;
        facet_array.length = 0;
        console.log("nagma");
        var req_url = process.env.FIND_URL;
        var apiKey= process.env.API_KEY,
              apiClientKey= process.env.API_CLIENT_KEY,
              userId= process.env.USER_ID,
              sessionId= process.env.SESSION_ID,
              placements= process.env.PLACEMENTS_ID_FIND,
              lang= "en",
              query= GLOBAL_PRODUCT_NAME,
              start= 0,
              rows= "9";
        var  requesting = req_url + "?apiKey=" + apiKey + "&apiClientKey=" + apiClientKey + "&userId=" + userId + "&sessionId=" + sessionId + "&placements=" + placements + "&lang=en&start=0&rows=9&query=" + query + "&filter=" + GLOBAL_PRODUCT_BRAND + "&filter=" + GLOBAL_PRODUCT_GENDER + "&filter=" + GLOBAL_PRODUCT_COLOR + "&filter=" + GLOBAL_PRODUCT_SIZE;
        console.log(requesting);
          request(requesting, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                  //parsing the json response from RR cloud
                  body = JSON.parse(body);
                  console.log("powerranger");
                  console.log(GLOBAL_PRODUCT_NAME);
                  if (body.placements[0].numFound == "0") {
                    sendTextMessage(GLOBAL_ID, "Oops, looks like we don’t have anything that fits that description.")
                  }
                  else{
                        rr_array = body.placements[0].docs;
                        facet_array = body.placements[0].facets;
                        sendGenericMessageForSearch(GLOBAL_ID, rr_array);
                        setTimeout(function() { v2_sendFilters(GLOBAL_ID, GLOBAL_PRODUCT_NAME) }, 3000);
                        // setTimeout(function() { v2_restartAnytime(GLOBAL_ID) }, 7000);
                      }
              // The Description is:  "descriptive string"
            } else {
            console.log('Pavan api.ai, ERROR');
            }
          });
            // request({
            //   uri: req_url,
            //   qs: queryParameters,
            //   headers: {
            //     'User-Agent': 'Mozilla/5.0 (Linux; Android 5.1.1; A1 Build/LMY47V) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.116 Mobile Safari/537.36'
            //     },
            //   method: 'GET',
            //   }, function (error, response, body) {
            //         if (!error && response.statusCode == 200) {
            //           //parsing the json response from RR cloud
            //           body = JSON.parse(body);
            //           console.log("powerranger");
            //           console.log(findProductName);
            //                 rr_array = body.placements[0].docs;
            //                 facet_array = body.placements[0].facets;
            //                 sendGenericMessageForSearch(GLOBAL_ID, rr_array);
            //                 setTimeout(function() { v2_sendFilters(GLOBAL_ID, findProductName) }, 3000);
            //                 // setTimeout(function() { v2_restartAnytime(GLOBAL_ID) }, 7000);
            //       // The Description is:  "descriptive string"
            //     } else {
            //     console.log('Pavan api.ai, ERROR');
            //     }
            //   });
      }
      else if (req.body.result.action === 'user-searches-more-products') {
        console.log('****List is coming soon****');
        console.log(req.body.result.contexts[0].parameters['product-name'] + " sultan");
        productCountStart += 9;
        console.log("The product count start is %d", productCountStart);

        var findGender="", findColor="", findProductName="", findBrand="";
        findGender = req.body.result.contexts[0].parameters['user-gender'];
        findColor = req.body.result.contexts[0].parameters['color'];
        findProductName = req.body.result.contexts[0].parameters['product-name'];
        findBrand = req.body.result.contexts[0].parameters['brand'];
        var searchString = (findProductName ? findProductName : "") + (findGender ? findGender : "") + (findColor ? findColor : "") + (findBrand ? findBrand:"");
        var rr_array =[];
        // var findMyStart = Math.floor((Math.random() * 30) + 1).toString();
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
              query: searchString,
              start: productCountStart,
              rows: "9"};
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
                            setTimeout(function() { v2_sendFilters(GLOBAL_ID, findProductName) }, 3000);
                            // setTimeout(function() { v2_restartAnytime(GLOBAL_ID) }, 7000);
                  // The Description is:  "descriptive string"
                } else {
                console.log('Pavan api.ai, ERROR');
                }
              });


      }


      else if (req.body.result.action === 'user-filters-products') {
        console.log('****Filter is coming soon****');
        console.log(GLOBAL_PRODUCT_BRAND);
        console.log(GLOBAL_PRODUCT_COLOR);
        console.log(GLOBAL_PRODUCT_SIZE);
        console.log(GLOBAL_PRODUCT_GENDER);
        facet_array.length = 0;
        if (req.body.result.contexts[0].parameters['reset-filter']) {
          if (req.body.result.contexts[0].parameters['reset-filter'] == "any brand") {
            GLOBAL_PRODUCT_BRAND="";
          }
          else if(req.body.result.contexts[0].parameters['reset-filter'] == "any color") {
            GLOBAL_PRODUCT_COLOR="";
          }
          else if(req.body.result.contexts[0].parameters['reset-filter'] == "any gender") {
            GLOBAL_PRODUCT_GENDER="";
          }
          else if(req.body.result.contexts[0].parameters['reset-filter'] == "any size") {
            GLOBAL_PRODUCT_SIZE="";
          }

        }
        if (req.body.result.contexts[0].parameters['product-name']) {
            GLOBAL_PRODUCT_NAME = req.body.result.contexts[0].parameters['product-name'];
        }
        else {
          GLOBAL_PRODUCT_NAME = 'shirt';
        }
        if (req.body.result.contexts[0].parameters['brand']) {
            GLOBAL_PRODUCT_BRAND = 'brand:\"'+req.body.result.contexts[0].parameters['brand']+'\"';
        }
        else {
          GLOBAL_PRODUCT_BRAND=GLOBAL_PRODUCT_BRAND;
        }
        if (req.body.result.contexts[0].parameters['user-size']) {
            GLOBAL_PRODUCT_SIZE = 'size:\"'+req.body.result.contexts[0].parameters['user-size']+'\"';
        }
        else {
          GLOBAL_PRODUCT_SIZE=GLOBAL_PRODUCT_SIZE;
        }
        if (req.body.result.contexts[0].parameters['user-gender']) {
            GLOBAL_PRODUCT_GENDER = 'gender:\"'+req.body.result.contexts[0].parameters['user-gender']+'\"';
        }
        else {
          GLOBAL_PRODUCT_GENDER=GLOBAL_PRODUCT_GENDER;
        }
        if (req.body.result.contexts[0].parameters['color']) {
            GLOBAL_PRODUCT_COLOR = 'color:\"'+(req.body.result.contexts[0].parameters['color'].capitalize())+'\"';
        }
        else {
          GLOBAL_PRODUCT_COLOR=GLOBAL_PRODUCT_COLOR;
        }
        var req_url = process.env.FIND_URL;
        var apiKey= process.env.API_KEY,
              apiClientKey= process.env.API_CLIENT_KEY,
              userId= process.env.USER_ID,
              sessionId= process.env.SESSION_ID,
              placements= process.env.PLACEMENTS_ID_FIND,
              lang= "en",
              query= GLOBAL_PRODUCT_NAME,
              start= 0,
              rows= "9";
        var  requesting = req_url + "?apiKey=" + apiKey + "&apiClientKey=" + apiClientKey + "&userId=" + userId + "&sessionId=" + sessionId + "&placements=" + placements + "&lang=en&start=0&rows=9&query=" + query + "&filter=" + GLOBAL_PRODUCT_BRAND + "&filter=" + GLOBAL_PRODUCT_GENDER + "&filter=" + GLOBAL_PRODUCT_COLOR + "&filter=" + GLOBAL_PRODUCT_SIZE;
          request(requesting, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                  //parsing the json response from RR cloud
                  body = JSON.parse(body);
                  console.log("powerranger");
                  console.log(GLOBAL_PRODUCT_NAME);
                  console.log(requesting);
                  if (body.placements[0].numFound == "0") {
                    sendTextMessage(GLOBAL_ID, "Oops, looks like we don’t have anything that fits that description.")
                  }
                  else{
                        rr_array = body.placements[0].docs;
                        facet_array = body.placements[0].facets;
                        sendGenericMessageForSearch(GLOBAL_ID, rr_array);
                        setTimeout(function() { v2_sendFilters(GLOBAL_ID, GLOBAL_PRODUCT_NAME) }, 3000);
                        // setTimeout(function() { v2_restartAnytime(GLOBAL_ID) }, 7000);
                      }
              // The Description is:  "descriptive string"
            } else {
            console.log('Pavan api.ai, ERROR');
            }
          });
      }

      else if (req.body.result.action === 'showing-user-lists') {
        var rr_array;
        var req_url = process.env.PROD_FAV_URL;
        var queryParameters = { apiKey: process.env.BY_FAV_API_KEY,
              fields: process.env.BY_FAV_FIELDS,
              };
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
                      if ((typeof body.pref_product.LIKE) == "object") {
                        rr_array = "favorite" + body.pref_product.LIKE.join("|");
                        callRrApi(GLOBAL_ID, rr_array);
                      }
                      else {
                        sendTextMessage(GLOBAL_ID, "Oops! Looks like you don’t have anything saved.");
                    }
                  // The Description is:  "descriptive string"
                } else {
                console.log('Pavan api.ai, ERROR');
                }
              });
      }
      else if (req.body.result.action === 'user-requests-brands') {
        var findBrand = req.body.result.parameters['brand'];
        findBrand.replace(" ", "+")
        var rr_array =[];
        var findMyStart = Math.floor((Math.random() * 30) + 1).toString();
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
              query: findBrand,
              start: 0,
              rows: "9"};
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
                            // setTimeout(function() { v2_restartAnytime(GLOBAL_ID) }, 7000);
                  // The Description is:  "descriptive string"
                } else {
                console.log('Pavan api.ai, ERROR');
                }
              });
      }
      else if (req.body.result.action === 'inspire-me') {
        var findBrand = req.body.result.parameters["brand"];
        findBrand = 'brand:\"' + findBrand + '\"';
        var findProductName = req.body.result.parameters['product-name'];
        findProductName.replace(" ", "+");
        var findcolor = req.body.result.parameters["color"];
        findcolor = 'color:\"' + findcolor.charAt(0).toUpperCase() + findcolor.slice(1) + '\"';
        var findSize = req.body.result.parameters["user-size"];
        if (parseInt(findSize)) {
        findSize = 'size:\"' + findSize + '\"';
        }
        else {
        findSize = 'size:\"' + findSize.charAt(0) + '\"';
        }
        // var findPrice = parseInt(req.body.result.parameters['unit-currency']) * 100;
        // findPrice = 'effectivePriceCents:\"' + findPrice + '\"';
        var findGender = req.body.result.parameters['user-gender'];
        findGender = 'gender:\"' + findGender + '\"';
        var rr_array =[];
        rr_array.length = 0;
        console.log("nagma");
        // var request = require('request');
        var req_url = process.env.FIND_URL;
        var apiKey= process.env.API_KEY,
              apiClientKey= process.env.API_CLIENT_KEY,
              userId= process.env.USER_ID,
              sessionId= process.env.SESSION_ID,
              placements= process.env.PLACEMENTS_ID_FIND;
            var  requesting = req_url + "?apiKey=" + apiKey + "&apiClientKey=" + apiClientKey + "&userId=" + userId + "&sessionId=" + sessionId + "&placements=" + placements + "&lang=en&facet=&start=0&rows=5&query=" + findProductName + "&filter=" + findBrand + "&filter=" + findGender + "&filter=" + findcolor + "&filter=" + findSize;
              request(requesting, function (error, response, body) {
                    if (!error && response.statusCode == 200) {
                      //parsing the json response from RR cloud
                      body = JSON.parse(body);
                      console.log("powerranger");
                      console.log(findProductName);
                      if (body.placements[0].numFound == "0") {
                        sendTextMessage(GLOBAL_ID, "Oops, looks like we don’t have anything that fits that description.")
                      }
                      else{
                            rr_array = body.placements[0].docs;
                            sendGenericMessageForSearch(GLOBAL_ID, rr_array);
                            // setTimeout(function() { v2_restartAnytime(GLOBAL_ID) }, 7000);
                          }
                  // The Description is:  "descriptive string"
                } else {
                console.log('Pavan api.ai, ERROR');
                }
              });
      }

    });


    String.prototype.capitalize = function() {
        return this.charAt(0).toUpperCase() + this.slice(1);
    }

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
        if(message.quick_reply && (message.quick_reply["payload"]).match(/(v2_)/g)){
          var derivedPayload = message.quick_reply["payload"];
          if (derivedPayload == "v2_find") {
            v2_showFindList(senderID);
          }
          else if (derivedPayload == "v2_favorites") {
            returnFavList(senderID);
          }
          else if (derivedPayload == "v2_discover") {
            v2_justLooking(senderID);
          }
          else if (derivedPayload == "v2_category") {
            v2_sendCategories(senderID);
          }
          else if (derivedPayload == "v2_brand") {
            sendTextMessage(senderID, "Type in a brand you're looking for");
          }
          else if (derivedPayload == "v2_youChoose") {
            callRrApi(senderID, "default");
          }
          else if (derivedPayload == "v2_restart") {
            v2_initialOptions(senderID);
          }
          else if (derivedPayload == "v2_tips") {
            sendTextMessage(senderID, "-Type keywords to find items: e.g. 'shoes’/‘Gucci'/'Show me suits'\n-Type ‘favorites’ to bring up the favorites list\n-Hit the Restart button to return to the main menu");
            // setTimeout(function() { v2_restartAnytime(senderID) }, 7000);
          }
          else if (derivedPayload.match(/(v2_BNY-)/g)) {
            callRrApi(senderID, derivedPayload.slice(3));
          }
        }
        else if(message.quick_reply && (message.quick_reply["payload"]).match(/(v2filter_)/g)){
          var derivedPayload = message.quick_reply["payload"];
          facetFilter(senderID, derivedPayload);
        }
        else if (message.quick_reply && (message.quick_reply["payload"]).match(/(sendFilters)/g)) {
          var derivedPayload = message.quick_reply["payload"];
          v2_sendFilters(senderID, derivedPayload.slice(11));
        }
        else {
        console.log("normal message");
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
        }
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
      v2_initialOptions(senderID);
      }
      else if (payload == 'showMoreItem') {
        console.log("show more item message");
        let apiai = apiaiApp.textRequest("see more items", {
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
      }
      else if (payload == 'browse') {
        sendCategoryOptions(senderID);
      }
      else if (payload == 'bye') {
        sayGoodBye(senderID);
      }
      else if (payload == 'v3_findIt') {
        v2_showFindList(senderID);
      }
      else if (payload == 'v3_justLooking') {
        v2_justLooking(senderID);
      }
      else if (payload == "v3_favorites") {
        returnFavList(senderID);
      }
      else if (payload == 'v3_tips') {
        sendTextMessage(senderID, "-Type keywords to find items: e.g. 'shoes’/‘Gucci'/'Show me suits'\n-Type ‘favorites’ to bring up the favorites list\n-Hit the Restart button to return to the main menu");
        // setTimeout(function() { v2_restartAnytime(senderID) }, 7000);
      }
      else if (payload == 'v3_inspireMe') {
        sendTextMessage(senderID, "Enter a text like 'I am looking for shirt'");
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
      else if (payload == 'v2_find') {
        v2_showFindList(senderID);
      }
      else if (payload.match(/(removeFav)/g)) {
        callRrFavApi(senderID, payload);
      }
      else if (payload.match(/(pairIt)/g)) {
        callRrApi(senderID, payload);
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

    //Facet filtering function
    function facetFilter(sid, pLoad){
      var facetAll = pLoad.charAt(9);
      var pName = pLoad.slice(10);
      var facet;
      if(facetAll == 'g'){
        facet = 'gender';
      }
      else if (facetAll == 'c') {
        facet = 'color';
      }
      else if (facetAll == 'b') {
        facet = 'brand';
      }
      else if (facetAll == 's') {
        facet = 'size';
      }

      facet_array.length = 0;
      var req_url = process.env.FIND_URL;
      var apiKey= process.env.API_KEY,
            apiClientKey= process.env.API_CLIENT_KEY,
            userId= process.env.USER_ID,
            sessionId= process.env.SESSION_ID,
            placements= process.env.PLACEMENTS_ID_FIND,
            lang= "en",
            query= GLOBAL_PRODUCT_NAME,
            start= 0,
            rows= "9";
      var  requesting = req_url + "?apiKey=" + apiKey + "&apiClientKey=" + apiClientKey + "&userId=" + userId + "&sessionId=" + sessionId + "&placements=" + placements + "&lang=en&start=0&rows=9&query=" + query + "&filter=" + GLOBAL_PRODUCT_BRAND + "&filter=" + GLOBAL_PRODUCT_GENDER + "&filter=" + GLOBAL_PRODUCT_COLOR + "&filter=" + GLOBAL_PRODUCT_SIZE + "facet=" + facet;
        request(requesting, function (error, response, body) {
          if (!error && response.statusCode == 200) {
            //parsing the json response from RR cloud
            body = JSON.parse(body);
            console.log("powerranger");
            facet_array = body.placements[0].facets[0].values;
            sendFacetOptions(sid, facet_array.slice(0,8), pName, facet);
            console.log(facet_array);
                  // setTimeout(function() { v2_restartAnytime(GLOBAL_ID) }, 7000);
        // The Description is:  "descriptive string"
      } else {
      console.log('Pavan api.ai, ERROR');
      }
        });


      var req_url = process.env.FIND_URL;
      var queryParameters = { apiKey: process.env.API_KEY,
            apiClientKey: process.env.API_CLIENT_KEY,
            userId: process.env.USER_ID,
            sessionId: process.env.SESSION_ID,
            placements: process.env.PLACEMENTS_ID_FIND,
            lang: "en",
            query: pName,
            facet: facet,
            start: 0,
            rows: "9"};
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
                    facet_array = body.placements[0].facets[0].values;
                    sendFacetOptions(sid, facet_array.slice(0,8), pName, facet);
                    console.log(facet_array);
                          // setTimeout(function() { v2_restartAnytime(GLOBAL_ID) }, 7000);
                // The Description is:  "descriptive string"
              } else {
              console.log('Pavan api.ai, ERROR');
              }
            });


    }

    function sendFacetOptions(recipientId, arrayHere, pName, facet){
      if (arrayHere.length !== 0) {
      var itemList = [];
      itemList.push(
        {
          content_type:"text",
          title: "back",
          payload: "sendFilters"+pName
        },{
          content_type:"text",
          title: "any " + facet,
          payload: "any" + facet
        });
      arrayHere.forEach(i=>{
         itemList.push({
             content_type:"text",
             title: i.value,
             payload: i.value
           });
      });
      itemList.push({
          content_type:"text",
          title: "more",
          payload: "moreFilterOptions"
        });
      console.log("dabang");
      console.log(recipientId);

      var messageData = {
        recipient: {
          id: recipientId
        },
        message: {
          text: "Please select an option",
          quick_replies: itemList
        }
      };

      callSendAPI(messageData);
      }
      else {
        sendTextMessage(recipientId, "Oops, no items found. Try with a differnt search criteria.");
      }
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
    //Quick replies on start
    function v2_initialOptions(recipientId){
      var messageData = {
      recipient:{
        id: recipientId
      },
      message:{
        text: "Hey! What would you like to do?",
        quick_replies:[
          {
            content_type:"text",
            title:"Find it",
            payload:"v2_find",
            image_url:"https://png.icons8.com/search/color/24"
          },
          {
            content_type:"text",
            title:"Just looking",
            payload:"v2_discover",
            image_url:"https://png.icons8.com/internet/dusk/24"
          },
          {
            content_type:"text",
            title:"See favorites",
            payload:"v2_favorites",
            image_url:"https://png.icons8.com/love/color/24"
          }
        ]
      }
    };
    callSendAPI(messageData);
    }

    //Quick replies on Just looking option
    function v2_justLooking(recipientId){
      var messageData = {
      recipient:{
        id: recipientId
      },
      message:{
        text: "Cool! Enter a category, brand, or leave it up to me to choose.",
        quick_replies:[
          {
            content_type:"text",
            title:"Category",
            payload:"v2_category"
          },
          {
            content_type:"text",
            title:"Brand",
            payload:"v2_brand"
          },
          {
            content_type:"text",
            title:"You choose",
            payload:"v2_youChoose",
            image_url:"https://png.icons8.com/compass/ios7/50"
          }
        ]
      }
    };
    callSendAPI(messageData);
    }
    //when the user chooses to search products
    function v2_showFindList(recipientId) {
      var messageData = {
      recipient:{
        id: recipientId
      },
      message:{
        text: "Great! Tell me what are looking for? You can either choose an option from below or enter a text like show me shirts",
        quick_replies:[
          {
            content_type:"text",
            title:"Shirts",
            payload:"Shirts",
            image_url:"https://png.icons8.com/shirt/win8/32"
          },
          {
            content_type:"text",
            title:"Shoes",
            payload:"Shoes",
            image_url:"https://png.icons8.com/shoes/color/24"
          },
          {
            content_type:"text",
            title:"Sweatshirts",
            payload:"Sweaters",
            image_url:"https://png.icons8.com/jacket/color/24"
          },
          {
            content_type:"text",
            title:"Jeans",
            payload:"Jeans",
            image_url:"https://png.icons8.com/jeans/color/24"
          },
          {
            content_type:"text",
            title:"Beauty",
            payload:"Beauty",
            image_url:"https://png.icons8.com/cosmetic-brush/color/24"
          },
          {
            content_type:"text",
            title:"Bags",
            payload:"Bags",
            image_url:"https://png.icons8.com/backpack/color/24"
          }
        ]
      }
    };
    callSendAPI(messageData);
    }

    //sending categories
    function v2_sendCategories(recipientId){
      var messageData = {
      recipient:{
        id: recipientId
      },
      message:{
        text: "Tell me which category you're looking for?",
        quick_replies:[
          {
            content_type:"text",
            title:"Women",
            payload:"v2_BNY-women",
            image_url:"https://png.icons8.com/female-profile/color/24"
          },
          {
            content_type:"text",
            title:"Men",
            payload:"v2_BNY-men",
            image_url:"https://png.icons8.com/user/color/24"
          },
          {
            content_type:"text",
            title:"Beauty",
            payload:"v2_BNY-womens-beauty",
            image_url:"https://png.icons8.com/makeup/color/24"
          },
          {
            content_type:"text",
            title:"Kids",
            payload:"v2_BNY-kids",
            image_url:"https://png.icons8.com/children/ios7/25"
          },
          {
            content_type:"text",
            title:"Home",
            payload:"v2_BNY-home",
            image_url:"https://png.icons8.com/home/office/30"
          }
        ]
      }
    };
    callSendAPI(messageData);
    }

    //sending categories
    function v2_sendFilters(recipientId, pName){
      var messageData = {
      recipient:{
        id: recipientId
      },
      message:{
        text: "Choose a Filter:",
        quick_replies:[
          {
            content_type:"text",
            title:"Gender",
            payload:"v2filter_g" + pName
          },
          {
            content_type:"text",
            title:"Color",
            payload:"v2filter_c" + pName
          },
          {
            content_type:"text",
            title:"Brand",
            payload:"v2filter_b" + pName
          },
          {
            content_type:"text",
            title:"Size",
            payload:"v2filter_s" + pName
          }
        ]
      }
    };
    callSendAPI(messageData);
    }

    //function to send restart button and tips
    function v2_restartAnytime(recipientId){
      var messageData = {
      recipient:{
        id: recipientId
      },
      message:{
        text: "Need help? Click below:",
        quick_replies:[
          {
            content_type:"text",
            title:"Restart",
            payload:"v2_restart",
            image_url:"https://png.icons8.com/restart/color/48"
          },
          {
            content_type:"text",
            title:"Tips",
            payload:"v2_tips",
            image_url:"https://png.icons8.com/marker-filled/ios7/32"
          }
        ]
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

    function sendGenericMessage(recipientId, arrayHere) {
      console.log(recipientId);

      console.log("fidget spinner");
      // console.log(arrayHere);
      if (arrayHere.length !== 0) {

        sendTextMessage(recipientId, "Here’s what I found:");
        var itemList = [];
      arrayHere.forEach(i=>{
        if (i.isRecommendable == true) {
         itemList.push(
         {
          "title":i.name,
          "subtitle":i.brand,
          "item_url":i.productURL,
          //manipulating the image using Cloudinary
          "image_url":cloudinary.url(i.imageURL,{ type: 'fetch', height: 500, width: 955, background: "white", crop: "pad", quality: 100, fetch_format: 'jpg'}),
          "buttons" : [
              {
                "type": "postback",
                "title": "More like this",
                "payload": "similar"+i.id
              }, {
                "type": "postback",
                "title": "Pair it with",
                "payload": "pairIt"+i.id
              }, {
                "type": "postback",
                "title": "Save it",
                "payload": "fav"+i.id
              }]
         });
       }
      });
      console.log("dabang");
      console.log(recipientId);
      var messageData = {
        recipient: {
          id: recipientId
        },
        message: {
          attachment: {
            type: "template",
            payload: {
              template_type: "generic",
              image_aspect_ratio: "horizontal",
              elements: itemList
            }
          }
        }
      };

      callSendAPI(messageData);
      }
      else {
        sendTextMessage(recipientId, "Oops, no items found. Try with a differnt search criteria.");
      }

    }

    function sendGenericMessageForSearch(recipientId, arrayHere) {
      if (arrayHere.length !== 0) {
        sendTextMessage(recipientId, "Here’s what I found:");
        var itemList = [];
      arrayHere.forEach(i=>{
         itemList.push(
         {
          "title":i.name,
          "subtitle":i.brand,
          "item_url":i.linkId,
          //manipulating the image using Cloudinary
          "image_url":cloudinary.url(i.imageId,{ type: 'fetch', height: 500, width: 955, background: "white", crop: "pad", quality: 100, fetch_format: 'jpg'}),
          "buttons" : [
              {
                "type": "postback",
                "title": "More like this",
                "payload": "similar"+i.id
              }, {
                "type": "postback",
                "title": "Pair it with",
                "payload": "pairIt"+i.id
              }, {
                "type": "postback",
                "title": "Save it",
                "payload": "fav"+i.id
              }]
         });
      });
      itemList.push(
        {
          "title":"Rory",
          "item_url": process.env.BNY_HOME,
          "image_url":"https://res.cloudinary.com/goodsearch/image/upload/v1436553720/hi_resolution_merchant_logos/barneys-new-york_coupons.jpg",
          "buttons" : [
              {
                "type": "postback",
                "title": "See more items",
                "payload": "showMoreItem"
              }]
        }
      );
      console.log("shahrukh");
        var messageData = {
          recipient: {
            id: recipientId
          },
          message: {
            attachment: {
              type: "template",
              payload: {
                template_type: "generic",
                image_aspect_ratio: "horizontal",
                elements: itemList
              }
            }
          }
        };

        callSendAPI(messageData);
      }
      else {
        sendTextMessage(recipientId, "Oops, no items found. Try with a differnt search criteria.");
      }

    }
    //Sending generic message with Favorite items
    function sendGenericMessageForFavoriteItems(recipientId, arrayHere) {
      sendTextMessage(recipientId, "Here’s what you’ve saved:");
      var itemList = [];
    arrayHere.forEach(i=>{
       itemList.push(
       {
        "title":i.name,
        "subtitle":i.brand,
        "item_url":i.productURL,
        //manipulating the image using Cloudinary
        "image_url":cloudinary.url(i.imageURL,{ type: 'fetch', height: 500, width: 955, background: "white", crop: "pad", quality: 100, fetch_format: 'jpg'}),
        "buttons" : [
            {
              "type": "postback",
              "title": "More like this",
              "payload": "similar"+i.id
            }, {
              "type": "postback",
              "title": "Pair it with",
              "payload": "pairIt"+i.id
            }, {
              "type": "postback",
              "title": "Remove item",
              "payload": "removeFav"+i.id
            }]
       });
    });
    console.log("dabang");
      var messageData = {
        recipient: {
          id: recipientId
        },
        message: {
          attachment: {
            type: "template",
            payload: {
              template_type: "generic",
              image_aspect_ratio: "horizontal",
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
      // var mySt = Math.floor((Math.random() * 30) + 1).toString();
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
              st: 0,
              count: '9',
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
      else if (queryString.match(/(pairIt)/g)) {
        var req_url = process.env.STAGING_URL;
        var queryParameters = { apiKey: process.env.API_KEY,
              apiClientKey: process.env.API_CLIENT_KEY,
              userId: process.env.USER_ID,
              sessionId: process.env.SESSION_ID,
              placements: process.env.PLACEMENTS_ID_COMPLEMENTARY,
              productId: queryString.slice(6)};
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
                  rr_array = body.products;
                  sendGenericMessageForFavoriteItems(sid, rr_array);
                }
                else {
                      rr_array = body.placements[0].recommendedProducts;
                      sendGenericMessage(sid, rr_array);
                    }
                    // setTimeout(function() { v2_restartAnytime(sid) }, 7000);
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
              uri: "https://qa.richrelevance.com/rrserver/api/find/v1/dbeab3c977a08905?facet=&query="+queryString+"&lang=en&start=0&rows=5&placement=generic_page.rory_search&userId=ulichi&sessionId=mysession",
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
                            // setTimeout(function() { v2_restartAnytime(sid) }, 7000);
                      // The Description is:  "descriptive string"
                    } else {
                      sendTextMessage(sid, 'Pavan, ERROR');
                    }
                  });
                }

          //Block that calls RR api(add to favorites)
          function callRrFavApi(sid, queryString){
            console.log("Favorite anushka called");
            if (queryString.match(/(removeFav)/g)) {
              console.log("rr remove fav");
              var req_url = process.env.PROD_URL;
              var queryParameters = { apiKey: process.env.BY_FAV_API_KEY,
                    u: process.env.USER_ID,
                    s: process.env.SESSION_ID,
                    p: queryString.slice(9),
                    targetType: process.env.BY_FAV_TARGETTYPE,
                    actionType: process.env.BY_FAV_ACTIONTYPE_NEUTRAL};
            }
            else {
              console.log("jindabad");
              var req_url = process.env.PROD_URL;
              var queryParameters = { apiKey: process.env.BY_FAV_API_KEY,
                    u: process.env.USER_ID,
                    s: process.env.SESSION_ID,
                    p: queryString.slice(3),
                    targetType: process.env.BY_FAV_TARGETTYPE,
                    actionType: process.env.BY_FAV_ACTIONTYPE};
                  }
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
                      if (queryString.match(/(removeFav)/g)) {
                        sendTextMessage(sid, "Item removed from your list");
                      }
                      else {
                      sendTextMessage(sid, "It's on the list");
                    }
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
                  var options = {
                    uri: process.env.PROD_FAV_URL,
                    qs: queryParameters,
                    headers: {
                      'User-Agent': 'Mozilla/5.0 (Linux; Android 5.1.1; A1 Build/LMY47V) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.116 Mobile Safari/537.36'
                      },
                    json: true
                  };
                  reqPromise(options)
                    .then(function(body){
                      console.log("promising really!");
                      // console.log(repos);
                      if ((typeof body.pref_product.LIKE) == "object") {
                         rr_array_temp = "favorite" + body.pref_product.LIKE.join("|");
                         console.log("Rajinikanth");
                         callRrApi(sid, rr_array_temp);
                       }
                       else {
                         sendTextMessage(sid, "Oops! Looks like you don’t have anything saved.");
                     }
                    })
                    .catch(function(err){
                      console.log("api call failed");
                      sendTextMessage(sid, "Please try again");
                    });
                  // request({
                  //   method: 'GET',
                  //   }, function (error, response, body) {
                  //         if (!error && response.statusCode == 200) {
                  //           body = JSON.parse(body);
                  //           console.log("samantha4 inside function");
                  //         //  console.log((typeof body.pref_product.LIKE));
                  //           if ((typeof body.pref_product.LIKE) == "object") {
                  //             rr_array_temp = "favorite" + body.pref_product.LIKE.join("|");
                  //             console.log("Rajinikanth");
                  //             callRrApi(sid, rr_array_temp);
                  //           }
                  //           else {
                  //             sendTextMessage(sid, "Oops! Looks like you don’t have anything saved.");
                  //         }
                  //           } else {
                  //           // console.log('Google log start golden');
                  //           // console.log(body) // Print the google web page.
                  //           // console.log('Google log end golden');
                  //           sendTextMessage(sid, 'Anushka, ERROR');
                  //         }
                  //       });
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
          // console.error(response);
          console.log("the seperator");
          console.error(error);
        }
      });
    }

    // Set Express to listen out for HTTP requests
    var server = app.listen(process.env.PORT || 3000, function () {
      console.log("Listening on port %s", server.address().port);
    });

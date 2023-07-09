const express = require('express');
const bodyParser = require('body-parser');

// Use the web-push library to hide the implementation details of the communication
// between the application server and the push service.
// For details, see https://tools.ietf.org/html/draft-ietf-webpush-protocol and
// https://tools.ietf.org/html/draft-ietf-webpush-encryption.
const webPush = require("web-push");

const app = express();
const port = process.env.PORT || 3003;

if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
  console.log(
    "You must set the VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY " +
      "environment variables. You can use the following ones:"
  );
  console.log(webPush.generateVAPIDKeys());
  return;
}
// Set the keys used for encrypting the push messages.
webPush.setVapidDetails(
  "https://example.com/",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

app.use(express.static('public'));
app.use(bodyParser.json());
app.use(function forceSSL(req, res, next) {
  var host = req.get('Host');
  var localhost = 'localhost';

  if (host.substring(0, localhost.length) !== localhost) {
    // https://developer.mozilla.org/en-US/docs/Web/Security/HTTP_strict_transport_security
    res.header('Strict-Transport-Security', 'max-age=15768000');
    // https://github.com/rangle/force-ssl-heroku/blob/master/force-ssl-heroku.js
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect('https://' + host + req.url);
    }
  }
  return next();
});

// Global array collecting all active endpoints. In real world
// application one would use a database here.
const subscriptions = {};


// Send notification to the push service. Remove the subscription from the
// `subscriptions` array if the  push service responds with an error.
// Subscription has been cancelled or expired.
function sendNotification(subscription) {
  webPush
    .sendNotification(subscription)
    .then(function () {
      console.log(
        "Push Application Server - Notification sent to " +
          subscription.endpoint
      );
    })
    .catch(function () {
      console.log(
        "ERROR in sending Notification, endpoint removed " +
          subscription.endpoint
      );
      delete subscriptions[subscription.endpoint];
    });
}


  app.get("/vapidPublicKey", function (req, res) {
    res.send(process.env.VAPID_PUBLIC_KEY);
  });

  // Register a subscription by adding it to the `subscriptions` array.
  app.post("/register", function (req, res) {
    var subscription = req.body.subscription;
    if (!subscriptions[subscription.endpoint]) {
      console.log("Subscription registered " + subscription.endpoint);
      subscriptions[subscription.endpoint] = subscription;
    }
    res.sendStatus(201);
  });

  // Unregister a subscription by removing it from the `subscriptions` array
  app.post("/unregister", function (req, res) {
    var subscription = req.body.subscription;
    if (subscriptions[subscription.endpoint]) {
      console.log("Subscription unregistered " + subscription.endpoint);
      delete subscriptions[subscription.endpoint];
    }
    res.sendStatus(201);
  });

  app.get("/num-subscriptions", function (req, res) {
    res.json({result: Object.values(subscriptions).length});
  });
  
  app.post("/trigger-notification", function (req, res) {
    if(Object.values(subscriptions).length > 0) {
      Object.values(subscriptions).forEach(sendNotification);
      res.json({result: "Notification sent"});
    } else {
      res.json({result: "There are no active subscriptions"});
    }
  });

app.listen(port, function () {
  console.log(`Example app running on port ${port}`);
});
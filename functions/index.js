/**
 * Copyright 2016 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

// [START all]
// [START import]
// The Cloud Functions for Firebase SDK to create Cloud Functions and setup triggers.
const functions = require('firebase-functions');

// The Firebase Admin SDK to access the Firebase Realtime Database.
const admin = require('firebase-admin');
admin.initializeApp();
// [END import]

// Function to generate OTP from
// https://www.geeksforgeeks.org/javascript-program-to-generate-one-time-password-otp/
function generateOTP() {
    // Declare a string variable
    // which stores all string
    var string = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let OTP = '';
    // Find the length of string
    var len = string.length;
    for (let i = 0; i < 6; i++ ) {
        OTP += string[Math.floor(Math.random() * len)];
    }
    return OTP;
}

// [START registerDevice]
// For device to take dataset_id (passed to HTTP endpoint) come up with token,
// and insert it into the Firestore under the path /messages/:pushId/original
// [START addMessageTrigger]
exports.registerDevice = functions.https.onRequest(async (req, res) => {
// [END addMessageTrigger]
  // Grab the text parameter.
  const dataset_id = req.query.dataset_id;
  // TODO: Check connection_status is unconnected.
  // Come up with OTP token
  const token = generateOTP();
  // [START adminSdkPush]
  const datasetRef = await admin.firestore().doc('/datasets/' + dataset_id)
  datasetRef.update({OTP: token});

  res.status(200).send(token);
  // [END adminSdkPush]
});

//After data owner script accepts the dataset id and gets the OTP, the user puts this otp
//into their front-end which triggers this api
exports.verifyOwnerOTP = functions.https.onRequest(async (req, res) => {
  const otp = req.query.otp;
  const dataset = req.query.dataset_id;
  var result = true;
  await admin.firestore().doc('/datasets/' + dataset).get().then(doc => {
    if (!doc || !doc.exists || doc.data().otp !== otp) {
      result = false;
    }
  });
  let docRef = admin.firestore().doc('/datasets/' + dataset);
  docRef.update({
    otp: firebase.firestore.FieldValue.delete()
  });
  if (!result) {
    res.status(400).send();
    return;
  }
  const connectionToken = generateOTP();
  await admin.firestore().doc('/owner-tokens/' + ownerToken).set({dataset_id: dataset});
  res.status(200).send(connectionToken);
});

//verifies the connection token that the data owner uses to connec to tornado
exports.verifyOwnerToken = functions.https.onRequest(async (req, res) => {
  const token = req.query.token;
  const dataset = req.query.dataset;
  await admin.firestore().doc('/owner-tokens/' + token).get().then(doc => {
    if (!doc || !doc.exists || doc.data().dataset_id !== dataset) {
      res.status(400).send();
      return;
    }
  });
  await admin.firestore().doc('/owner-tokens/' + token).delete();
  res.status(200).send(dataset);
});


//called when the researcher enters their api key (project key) into the jupyter notebook
//finds all the approved requests for this project and creates and sends connection tokens for them
exports.createResearcherTokens = functions.https.onRequest(async (req, res) => {
  const project_key = req.query.project_key;
  var requests;
  await admin.firestore().doc('/projects/' + project_key).get().then(doc => {
    if (doc && doc.exists) {
      requests = doc.data()["list_of_requests"];
    }
  });
  if (requests.length == 0) {
    res.status(404).send();
  } else {
    var tokenMap;
    for (var i = 0; i < requests.length; i++) {
      const data_request = requests[i];
      var curr;
      await admin.firestore().doc("/" + data_request.path).get().then(doc => {
        if (doc && doc.exists) {
          curr = doc.data();
        }
      });
      console.log("got");
      console.log(curr);
      if (curr["status"] === "Approved") {
        console.log("approved");
        const token = generateOTP();
        const id = curr["dataset_id"];
        console.log(id);
        const snapshot = await admin.firestore().doc('/researcher-tokens/' + token).set({dataset_id: id});
        tokenMap[token] = id;
      }
    }
    res.status(200).send(tokenMap);
  }
});

//Researcher api provides these tokens and requested dataset when connecting to Tornado,
//Tornado calls this api to verify that it was valid request and then queues it, and removes the token.
exports.verifyResearcherToken = functions.https.onRequest(async (req, res) => {
  const token = req.query.token;
  const dataset = req.query.dataset;
  await admin.firestore().doc('/researcher-tokens/' + token).get().then(doc => {
    if (!doc || !doc.exists || doc.data().dataset_id !== dataset) {
      res.status(400).send();
      return;
    }
  });
  await admin.firestore().doc('/researcher-tokens/' + token).delete();
  res.status(200).send();
});
// [END addMessage]

// [START makeUppercase]
// Listens for new messages added to /messages/:pushId/original and creates an
// uppercase version of the message to /messages/:pushId/uppercase
// exports.makeUppercase = functions.database.ref('/messages/{pushId}/original')
//     .onCreate((snapshot, context) => {
//       // Grab the current value of what was written to the Realtime Database.
//       const original = snapshot.val();
//       console.log('Uppercasing', context.params.pushId, original);
//       const uppercase = original.toUpperCase();
//       // You must return a Promise when performing asynchronous tasks inside a Functions such as
//       // writing to the Firebase Realtime Database.
//       // Setting an "uppercase" sibling in the Realtime Database returns a Promise.
//       return snapshot.ref.parent.child('uppercase').set(uppercase);
//     });
// [END makeUppercase]
// [END all]

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

exports.createResearcherTokens = functions.https.onRequest(async (req, res) => {
  const project_key = req.query.project_key;
  const requests = await admin.firestore().doc('/projects/' + project_key).get()["list_of_requests"];
  approved_datasets = [];
  for each (var data_request in requests) {
    curr = await admin.firestore().doc('/requests/' + data_request).get();
    if (curr["status"] === "Approved") {
      approved_datasets.push(curr["dataset_id"]);
    }
  }
  //now all the approved datasets are collected, need to generate tokens for them and add records to Firebase
  for each (var dataset in approved_datasets) {
    const token = generateOTP();
    const snapshot = await admin.firestore().doc('/researcher-tokens/' + token)
                                .set({dataset_id: dataset});
  }
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

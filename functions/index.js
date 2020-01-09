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

// The Cloud Functions for Firebase SDK to create Cloud Functions and setup triggers.
const functions = require('firebase-functions');

// The Firebase Admin SDK to access the Firebase Realtime Database.
const admin = require('firebase-admin');
admin.initializeApp();

const connection_statuses = {
  planned: 'planned', // unconnected
  available: 'available', // owner registered device w OTP, tornado knows connected
  unavailable: 'unavailable', // connection is in use
}

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

exports.registerDevice = functions.https.onRequest(async (req, res) => {
  // Grab the text parameter.
  const dataset_id = req.query.dataset_id;
  // TODO: Check connection_status is 'planned'.
  var result = true;
  await admin.firestore().doc('/datasets/' + dataset_id).get().then(doc => {
    if (!doc || !doc.exists || doc.data().connection_status !== connection_statuses.planned) {
      res.status(400).send();
      result = false;
    }
  });
  // Come up with OTP token
  if (result) {
    const token = generateOTP();
    const datasetRef = await admin.firestore().doc('/datasets/' + dataset_id)
    datasetRef.update({OTP: token});

    res.status(200).send();
  }

});

//After data owner script accepts the dataset id and gets the OTP, the user puts this otp
//into their console which triggers this api
exports.verifyOwnerOTP = functions.https.onRequest(async (req, res) => {
  const otp = req.query.otp;
  const dataset = req.query.dataset_id;
  var result = true;
  await admin.firestore().doc('/datasets/' + dataset).get().then(doc => {
    if (!doc || !doc.exists || doc.data().OTP !== otp) {
      result = false;
    }
  });
  let docRef = admin.firestore().doc('/datasets/' + dataset);
  docRef.update({
    OTP: admin.firestore.FieldValue.delete()
  });
  if (!result) {
    res.status(400).send();
    return;
  }
  const connectionToken = generateOTP();
  const snapshot = await admin.firestore().doc('/owner-tokens/' + connectionToken).set({dataset_id: dataset});
  res.status(200).send(connectionToken);
});

//verifies the connection token that the data owner uses to connec to tornado
exports.verifyOwnerToken = functions.https.onRequest(async (req, res) => {
  const token = req.query.token;
  const dataset = req.query.dataset;
  var result = true;
  await admin.firestore().doc('/owner-tokens/' + token).get().then(doc => {
    if (!doc || !doc.exists || doc.data().dataset_id !== dataset) {
      res.status(400).send();
      result = false;
    }
  });
  if (result) {
    await admin.firestore().doc('/owner-tokens/' + token).delete();
    const datasetRef = await admin.firestore().doc('/datasets/' + dataset)
    datasetRef.update({connection_status: connection_statuses.available});
    res.status(200).send(dataset);
  }
});

exports.disconnectDevice = functions.https.onRequest(async (req, res) => {
  // Grab the dataset_id parameter.
  const dataset_id = req.query.dataset_id;
  const datasetRef = await admin.firestore().doc('/datasets/' + dataset_id)
  datasetRef.update({connection_status: connection_statuses.planned});
})

exports.setDeviceAsUnavailable = functions.https.onRequest(async (req, res) => {
  // Grab the dataset_id parameter.
  const dataset_id = req.query.dataset_id;
  const datasetRef = await admin.firestore().doc('/datasets/' + dataset_id)
  datasetRef.update({connection_status: connection_statuses.unavailable});
})

exports.setDeviceAsAvailable = functions.https.onRequest(async (req, res) => {
  // Grab the dataset_id parameter.
  const dataset_id = req.query.dataset_id;
  const datasetRef = await admin.firestore().doc('/datasets/' + dataset_id)
  datasetRef.update({connection_status: connection_statuses.available});
})

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
  var result = true;
  await admin.firestore().doc('/researcher-tokens/' + token).get().then(doc => {
    if (!doc || !doc.exists || doc.data().dataset_id !== dataset) {
      res.status(400).send();
      result = false;
    }
  });
  if (result) {
    await admin.firestore().doc('/researcher-tokens/' + token).delete();
    res.status(200).send();
  }
});

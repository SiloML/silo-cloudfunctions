# SiloML Cloud Functions

SiloML is a federated data platform for life science researchers to answer questions about clinical data that’s physically on their partners’ databases.

## Introduction

These cloud functions form the "back-end" of the [SiloML](https://www.siloml.us) platform. The functions are called by the webapp, the dataowner, the researcher, and the tornado server. All the functions are in the `functions/index.js` file:
- `registerDevice`
- `verifyOwnerOTP` 
- `verifyOwnerToken` 
- `disconnectDevice`
- `setDeviceAsUnavailable` 
- `setDeviceAsAvailable`
- `createResearcherTokens`
- `verifyResearcherToken`

## Deploy

To deploy, run `firebase deploy` from the `functions` directory.

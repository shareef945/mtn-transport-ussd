require("dotenv").config({ path: "../.env" });
// const { initializeApp } = require("firebase/app");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const bcrypt = require("bcrypt");
const functions = require("firebase-functions");
const firebase = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
require("firebase/firestore");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const app = express();
const token = require("./generateToken.js");
const {
  swapRouteDetails,
  convertToMsisdn,
  getTransactionsForMerchant,
  sendSMS,
  createRoute,
  isMerchant,
  patchMate,
  verifyRider,
  requestToPay,
  changeVehicleInfo,
  createMerchant,
  getMerchant,
  encryptPin,
  createTrip,
  getTrips,
} = require("./utils.js");

//web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: "mtn-transport-api.firebaseapp.com",
  projectId: "mtn-transport-api",
  storageBucket: "mtn-transport-api.appspot.com",
  messagingSenderId: "647231088394",
  appId: process.env.FIREBASE_APP_ID,
  measurementId: "G-0KX19P93SB",
};

// Initialize Firebase
const webapp = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());

const api_root =
  "https://us-central1-sem-transport-api-65ebf.cloudfunctions.net/api";

const preApprovalApi =
  "https://proxy.momoapi.mtn.com/collection/v2_0/preapproval";

const mtnCollectionTokenUrl = "https://proxy.momoapi.mtn.com/collection/token/";
const mtnCollectionToken = `Basic ${process.env.MTN_COLLECTION_TOKEN}`;
const mtnTargetEnvironment = "mtnghana";
const mtnPreApprovalUrl =
  "https://proxy.momoapi.mtn.com/collection/v2_0/preapproval";

const mtnCollectionUrl =
  "https://proxy.momoapi.mtn.com/collection/v1_0/requesttopay";

const mtnDisbursmentUrl =
  "https://proxy.momoapi.mtn.com/disbursement/v1_0/transfer";

const callbackUrl =
  "https://us-central1-sem-transport-api-65ebf.cloudfunctions.net/api/callback";

const hubtelClientSecret = "";
const hubtelClientId = "";
const hubtelSMSApi = "https://smsc.hubtel.com";
const collectionsOva = "233246424070";
const disbursementsOva = "233599670207";

app.get("/", (req, res) => {
  res.send("Server is up and running");
});

//rider
//7+1+1+1

app.post("/ussd/v2/rider", async (req, res) => {
  const {
    Type,
    Mobile,
    SessionId,
    ServiceCode,
    Message,
    Operator,
    Sequence,
    ClientState,
    Platform,
  } = req.body;
  let response;

  const phoneRegex = /^0[2357][0-9]{8}$/;

  switch (Type) {
    case "initiation":
      response = {
        SessionId: SessionId,
        Type: "response",
        Message:
          "1. Transfer Money \n2. MomoPay & Pay Bill \n3. Airtime & Bundles \n4. Allow Cash Out \n5. Financial Services \n6. Wallet \n7. Transport",
        Mask: null,
        MaskNextRoute: null,
        Item: null,
        ServiceCode: null,
        Label: "Welcome to SAI Transport",
        DataType: "input",
        FieldType: "text",
        Data: null,
        sequence: Sequence + 1,
      };
      break;
    case "response":
      switch (Sequence) {
        case 1:
          response = {
            SessionId: SessionId,
            Type: "response",
            Message: "1. Merchant \n2. Rider",
            Mask: null,
            MaskNextRoute: null,
            Item: null,
            ServiceCode: null,
            Label: "Transport",
            DataType: "input",
            FieldType: "text",
            Data: null,
            sequence: Sequence + 1,
          };
          break;
        case 2:
          switch (String(Message)) {
            case "1":
              response = {
                SessionId: SessionId,
                Type: "response",
                Message: "1. New route \n2.View Route \n3.View transactions",
                Mask: null,
                MaskNextRoute: null,
                Item: null,
                ServiceCode: null,
                Label: "Transport",
                DataType: "input",
                FieldType: "text",
                ClientState: "merchant",
                Data: null,
                sequence: Sequence + 1,
              };
              break;
            case "2":
              response = {
                SessionId: SessionId,
                Type: "response",
                Message: "1. Pay \n2. View Trips",
                Mask: null,
                MaskNextRoute: null,
                Item: null,
                ServiceCode: null,
                Label: "Transport",
                DataType: "input",
                FieldType: "text",
                ClientState: "rider",
                Data: null,
                sequence: Sequence + 1,
              };
              break;
          }
          break;
        case 3:
          console.log("Client State: ", ClientState);
          switch (ClientState) {
            case "merchant":
              // MERCHANT
              switch (String(Message)) {
                case "1":
                  response = {
                    SessionId: SessionId,
                    Type: "response",
                    Message: "Here is a new route",
                    Mask: null,
                    MaskNextRoute: null,
                    Item: null,
                    ServiceCode: null,
                    Label: "Transport",
                    DataType: "input",
                    FieldType: "number",
                    Data: null,
                    sequence: Sequence + 1,
                  };
                  break;
              }
              break;
            case "rider":
              // RIDER
              switch (String(Message)) {
                case "1":
                  response = {
                    SessionId: SessionId,
                    Type: "response",
                    Message: "Pay for a trip",
                    Mask: null,
                    MaskNextRoute: null,
                    Item: null,
                    ServiceCode: null,
                    Label: "Transport",
                    DataType: "input",
                    FieldType: "number",
                    Data: null,
                    sequence: Sequence + 1,
                  };
                  break;
                case "2":
                  const tripList = await getTrips(convertToMsisdn(Mobile));
                  let recentTrips;
                  let tripRes = "Here are your recent trips: ";
                  if (tripList) {
                    recentTrips = tripsList.join("\n\n");
                    tripRes = tripRes + recentTrips;
                    response = {
                      SessionId: SessionId,
                      Type: "response",
                      Message: tripRes,
                      Mask: null,
                      MaskNextRoute: null,
                      Item: null,
                      ServiceCode: null,
                      Label: "Transport",
                      DataType: "input",
                      FieldType: "number",
                      Data: null,
                      sequence: Sequence + 1,
                    };
                  } else {
                    tripRes = "You have no trips yet";
                    response = {
                      SessionId: SessionId,
                      Type: "release",
                      Message: tripRes,
                      Mask: null,
                      MaskNextRoute: null,
                      Item: null,
                      ServiceCode: null,
                      Label: "Transport",
                      DataType: "input",
                      FieldType: "display",
                      Data: null,
                      sequence: Sequence + 1,
                    };
                  }
                  break;
              }
              break;
          }
          break;

        default:
          response = {
            SessionId: SessionId,
            Type: "release",
            Message: "Invalid input",
            Mask: null,
            MaskNextRoute: null,
            Item: null,
            ServiceCode: null,
            Label: "Transport",
            DataType: "input",
            FieldType: "text",
            Data: null,
            sequence: Sequence + 1,
          };
          break;
      }
      break;
  }
  res.set("Content-Type", "application/json");
  res.send(response);
});

exports.mtn_transport = functions.https.onRequest(app);

// TODO , figure out how to move this to services.js again
exports.merchant_settlement = functions.firestore
  .document("merchant_transactions/{transactionId}")
  .onUpdate(async (change, context) => {
    const transaction_id = context.params.transactionId;
    // Get an object representing the document
    const newValue = change.after.data();
    // ...or the previous value before this update
    const previousValue = change.before.data();
    if (
      previousValue.transaction_status == "pending" &&
      newValue.transaction_status == "SUCCESSFUL" &&
      newValue?.settlement != true
    ) {
      const merchantPhoneNumber = newValue.receiver_account;
      const amount = newValue.amount;
      console.log(
        `Settlement due for transaction with transaction id ${transaction_id} of amount ${amount} and to ${merchantPhoneNumber}`
      );
      // settlement function
      await ovaDisbursement(merchantPhoneNumber, amount);
      // log to firebase as settlement: true
      await db
        .collection("merchant_transactions")
        .doc(transaction_id)
        .update({ settlement: true, settled: new Date().getTime() });
    } else {
      console.log("Something changed but it was not a transaction status");
    }
    console.log(previousValue, newValue);
  });

// movement to OVA
async function ovaDisbursement(merchantPhoneNumber, amount) {
  try {
    const mtnToken = await generateMtnToken();
    const url = mtnDisbursmentUrl;
    const uuid = uuidv4();
    console.log(`Movement to OVA for ${amount} uses this uuid: ${uuid}`);
    const data = {
      amount: amount.toString(),
      currency: "GHS",
      externalId: uuid,
      payer: {
        partyIdType: "MSISDN",
        partyId: disbursementsOva,
      },
      payerMessage: "MTN TRANSPORT SETTLEMENT OVA Movement",
      payeeNote: "MTN TRANSPORT SETTLEMENT OVA Movement",
    };

    const res = await axios.post(url, data, {
      headers: {
        Authorization: `Bearer ${mtnToken}`,
        "X-Reference-Id": uuid,
        "X-Target-Environment": mtnTargetEnvironment,
        "Ocp-Apim-Subscription-Key":
          process.env.MTN_COLLECTION_DISBURSEMENT_KEY,
      },
    });

    if (res.status === 202) {
      console.log(
        `Movement to OVA successful, need to pay merchant: ${merchantPhoneNumber}, fare: ${amount}, uuid for this step is ${uuid}`
      );
      await disbursement(merchantPhoneNumber, amount);
      // log merchant transaction
    } else {
      console.log(
        `Movement to OVA failed, need to pay merchant: ${merchantPhoneNumber}, fare: ${amount}. uuid for this step is ${uuid}`
      );
    }
  } catch (error) {
    console.error(
      `Error while moving ${amount} to OVA to pay ${merchantPhoneNumber}: ${error.message}`
    );
  }
}

// movement from OVA to  the merchant
async function disbursement(merchantPhoneNumber, amount) {
  try {
    const mtnToken = await generateMtnToken();
    const url = mtnDisbursmentUrl;
    const uuid = uuidv4();
    console.log(`Movement to OVA for ${amount} uses this uuid: ${uuid}`);
    const data = {
      amount: amount.toString(),
      currency: "GHS",
      externalId: uuid,
      payer: {
        partyIdType: "MSISDN",
        partyId: merchantPhoneNumber,
      },
      payerMessage: "MTN TRANSPORT SETTLEMENT",
      payeeNote: "MTN TRANSPORT SETTLEMENT",
    };

    const res = await axios.post(url, data, {
      headers: {
        Authorization: `Bearer ${mtnToken}`,
        "X-Reference-Id": uuid,
        "X-Target-Environment": mtnTargetEnvironment,
        "Ocp-Apim-Subscription-Key":
          process.env.MTN_COLLECTION_DISBURSEMENT_KEY,
      },
    });

    if (res.status === 202) {
      console.log(
        `Payment successful, rider: ${merchantPhoneNumber}, fare: ${amount}`
      );
      // log merchant transaction
    } else {
      console.log(
        `Payment request failed, rider: ${merchantPhoneNumber}, fare: ${amount}`
      );
    }
  } catch (error) {
    console.error(
      `Error while requesting payment for rider ${merchantPhoneNumber}: ${error.message}`
    );
  }
}

async function generateMtnToken() {
  console.log("Generating MTN token");
  console.log("Token to folow");
  console.log("token", mtnCollectionToken);
  try {
    const response = await axios.post(mtnCollectionTokenUrl, null, {
      headers: {
        Authorization: mtnCollectionToken,
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key":
          process.env.MTN_COLLECTION_SUBSCRIPTION_KEY,
        "X-Target-Environment": mtnTargetEnvironment,
        "Cache-Control": "no-cache",
      },
    });
    const token = response.data.access_token;
    return token;
  } catch (error) {
    console.error(error.message);
  }
}

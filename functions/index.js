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

const rider = {
  name: "Shareef Ali",
  phone_number: "233243945815",
  id: "233243945815",
  dob: "1995-01-01",
  email: "shareef945@gmail.com",
};

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
  // console.log(req.body);
  let response;

  const phoneRegex = /^0[2357][0-9]{8}$/;

  const MerchantNum = "233242956815";

  switch (Type) {
    case "Initiation":
      response = {
        SessionId: SessionId,
        Type: "response",
        Message:
          "1. Transfer Money \n2. MomoPay & Pay Bill \n3. Airtime & Bundles \n4. Allow Cash Out \n5. Financial Services \n6. Wallet \n7. Transport",
        Label: "Welcome to SAI Transport",
        DataType: "input",
        FieldType: "text",
      };
      break;
    case "Timeout":
      response = {
        SessionId: SessionId,
        Type: "release",
        Message: "Session timed out",
        Label: "Transport",
        DataType: "display",
        FieldType: "text",
      };
    case "Response":
      switch (Sequence) {
        case 2:
          //7
          switch (String(Message)) {
            case "7":
              response = {
                SessionId: SessionId,
                Type: "response",
                Message: "1. Merchant \n2. Rider",
                Label: "Transport",
                DataType: "input",
                FieldType: "text",
              };
              break;
          }
        case 3:
          //7*1 or 7*2
          switch (String(Message)) {
            case "1": // 7*1 merchant
              // check if Merchant exists on DB
              const result = await isMerchant(MerchantNum);
              console.log("Is this a merchant? :", result);
              try {
                if (result.role == "driver") {
                  response = {
                    SessionId: SessionId,
                    Type: "response",
                    Message: "Enter your MTN Transport PIN to verify yourself:",
                    Label: "Transport",
                    DataType: "input",
                    FieldType: "number",
                    ClientState: "verify-merchant-pin",
                  };
                } else if (result.role == "mate") {
                  response = {
                    SessionId: SessionId,
                    Type: "response",
                    Message:
                      "1. View transactions \n2. Initiate a rider payment",
                    Label: "Transport",
                    DataType: "input",
                    FieldType: "number",
                    ClientState: "mate",
                  };
                } else {
                  response = {
                    SessionId: SessionId,
                    Type: "response",
                    Message:
                      "Welcome to MTN Transport. To start onboarding, enter your Driver License Number:",
                    Label: "Transport",
                    DataType: "input",
                    FieldType: "text",
                    ClientState: "onboard-merchant",
                  };
                }
                break;
              } catch (error) {
                console.log(error);
                response = {
                  SessionId: SessionId,
                  Type: "response",
                  Message: "Error. Please try again later",
                  Label: "Transport",
                  DataType: "display",
                  FieldType: "number",
                };
                break;
              }
            case "2": // 7*2
              const success = await verifyRider(rider);
              if (success) {
                response = {
                  SessionId: SessionId,
                  Type: "response",
                  Message: "1. Pay \n2. View Trips",
                  Label: "Transport",
                  DataType: "input",
                  FieldType: "text",
                  ClientState: "rider",
                };
              } else if (success == "stop") {
                response = {
                  SessionId: SessionId,
                  Type: "response",
                  Message:
                    "Thank you for using our service, please accept the pre-approval request on your phone and start again",
                  Label: "Transport",
                  DataType: "input",
                  FieldType: "text",
                  ClientState: "rider",
                };
              } else {
                response = {
                  SessionId: SessionId,
                  Type: "response",
                  Message: "Rider verification error. Please try again later",
                  Label: "Transport",
                  DataType: "input",
                  FieldType: "text",
                  ClientState: "rider",
                };
              }
              break;
          }
          break;
        case 4:
          // 7*1*1 7*2*1 7*2*2*
          switch (ClientState) {
            case "onboard-merchant":
              break;
            case "verify-merchant-pin":
              try {
                const { merchant: merchantObject, merchantRoute: route } =
                  await getMerchant(MerchantNum);

                const merchantPIN = merchantObject.pin;
                // check if input is pin
                const isPIN = await bcrypt.compare(Message, merchantPIN);
                if (isPIN) {
                  if (route?.start_location == "new user") {
                    response = {
                      SessionId: SessionId,
                      Type: "response",
                      Message:
                        "To use MTN Transport as merchant, you should first create a route:\n1.New route",
                      Label: "Transport",
                      DataType: "input",
                      FieldType: "number",
                      ClientState: "merchant",
                    };
                    break;
                  } else {
                    response = {
                      SessionId: SessionId,
                      Type: "response",
                      Message:
                        "1. New route\n2. View route\n3. View transactons\n4. Manage account\n5. Initiate payment",
                      Label: "Transport Merchant",
                      DataType: "input",
                      FieldType: "number",
                      ClientState: "merchant",
                    };
                    break;
                  }
                } else {
                  response = {
                    SessionId: SessionId,
                    Type: "response",
                    Message: "Couldn't verify your PIN, please try again:",
                    Label: "Transport",
                    DataType: "input",
                    FieldType: "number",
                    ClientState: "verify-merchant-pin",
                    Sequence: 3,
                  };
                  break;
                }
                break;
              } catch {
                response = {
                  SessionId: SessionId,
                  Type: "release",
                  Message: "Ran into an error processing your request.",
                  Label: "Transport",
                  DataType: "input",
                  FieldType: "number",
                };
                break;
              }

            case "mate":
              // MERCHANT
              switch (String(Message)) {
                case "1": //7*1*1 Mate view transactions
                  response = {
                    SessionId: SessionId,
                    Type: "response",
                    Message: "Here is a new route",
                    Label: "Transport",
                    DataType: "input",
                    FieldType: "number",
                  };
                  break;
                case "2": //7*1*2 Mate initiate rider payment
                  response = {
                    SessionId: SessionId,
                    Type: "response",
                    Message:
                      "Enter the number of the rider you want to charge:",
                    Label: "Transport",
                    DataType: "input",
                    FieldType: "number",
                  };
                  break;
              }
              break;
            case "rider":
              // RIDER
              switch (String(Message)) {
                case "1": //7*2*1
                  response = {
                    SessionId: SessionId,
                    Type: "response",
                    Message: "Enter the merchant's number",
                    Label: "Transport",
                    DataType: "input",
                    FieldType: "number",
                    ClientState: "rider_pay",
                  };
                  break;
                case "2": //7*2*2
                  const tripList = await getTrips(Mobile);
                  let recentTrips;
                  let tripRes = "Here are your recent trips: ";
                  if (tripList) {
                    recentTrips = tripsList.join("\n\n");
                    tripRes = tripRes + recentTrips;
                    response = {
                      SessionId: SessionId,
                      Type: "response",
                      Message: tripRes,
                      Label: "Transport",
                      DataType: "input",
                      FieldType: "number",
                    };
                  } else {
                    tripRes = "You have no trips yet";
                    response = {
                      SessionId: SessionId,
                      Type: "release",
                      Message: tripRes,
                      Label: "Transport",
                      DataType: "input",
                      FieldType: "display",
                      Data: null,
                    };
                  }
                  break;
              }
              break;
          }
          break;
        case 5:
          // 7*1*1*1 7*2*1*[merchant number]
          switch (ClientState) {
            case "merchant":
              switch (String(Message)) {
                case "1":
                  response = {
                    SessionId: SessionId,
                    Type: "response",
                    Message: `Enter the name of the Start Location:`,
                    Label: "Transport Merchant | Create a route",
                    DataType: "display",
                    FieldType: "text",
                    ClientState: "new-route",
                  };
                  break;
                case "2":
                  try {
                    const { merchant: merchantObject, merchantRoute: route } =
                      await getMerchant(MerchantNum);
                    response = {
                      SessionId: SessionId,
                      Type: "response",
                      Message: `Start Location: ${route?.start_location}\nEnd Location: ${route?.end_location}\nFare: ${route.fare}\n1. Change Start Location\n2. Change End Location\n3. Change Fare`,
                      Label: "Transport Merchant | View route",
                      DataType: "display",
                      FieldType: "text",
                      ClientState: "view-route",
                    };
                    break;
                  } catch {
                    response = {
                      SessionId: SessionId,
                      Type: "release",
                      Message: "Error. Please start over.",
                      Label: "Transport",
                      DataType: "input",
                      FieldType: "text",
                    };
                  }
                  break;
                case "3":
                  try {
                    // recent merchant transactions
                    const transactions = await getTransactionsForMerchant(
                      MerchantNum
                    );
                    const recentTransactions = transactions
                      ?.reverse()
                      ?.slice(0, 10); // reverse the order of the transactions and get the last 10
                    let transactionString =
                      "Here are your recent transactions:\n";
                    recentTransactions?.forEach((transaction) => {
                      const amount = transaction?.amount;
                      const sender = transaction?.sender_account;
                      const timestamp = new Date(
                        transaction?.timestamp_created
                      );

                      transactionString += `${amount} GHS from ${sender} on ${timestamp.toLocaleString()}\n`;
                    });
                    if (recentTransactions.length === 0) {
                      transactionString = "There are no recent transactions.";
                    }
                    response = {
                      SessionId: SessionId,
                      Type: "release",
                      Message: transactionString,
                      Label: "Transport Merchant | View Route",
                      DataType: "display",
                      FieldType: "text",
                    };
                    break;
                  } catch {
                    response = {
                      SessionId: SessionId,
                      Type: "release",
                      Message: "Error. Please start over.",
                      Label: "Transport",
                      DataType: "input",
                      FieldType: "text",
                    };
                  }
                  break;
              }
              break;
            case "rider_pay": // 7*2*1*[merchant number]
              if (phoneRegex.test(Message)) {
                const merchantNumber = convertToMsisdn(Message);
                try {
                  const { merchant, merchantRoute } = await getMerchant(
                    merchantNumber
                  );
                  if (merchant.phone_number === merchantNumber) {
                    const success = await requestToPay(
                      Mobile,
                      merchantNumber,
                      "rider-side"
                    );
                    if (success) {
                      response = {
                        SessionId: SessionId,
                        Type: "response",
                        Message: `Thank you for paying. Your trip has been booked \nStart Location:${merchantRoute.start_location} \nEnd Location:${merchantRoute.end_location} \nFare:${merchantRoute.fare}`,
                        Label: "Transport",
                        DataType: "display",
                        FieldType: "text",
                      };
                      try {
                        const newTrip = await createTrip(rider, merchantNumber);
                        console.log(newTrip);
                      } catch (error) {
                        console.log(error);
                      }
                    } else {
                      response = {
                        SessionId: SessionId,
                        Type: "response",
                        Message: "Payment failed. Please try again later",
                        Label: "Transport",
                        DataType: "input",
                        FieldType: "number",
                      };
                    }
                  } else {
                    response = {
                      SessionId: SessionId,
                      Type: "response",
                      Message: "Merchant not found. Please try again later",
                      Label: "Transport",
                      DataType: "display",
                      FieldType: "number",
                    };
                  }
                } catch (error) {
                  console.log(error);
                  response = {
                    SessionId: SessionId,
                    Type: "response",
                    Message: "Error. Please try again later",
                    Label: "Transport",
                    DataType: "display",
                    FieldType: "number",
                  };
                }
              } else {
                response = {
                  SessionId: SessionId,
                  Type: "release",
                  Message: "Invalid input",
                  Label: "Transport",
                  DataType: "input",
                  FieldType: "text",
                };
              }
          }
          break;
        default:
          response = {
            SessionId: SessionId,
            Type: "release",
            Message: "Invalid input",
            Label: "Transport",
            DataType: "input",
            FieldType: "text",
          };
          break;
      }
      break;
  }
  res.set("Content-Type", "application/json");
  res.send(response);
  console.log(response);
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

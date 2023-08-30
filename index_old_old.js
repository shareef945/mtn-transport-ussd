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
  console.log(req.body);
  let response;


  const phoneRegex = /^0[2357][0-9]{8}$/;

  const MerchantNum = Message.split("*")[2];

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


app.post("/ussd/v2/africastalking", async (req, res) => {
  const { text, phoneNumber } = req.body;
  let response = "";
  let merchantId = "";

  let merchant = {
    name: "Shareef Ali",
    phone_number: "233242945815",
    merchant_id: "233242945815",
    email: "",
    dob: "1991-06-23", // need to write a function to sanitise dob in case
    city: "Accra",
    driver_name: "Shareef Ali",
    driver_phone_number: "233242945815",
    merchant_type: "driver",
  };

  let phone_number;
  if (phoneNumber.startsWith("+")) {
    phone_number = phoneNumber.slice(1);
  } else {
    phone_number = phoneNumber;
  }

  const rider = {
    name: "Shareef Ali",
    phone_number: phone_number,
    id: phone_number,
    dob: "1995-01-01",
    email: "shareef945@gmail.com",
  };

  const phoneRegex = /^0[2357][0-9]{8}$/;

  switch (text) {
    case "":
      response = `CON Welcome To Mobile Money
  1. Transfer Money
  2. MomoPay & Pay Bill
  3. Airtime & Bundles
  4. Allow Cash Out
  5. Financial Services
  6. Wallet    
  7. Transport`;
      break;
    case "7":
      response = `CON Transport
    1. Merchant
    2. Rider`;
      break;
    case "7*2":
      const success = await verifyRider(rider);
      if (success == "stop") {
        response = `END Thank you for using our service, please accept the pre-approval request on your phone and start again`;
      } else if (success) {
        response = `CON Transport
        1. Pay
        2. View Trips`;
      } else {
        response = `END Rider verification error. Please try again later`;
      }
      break;
    case "7*2*1":
      response = `CON Enter Merchant Phone Number:`;
      break;
    default:
      if (/^7\*2\*1\*\d{10}$/.test(text)) {
        merchantId = text.split("*")[3];
        if (phoneRegex.test(merchantId) === true) {
          merchantId = convertToMsisdn(merchantId);
          try {
            const { merchant, merchantRoute } = await getMerchant(merchantId);
            if (merchant.phone_number == merchantId) {
              const success = await requestToPay(
                rider.phone_number,
                merchantId,
                "rider-side"
              );
              if (success) {
                response = `END Thank you for your patronage. Your trip details are as follows:

            Start Location: ${merchantRoute.start_location}
            End Location: ${merchantRoute.end_location}:`;
              } else {
                response = `END Error processing your request. Please try again later`;
              }
            } else {
              response = `END ${merchantId} This merchant was not found, please check the number and try again`;
            }
          } catch (error) {
            console.error(`Error fetching merchant data: ${error.message}`);
          }
        } else {
          response = `END ${merchantId} This merchant was not found, please check the number and try again`;
        }
      } else if (/^7\*2\*1\*\d{10}\*\d{4}$/.test(text)) {
        merchantId = text.split("*")[3];
        try {
          const newTrip = await createTrip(rider, merchantId);
          if (newTrip) {
            response = `END Success Enjoy your trip!`;
          } else {
            response = `END Error creating trip`;
          }
        } catch (error) {
          console.error(`Error creating trip: ${error.message}`);
        }
      } else if (text === "7*2*2") {
        response = `CON Enter MM Pin to view trips`;
      } else if (/^7\*2\*2\*\d{4}$/.test(text)) {
        const tripsList = await getTrips(rider);
        if (tripsList) {
          const mmPin = text.split("*")[3];
          const recentTrips = tripsList.join("\n\n");
          response = `END ${recentTrips}`;
        } else {
          response = "END You have no trips yet.";
        }
      } else if (text == "7*1") {
        // Prompt user to enter MoMo PIN to verify themselves if a driver, else show mate transactions and merchant initiation menus
        const result = await isMerchant(phone_number);
        console.log("Is this a merchant? :", result);
        if (result.role == "driver") {
          response = `CON Enter your MTN Transport PIN to verify yourself:`;
        } else if (result.role == "mate") {
          response = `CON 
          1. View transactions
          2. Initiate a rider payment`;
        } else {
          response =
            "CON Welcome to MTN Transport. To start onboarding, enter your Driver License Number";
        }
      } else if (text.startsWith("7*1") && text.length > 3) {
        // Do something with inputs [2] which is the MoMo PIN to manage authentication
        // Split the input into an array of strings
        inputs = text.split("*");
        console.log(inputs);
        if (inputs.length == 3) {
          // Present options to manage account
          if (inputs[2].length > 4) {
            // Driver onboarding
            response = "CON Enter your Vehicle Plate Number:";
          } else if (inputs[2].length == 4) {
            const { merchant: merchantObject, merchantRoute: route } =
              await getMerchant(phone_number);

            const merchantPIN = merchantObject.pin;
            // check if input is pin
            const isPIN = await bcrypt.compare(inputs[2], merchantPIN);
            if (isPIN) {
              if (route.start_location == "new user") {
                response = `CON To use MTN Transport as a merchant, you should first create a route
                 1. New route`;
              } else {
                response = `CON Merchant Account
                1. New route
                2. View route
                3. View transactions
                4. Manage account
                5. Initiate Payment`;
              }
            } else {
              response = `END You entered the wrong pin, please restart and try again.`;
            }
          } else {
            if (inputs[2] == "1") {
              // Mate view of Merchant Transactions
              const transactions = await getTransactionsForMerchant(merchant);

              const recentTransactions = transactions.reverse().slice(0, 10); // reverse the order of the transactions and get the last 10

              let transactionString =
                "CON Here are your recent transactions:\n";

              recentTransactions.forEach((transaction) => {
                const amount = transaction.amount;
                const sender = transaction.sender_account;
                const timestamp = new Date(transaction.timestamp_created);

                transactionString += `${amount} GHS from ${sender} on ${timestamp.toLocaleString()}\n`;
              });

              if (recentTransactions.length === 0) {
                transactionString = "END There are no recent transactions.";
              }

              response = transactionString;
            } else if (inputs[2] == "2") {
              // Mate view of Merchant Initiated payment
              response =
                "CON Please enter the number of the rider you want to charge:";
            }
          }
        } else if (inputs.length == 4) {
          if (inputs[2].length > 4) {
            // Driver onboarding
            response = `CON Would you like to add a mate to your account too?
            1. Yes
            2. Later`;
          } else if (inputs[3] == "1") {
            // Prompt user to enter the name of the start location
            response = `CON Enter the name of the Start Location`;
          } else if (inputs[3] == "2") {
            // TODO: get the active route
            // Present the active route and options to manage it
            const { merchant: merchantObject, merchantRoute: route } =
              await getMerchant(phone_number);
            response = `CON Active route:
            Start Location: ${route.start_location}
            End Location: ${route.end_location}
            Fare: ${route.fare}
      
            1. Change Start Location
            2. Change End Location
            3. Change Fare`;
          } else if (inputs[3] == "3") {
            // recent merchant transactions
            const transactions = await getTransactionsForMerchant(phone_number);

            const recentTransactions = transactions.reverse().slice(0, 10); // reverse the order of the transactions and get the last 10

            let transactionString = "CON Here are your recent transactions:\n";

            recentTransactions.forEach((transaction) => {
              const amount = transaction.amount;
              const sender = transaction.sender_account;
              const timestamp = new Date(transaction.timestamp_created);

              transactionString += `${amount} GHS from ${sender} on ${timestamp.toLocaleString()}\n`;
            });

            if (recentTransactions.length === 0) {
              transactionString = "END There are no recent transactions.";
            }

            response = transactionString;
          } else if (inputs[3] == "4") {
            const { merchant: merchantObject, merchantRoute: route } =
              await getMerchant(phone_number);
            // Present the user with their merchant information and an option to change their vehicle info
            // TODO: swap name
            response = `CON Hello ${merchant.driver_name}
              Merchant ID: ${merchant.merchant_id}
              Vehicle Registration: ${merchant.license_plate_number}
              1. Change Vehicle Info
              2. Add Mate to Account`;
          } else if (inputs[3] == "5") {
            const { merchant: merchantObject, merchantRoute: route } =
              await getMerchant(phone_number);
            response = `CON Active route:
            ${route.start_location} to ${route.end_location} & Fare is GHS ${route.fare}
      
            1. Proceed (We will use the fare from this route)`;
          } else {
            if (inputs[2] == "2") {
              // Mate view of Merchant Initiated payment
              const ghRegex = /^0\d{9}$/;
              if (ghRegex.test(inputs[3])) {
                const { merchant: merchantObject, merchantRoute: route } =
                  await getMerchant(phone_number);
                // Get Rider Basic Details
                let rider_name = "Shareef";
                response = `CON You are initiating a payment of GHS ${route.fare} from ${rider_name} ${inputs[3]}

               Reply:
               1. Confirm
               or CANCEL.`;
              } else {
                response =
                  "END You have entered an invalid phone number. Please try again.";
              }
            }
          }
        } else if (inputs.length == 5) {
          if (inputs[2].length > 4 && inputs[4] == 2) {
            // Onboard Driver Alone
            response = `CON For security, you need to set a PIN for MTN Transport.
            It needs to be 4 digits and numbers only.
            
            Choose PIN:`;
          } else if (inputs[2].length > 4 && inputs[4] == 1) {
            // Add Mate to Account
            response = `CON Please enter your mate's name:`;
          } else if (inputs[3] == "1") {
            // Prompt user to enter the name of the end location
            response = `CON Enter the name of the End Location`;
          } else if (inputs[3] == "2") {
            // AMENDING AN EXISTING ROUTE
            // Present the user with options to change the start location, end location, or fare
            const { merchant: merchantObject, merchantRoute: existing_route } =
              await getMerchant(phone_number);
            if (inputs[4] == "1") {
              response = `CON Active route:
                    Current Start Location: ${existing_route.start_location}

                    Enter New Start Location:`;
            } else if (inputs[4] == "2") {
              response = `CON Active route:
              Current End Location: ${existing_route.end_location}
      
              Enter New End Location:`;
            } else if (inputs[4] == "3") {
              response = `CON Active route:
              Current Fare: ${existing_route.fare}
      
              Enter New Fare:`;
            }
          } else if (inputs[3] == "4") {
            const { merchant: merchantObject, merchantRoute: route } =
              await getMerchant(phone_number);
            if (inputs[4] == "1") {
              // Prompt user to enter their new vehicle registration number
              response = `CON Your current Vehicle Registration: ${merchant.license_plate_number}
              Enter new Vehicle Registration Number:
              `;
            } else {
              if (merchant?.mate_phone_number) {
                response = `CON You already have a mate: ${merchant.mate_name}.
                To replace this mate, please enter a new mate phone number:`;
              } else {
                response = `CON Please enter the MTN phone number of your mate:`;
              }
            }
          } else if (inputs[3] == "5") {
            if (inputs[4] == "1") {
              response = "CON Enter the rider's phone number:";
            } else if (inputs[4] == "2") {
              response = "CON Enter the amount you want to charge:";
            }
          } else {
            if (inputs[2] == "2") {
              const rider_to_charge = convertToMsisdn(inputs[3]);
              const success = await requestToPay(
                rider_to_charge,
                phone_number,
                "merchant-side"
              );
              if (success) {
                response = `END Payment Initiated. Rider will need to confirm and you will receive an SMS alert in a few minutes if successful.`;
              } else {
                response = `END We ran into an error requesting a payment. Please wait a few minutes to confirm this didn't go through, and then try again.`;
              }
            }
          }
        } else if (inputs.length == 6) {
          if (inputs[2].length > 4 && inputs[4] == 2) {
            // Onboard Driver Alone
            // TODO call function to create driver account without mate
            if (inputs[5].length != 4) {
              response =
                "END Please make sure you choose a 4 digit PIN. Please start over.";
            } else if (inputs[5].length == 4 && isNaN(parseInt(inputs[5]))) {
              response =
                "END Please make sure you choose a PIN made up of numbers. Please start over.";
            } else {
              // Call MoMo Get Basic Details API -- replace with a momo api call when it's ready and refactor momo response to merchant syntax
              let momo_profile = merchant;

              momo_profile.driver_phone_number = phone_number;
              momo_profile.phone_number = phone_number;
              momo_profile.merchant_id = phone_number;
              momo_profile.drivers_license_number = inputs[2];
              momo_profile.license_plate_number = inputs[3];
              momo_profile.pin = await encryptPin(inputs[5]);
              const merchantcreated = await createMerchant(momo_profile);
              if (!merchantcreated) {
                response =
                  "END Sorry, we ran into an error creating your account. Please try again in a few minutes";
              } else {
                await createRoute(phone_number, "new user", "new user", 100);
                response = `END Welcome to MTN Transport. Your account has now been created with:
                Phone number: ${phoneNumber},
                License number: ${momo_profile.drivers_license_number},
                Vehicle: ${momo_profile.license_plate_number}`;
              }
            }
          } else if (inputs[2].length > 4 && inputs[4] == 1) {
            // Add Mate to Account
            // Create PIN
            response = `CON Enter your mate's phone number:`;
          } else if (inputs[3] == "1") {
            // Prompt user to enter the fare for the new route
            response = `CON Enter the Fare`;
          } else if (inputs[3] == "2") {
            // AMENDING AN EXISTING ROUTE
            // Present the user with the option to confirm changes to the start location, end location, or fare
            const { merchant: merchantObject, merchantRoute: existing_route } =
              await getMerchant(phone_number);
            if (inputs[4] == "1") {
              response = `CON Current Start Location: ${existing_route.start_location}
              New Start Location: ${inputs[5]}
      
              Reply with:
              1. Confirm Changes
              Or Press CANCEL to exit.`;
            } else if (inputs[4] == "2") {
              response = `CON Current End Location: ${existing_route.end_location}
              New End Location: ${inputs[5]}
      
              Reply with:
              1. Confirm Changes
              Or Press CANCEL to exit.`;
            } else if (inputs[4] == "3") {
              if (!isNaN(parseInt(inputs[5]))) {
                response = `CON Current Fare: ${existing_route.fare}
                            New Fare: ${inputs[5]}
      
                            Reply with:
                            1. Confirm Changes
                            Or Press CANCEL to exit.`;
              } else {
                response = `CON Please enter a valid fare. Only numbers are allowed.`;
              }
            }
          } else if (inputs[3] == "4") {
            if (inputs[4] == "1") {
              // Prompt user to confirm their request to change their vehicle registration number
              response = `CON You are requesting to change your Vehicle to ${inputs[5]}
      
                        Are you sure?
                        1. Yes
      
                        Or press CANCEL to exit.`;
            } else if (inputs[4] == "2") {
              response = `CON Enter your mate's name:`;
            }
          } else if (inputs[3] == "5") {
            if (inputs[4] == "1") {
              const ghRegex = /^0\d{9}$/;
              if (ghRegex.test(inputs[5])) {
                const { merchant: merchantObject, merchantRoute: route } =
                  await getMerchant(phone_number);
                // Get Rider Basic Details
                let rider_name = "Shareef";
                response = `CON You are initiating a payment of GHS ${route.fare} from ${rider_name} ${inputs[5]}

               Reply:
               1. Confirm
               or CANCEL.`;
              } else {
                response =
                  "END You have entered an invalid phone number. Please start again.";
              }
            } else if (inputs[4] == "2") {
              response = "CON Enter rider phone number:";
            }
          }
        } else if (inputs.length == 7) {
          if (inputs[2].length > 4 && inputs[4] == 1) {
            // Add Mate to Account
            // Create PIN
            response = `CON For security, you need to set a PIN for MTN Transport.
            Choose PIN:`;
          } else if (inputs[3] == "1" && !isNaN(parseInt(inputs[6]))) {
            // Create a new route with the provided information
            let new_route = {
              start_location: inputs[4],
              end_location: inputs[5],

              fare: inputs[6],
            };
            const route_created = await createRoute(
              phone_number,
              new_route.start_location,
              new_route.end_location,
              new_route.fare
            );

            if (route_created.message == "Route created!") {
              response = `END Route created!
              ${new_route.start_location} to ${new_route.end_location}, fare: GHS ${new_route.fare}`;
            } else {
              response = `END There was an error creating a new route. Please try that again.`;
            }
          } else if (inputs[3] == "1" && isNaN(parseInt(inputs[6]))) {
            // Prompt user to enter a valid fare if the input is not a number
            response = `CON Please Enter a Valid Fare (numbers only)`;
          } else if (inputs[3] == "2") {
            if (inputs[6] == "1") {
              // AMENDING AN EXISTING ROUTE, FINAL STEP
              // Confirm changes to the start location, end location, or fare
              const {
                merchant: merchantObject,
                merchantRoute: existing_route,
              } = await getMerchant(phone_number);
              if (inputs[4] == "1") {
                const newRoute = swapRouteDetails(
                  existing_route,
                  inputs[5],
                  "start"
                );
                const route_created = await createRoute(
                  phone_number,
                  newRoute.start_location,
                  newRoute.end_location,
                  newRoute.fare
                );
                if (route_created.message == "Route created!") {
                  // PATCH New Start Location
                  response = `END Start Location changed from ${existing_route.start_location} to ${inputs[5]}`;
                } else {
                  response = `END There was an error modifying the Start Location. Please try again.`;
                }
              } else if (inputs[4] == "2") {
                // PATCH New End Location
                const newRoute = swapRouteDetails(
                  existing_route,
                  inputs[5],
                  "end"
                );
                const route_created = await createRoute(
                  phone_number,
                  newRoute.start_location,
                  newRoute.end_location,
                  newRoute.fare
                );
                if (route_created.message == "Route created!") {
                  // PATCH New End Location
                  response = `END End Location changed from ${existing_route.end_location} to ${inputs[5]}`;
                } else {
                  response = `END There was an error modifying the End Location. Please try again.`;
                }
              } else if (inputs[4] == "3") {
                // PATCH New Fare
                const newRoute = swapRouteDetails(
                  existing_route,
                  inputs[5],
                  "fare"
                );
                const route_created = await createRoute(
                  phone_number,
                  newRoute.start_location,
                  newRoute.end_location,
                  newRoute.fare
                );
                if (route_created.message == "Route created!") {
                  // PATCH New Fare
                  response = `END Start Location changed from ${existing_route.fare} to ${inputs[5]}`;
                } else {
                  response = `END There was an error modifying the Fare. Please try again.`;
                }
              }
            }
          } else if (inputs[3] == "4") {
            if (inputs[4] == "1") {
              const changed = await changeVehicleInfo(merchant, inputs[5]);
              // Notify the user that their request has been submitted and will be processed
              response = `END Your vehicle registration has been changed to ${inputs[5]}.`;
            } else if (inputs[4] == "2") {
              const mate_name = inputs[6];
              const mate_phone_number = inputs[5];
              response = `CON You are requesting to add ${mate_name} ${mate_phone_number} as a mate on your account.
              1. Confirm`;
            }
          } else if (inputs[3] == "5") {
            if (inputs[4] == "1") {
              const rider_to_charge = convertToMsisdn(inputs[5]);
              const success = await requestToPay(
                rider_to_charge,
                phone_number,
                "merchant-side"
              );
              if (success) {
                response = `END Payment Initiated. Rider will need to confirm and you will receive an SMS alert in a few minutes if successful.`;
              } else {
                response = `END We ran into an error requesting a payment. Please wait a few minutes to confirm this didn't go through, and then try again.`;
              }
            } else if (inputs[4] == "2") {
              response = `CON You are initiating a payment of GHS ${inputs[5]} from ${inputs[6]}

              Reply:
              1. Confirm
              or CANCEL.`;
            }
          }
        } else if (inputs.length == 8) {
          if (inputs[2].length > 4 && inputs[4] == 1) {
            response = `END WTFFFF`;
            // Add Mate to Account
            // Create Account
            // Call MoMo Get Basic Details API -- replace with a momo api call when it's ready and refactor momo response to merchant syntax
            const data = {
              name: "Shareef Ali",
              phone_number,
              merchant_id: phone_number,
              email: "",
              dob: "1991-06-23", // need to write a function to sanitise dob in case
              city: "Accra",
              driver_name: "Shareef Ali",
              driver_phone_number: phone_number,
              merchant_type: "driver_mate",
              drivers_license_number: inputs[2],
              license_plate_number: inputs[3],
              pin: await encryptPin(inputs[7]),
              mate_name: inputs[5],
              mate_phone_number: convertToMsisdn(inputs[6]),
            };
            console.log(data);
            const merchantcreated = await createMerchant(data);
            if (!merchantcreated) {
              response =
                "END Sorry, we ran into an error creating your account. Please try again in a few minutes";
            } else {
              await createRoute(phone_number, "new user", "new user", 100);
              response = `END Welcome to MTN Transport. Your account has now been created with:
               Phone number: ${phoneNumber},
               License number: ${data.drivers_license_number},
               Vehicle: ${data.license_plate_number}
               Mate: ${data.mate_name}
               Mate Phone Number: ${data.mate_phone_number}`;
            }
          } else if (inputs[3] == "5") {
            if (inputs[4] == "2") {
              const rider_to_charge = inputs[5];
              response = `END Payment Initiated. Rider will need to confirm and you will receive an SMS alert in a few minutes if successful.`;
            }
          } else if (inputs[3] == "4") {
            const { merchant: merchantObject, merchantRoute: route } =
              await getMerchant(phone_number);
            if (inputs[4] == "2") {
              const mate_name = inputs[6];
              const mate_phone_number = inputs[5];
              await patchMate(
                phone_number,
                mate_name,
                convertToMsisdn(mate_phone_number)
              );
              // await sendSMS(
              //   mate_phone_number,
              //   `You have been added as a mate to ${merchant.driver_name}'s account. If you do not recognise this name or their phone number: ${merchant.driver_phone_number}, please contact us on PLACEHOLDER.`
              // );
              response = `END ${mate_name} ${mate_phone_number} has been added as a mate on your account.
              They will receive an SMS confirming this shortly.`;
            }
          }
        }
      } else {
        response = "END Invalid input";
      }

      break;
  }
  res.set("Content-Type", "application/x-www-form-urlencoded");
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

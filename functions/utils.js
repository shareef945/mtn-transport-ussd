const token = require("./generateToken.js");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
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

async function encryptPin(pin) {
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(pin, salt);
  return hash;
}

async function createMerchantTransaction(
  requestedBy,
  requestedFrom,
  amount,
  xrefid
) {
  const url = `${api_root}/v1/merchant_transactions`;
  const data = {
    amount,
    currency: "GHS",
    merchant_id: requestedFrom, // assuming its formatted before the request to pay
    payment_gateway: "Momo",
    payment_method: "MTN",
    transaction_id: xrefid,
    transaction_status: "pending",
    sender_account: requestedBy,
    receiver_account: requestedFrom,
  };
  return axios
    .post(url, data, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Cache-Control": "no-cache",
      },
    })
    .then((res) => {
      return res.data;
    })
    .catch((error) => console.error(error.message));
}

async function createRoute(merchantID, startLocation, endLocation, fare) {
  const url = `${api_root}/v1/merchant_routes`;
  const data = {
    merchant_id: merchantID,
    start_location: startLocation,
    end_location: endLocation,
    fare: parseInt(fare),
  };
  return axios
    .post(url, data, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Cache-Control": "no-cache",
      },
    })
    .then((res) => {
      console.log(res.data, "Line 493", res.data.message);
      return res.data;
    })
    .catch((error) => console.error(error.message));
}

function swapRouteDetails(oldRoute, input, inputField) {
  if (inputField == "start") {
    oldRoute.start_location = input;
    return oldRoute;
  } else if (inputField == "end") {
    oldRoute.end_location = input;
    return oldRoute;
  } else if (inputField == "fare") {
    oldRoute.fare = input;
    return oldRoute;
  }
  return oldRoute;
}

function convertToMsisdn(number) {
  if (number.startsWith("0")) {
    return `233${number.slice(1)}`;
  } else if (number.startsWith("+")) {
    return number.slice(1);
  } else {
    return number;
  }
}

async function getTransactionsForMerchant(merchantId) {
  const url = `${api_root}/v1/merchant_transactions/merchant/${merchantId}`;
  return axios
    .get(url, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Cache-Control": "no-cache",
      },
    })
    .then((res) => {
      return res.data;
    })
    .catch((error) => console.error(error.message));
}

async function sendSMS(to, message) {
  const query = new URLSearchParams({
    clientid: hubtelClientId,
    clientsecret: hubtelClientSecret,
    from: "MTN Transport",
    to: formatIntlPhoneNumber(to),
    content: message,
  }).toString();
  const url = `${hubtelSMSApi}/v1/messages/send?${query}`;
  try {
    const response = await axios.get(url);
    console.log(response.text);
  } catch (error) {
    console.error(error.message);
  }
}

function formatIntlPhoneNumber(phoneNumber) {
  // Remove any non-numeric characters from the phone number
  const numericPhoneNumber = phoneNumber.replace(/\D/g, "");

  // Check if the phone number starts with a 0
  if (numericPhoneNumber.startsWith("0")) {
    // If it does, replace the leading 0 with +233
    return "+233" + numericPhoneNumber.substring(1);
  } else {
    // Otherwise, add a +233 prefix to the phone number
    return "+233" + numericPhoneNumber;
  }
}

async function isMerchant(phone) {
  console.log(`${phone} attempting to use the service.`);
  const url = `${api_root}/v1/merchants/unified/${phone}`;
  try {
    const res = await axios.get(url, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Cache-Control": "no-cache",
      },
    });
    if (res.status === 200) {
      console.log("Merchant exists");
      return res.data;
    } else {
      return { role: "unknown" };
    }
  } catch (error) {
    console.log("Merchant does not exist");
    // console.error(error.message);
    return false;
  }
}

async function patchMate(merchant_id, mate_name, mate_phone_number) {
  const url = `${api_root}/v1/merchants/${merchant_id}`;
  const data = {
    mate_name,
    mate_phone_number,
  };
  axios
    .patch(url, data, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Cache-Control": "no-cache",
      },
    })
    .then((res) => {
      return res.data;
    })
    .catch((error) => console.error(error.message));
}

async function createRider(name, phone_number, dob, email) {
  const url = `${api_root}/v1/riders`;
  const data = {
    name: name,
    phone_number: phone_number,
    dob: dob,
    email: email,
  };
  await axios
    .post(url, data, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Cache-Control": "no-cache",
      },
    })
    .then((res) => console.log(res.data))
    .catch((error) => console.error(error.message));
}

async function verifyRider(rider) {
  let success = false;
  let stop = "stop";
  const url = `${api_root}/v1/riders/${rider.phone_number}`;
  try {
    const res = await axios.get(url, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      catch(error) {
        console.error(error.message);
      },
    });
    if (res.status === 204) {
      await createRider(rider.name, rider.phone_number, rider.dob, rider.email);
      console.log(`Rider ${rider.name} created`);
      const mtnToken = await generateMtnToken();
      console.log("Generating Pre approval token");
      await preApprovalRequest(rider.phone_number, mtnToken);
      success = true;
      return stop;
    } else if (res.status === 200) {
      console.log(`Rider ${rider.name} exists`);
      const mtnToken = await generateMtnToken();
      const existingRider = await getRider(rider.phone_number);
      if (existingRider.preapprovalUUID) {
        console.log("Preapproval UUID exists");
        try {
          const res = await axios.get(
            `${preApprovalApi}/${existingRider.preapprovalUUID}`,
            {
              headers: {
                Authorization: `Bearer ${mtnToken}`,
                "X-Target-Environment": mtnTargetEnvironment,
                "Ocp-Apim-Subscription-Key":
                  process.env.MTN_COLLECTION_SUBSCRIPTION_KEY,
                "Cache-Control": "no-cache",
              },
            }
          );
          const currentDateTime = new Date();
          let expiry = res.data.expirationDateTime;
          if (currentDateTime.getTime() > new Date(expiry).getTime()) {
            console.log("UUID expired, Generating new Preapproval UUID");
            await preApprovalRequest(rider.phone_number, mtnToken);
          } else {
            console.log("UUID still valid");
          }
          success = true;
        } catch (error) {
          console.error(error.message);
        }
      } else {
        await preApprovalRequest(rider.phone_number, mtnToken);
        success = true;
      }
    }
  } catch (error) {
    console.error(error.message);
  }
  return success;
}

async function generateMtnToken() {
  console.log("Generating MTN token");
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

async function preApprovalRequest(phone_number, mtnToken) {
  const id = uuidv4();
  let success = false;
  try {
    const response = await axios.post(
      mtnPreApprovalUrl,
      {
        payer: {
          partyIdType: "MSISDN",
          partyId: phone_number,
        },
        payerCurrency: "GHS",
        payerMessage: "MTN Transport Payment",
        validityTime: 604800,
      },
      {
        headers: {
          Authorization: `Bearer ${mtnToken}`,
          "Ocp-Apim-Subscription-Key":
            process.env.MTN_COLLECTION_SUBSCRIPTION_KEY,
          "X-Target-Environment": mtnTargetEnvironment,
          "X-Reference-Id": id,
          "Cache-Control": "no-cache",
        },
      }
    );
    if (response.status === 202) {
      console.log("Auto approval request sent");
      const preApprovalResponse = await axios.patch(
        api_root + `/v1/riders/${phone_number}`,
        {
          preapprovalUUID: id,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache",
          },
        }
      );
      if (preApprovalResponse.status === 200) {
        console.log("Pre approval UUID saved");
        success = true;
      } else {
        console.log("Something went wrong with saving pre approval UUID");
      }
    } else if (response.status === 409) {
      console.log("Duplicate auto approval request");
      success = true;
    } else {
      console.log("Something went wrong with Auto approval request");
    }
  } catch (error) {
    console.error(
      `Error while sending pre-approval request for rider ${phone_number}: ${error.message}`
    );
  }
  return success;
}

async function getRider(phone_number) {
  const url = `${api_root}/v1/riders/${phone_number}`;
  try {
    const res = await axios.get(url, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Cache-Control": "no-cache",
      },
    });
    const rider = res.data;
    return rider;
  } catch (error) {
    console.error(error.message);
  }
}

async function requestToPay(riderPhoneNumber, merchantId, source) {
  try {
    const merchantRoute = await getMerchant(merchantId);
    const fare = merchantRoute.merchantRoute.fare;
    const mtnToken = await generateMtnToken();
    const url = mtnCollectionUrl;
    const uuid = uuidv4();
    const data = {
      amount: fare.toString(),
      currency: "GHS",
      externalId: uuid,
      payer: {
        partyIdType: "MSISDN",
        partyId: riderPhoneNumber,
      },
      payerMessage: "TESTING",
      payeeNote: "TESTING",
    };

    const res = await axios.post(url, data, {
      headers: {
        Authorization: `Bearer ${mtnToken}`,
        "X-Reference-Id": uuid,
        "X-Target-Environment": mtnTargetEnvironment,
        "Ocp-Apim-Subscription-Key":
          process.env.MTN_COLLECTION_SUBSCRIPTION_KEY,
        //...(source == 'merchant-side' ? {"X-Callback-Url": callbackUrl} : {})
      },
    });

    console.log("Response data:", res.data);

    if (res.status === 202) {
      console.log(
        `Payment request successful, rider: ${riderPhoneNumber}, fare: ${fare}`
      );
      // log merchant transaction
      await createMerchantTransaction(merchantId, riderPhoneNumber, fare, uuid);
      return true;
    } else {
      console.log(
        `Payment request failed, rider: ${riderPhoneNumber}, fare: ${fare}`
      );
      return false;
    }
  } catch (error) {
    console.error(
      `Error while requesting payment for rider ${riderPhoneNumber}: ${error.message}`
    );
    console.error(error.message);
    return false;
  }
}

async function changeVehicleInfo(merchantID, newRegistration) {
  const url = `${api_root}/v1/merchants/${merchantID}`;
  const data = {
    merchant_id: merchantID,
    license_plate_number: newRegistration,
  };
  axios
    .patch(url, data, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Cache-Control": "no-cache",
      },
    })
    .then((res) => {
      return res.data;
    })
    .catch((error) => console.error(error.message));
}

async function createMerchant(profile) {
  const url = `${api_root}/v1/merchants`;
  const data = profile;
  let success = true;
  try {
    const response = await axios.post(url, data, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Cache-Control": "no-cache",
      },
    });
    console.log(response.data);
  } catch (error) {
    console.error(error);
    success = false;
  }
  return success;
}

async function getMerchant(merchantId) {
  const merchantUrl = `${api_root}/v1/merchants/${merchantId}`;
  try {
    const response = await axios.get(merchantUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Cache-Control": "no-cache",
      },
    });
    const merchant = response.data;
    if (!merchant) {
      return { merchant: "000" };
    }
    const merchantRouteUrl = `${api_root}/v1/merchant_routes/${merchant.active_route_id}`;
    const response2 = await axios.get(merchantRouteUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Cache-Control": "no-cache",
      },
    });

    const merchantRoute = response2.data;
    return { merchant, merchantRoute };
  } catch (error) {
    console.error(`Error fetching merchant data: ${error.message}`);
  }
}

async function createTrip(rider, merchantId) {
  const { merchant, merchantRoute } = await getMerchant(merchantId);
  const url = `${api_root}/v1/rider_trips`;
  const data = {
    rider_id: rider.id,
    merchant_id: merchant.merchant_id,
    active_route_id: merchant.active_route_id,
    start_location: merchantRoute.start_location,
    final_location: merchantRoute.end_location,
    fare: merchantRoute.fare,
  };
  try {
    const response = await axios.post(url, data, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Cache-Control": "no-cache",
      },
    });
    if (response.status == 201) {
      const trip = response.data;
      return trip;
    } else {
      const trip = null;
      return trip;
    }
  } catch (error) {
    console.error(error.message);
    console.error(error.request);
  }
}

async function getTrips(rider) {
  const url = `${api_root}/v1/rider_trips/rider/${rider.phone_number}`;
  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Cache-Control": "no-cache",
      },
    });
    const trips = response.data.slice(0, 5); // limit the trips to a maximum of 5
    const tripsList = trips.map(
      (trip) =>
        `Start: ${trip.start_location}, End: ${trip.final_location}, Fare: GHS ${trip.fare}`
    );
    return tripsList;
  } catch (error) {
    console.error(error.message);
  }
}

module.exports = {
  swapRouteDetails,
  convertToMsisdn,
  getTransactionsForMerchant,
  sendSMS,
  createMerchantTransaction,
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
  getTrips
};

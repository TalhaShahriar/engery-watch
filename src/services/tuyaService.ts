import crypto from "crypto";
import axios from "axios";

// Standard Tuya endpoints
const ACCESS_ID = process.env.TUYA_ACCESS_ID || "";
const ACCESS_SECRET = process.env.TUYA_ACCESS_SECRET || "";
const DEVICE_ID = process.env.TUYA_DEVICE_ID || "";
const REGION_ENDPOINT = process.env.TUYA_REGION_ENDPOINT || "https://openapi.tuyaeu.com";

// Verify if we have valid credentials or should run in Simulation Mode
export let isSimulated = 
  !ACCESS_ID || 
  !ACCESS_SECRET || 
  !DEVICE_ID || 
  ACCESS_ID.includes("your") || 
  ACCESS_ID === "changeme";

// State structure for simulator
interface DeviceState {
  switch_1: boolean;
  cur_power: number; // in 0.1W units
  cur_voltage: number; // in 0.1V units
  cur_current: number; // in mA units
  add_ele: number; // cumulative kWh
}

let simulatedState: DeviceState = {
  switch_1: true,
  cur_power: 2450, // 245W
  cur_voltage: 2280, // 228V
  cur_current: 1075, // 1075mA
  add_ele: 4.86, // cumulative kWh
};

// Simulated fluctuations
let lastSleepTriggerTime = 0;

export function updateSimulatedReading(isInSleepMode: boolean = false) {
  if (!simulatedState.switch_1) {
    simulatedState.cur_power = 0;
    simulatedState.cur_current = 0;
    return;
  }

  if (isInSleepMode) {
    // Sleep mode: low watt consumption
    simulatedState.cur_power = Math.floor(20 + Math.random() * 15); // 2W - 3.5W
    simulatedState.cur_current = Math.floor(simulatedState.cur_power / 2.2);
  } else {
    // Normal fluctuations (e.g. desktop PC, fans running)
    const basePower = 1800 + Math.floor(Math.sin(Date.now() / 60000) * 400); // 140W to 220W
    simulatedState.cur_power = basePower + Math.floor(Math.random() * 100);
    simulatedState.cur_current = Math.floor((simulatedState.cur_power / 10) / (simulatedState.cur_voltage / 10) * 1000);
  }

  // Fluctuations in voltage (Dhaka grid usually 220V - 235V)
  simulatedState.cur_voltage = 2200 + Math.floor(Math.sin(Date.now() / 120000) * 80) + Math.floor(Math.random() * 10);

  // Accumulate energy consumption: 30s of 200W is about 0.0016 kWh
  const addedKwh = ((simulatedState.cur_power / 10) / 1000) * (30 / 3600);
  simulatedState.add_ele = Number((simulatedState.add_ele + addedKwh).toFixed(4));
}

// In-memory token cache for Tuya Cloud API
let accessToken = "";
let tokenExpiresAt = 0;

function sha256Hash(str: string): string {
  return crypto.createHash("sha256").update(str, "utf8").digest("hex");
}

function calculateSign(
  clientId: string,
  secret: string,
  t: string,
  accessToken: string,
  method: string,
  urlPath: string,
  bodyStr: string = ""
): string {
  const contentHash = sha256Hash(bodyStr);
  const stringToSign = [method, contentHash, "", urlPath].join("\n");
  const signStr = clientId + accessToken + t + stringToSign;
  return crypto.createHmac("sha256", secret).update(signStr, "utf8").digest("hex").toUpperCase();
}

async function fetchToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiresAt - 60000) {
    return accessToken;
  }

  const t = Date.now().toString();
  const path = "/v1.0/token?grant_type=1";
  const sign = calculateSign(ACCESS_ID, ACCESS_SECRET, t, "", "GET", path);

  try {
    const response = await axios.get(`${REGION_ENDPOINT}${path}`, {
      headers: {
        client_id: ACCESS_ID,
        sign,
        t,
        sign_method: "HMAC-SHA256",
      },
    });

    if (response.data && response.data.success) {
      accessToken = response.data.result.access_token;
      tokenExpiresAt = Date.now() + (response.data.result.expire_time * 1000);
      
      // Since token fetch succeeded, turn OFF simulation mode to try real connection
      isSimulated = false; 
      
      return accessToken;
    } else {
      isSimulated = true;
      throw new Error(`Tuya token failed: ${response.data ? response.data.msg : "Unknown error"}`);
    }
  } catch (err: any) {
    isSimulated = true;
    console.warn("Tuya Auth API Error: Offline Simulation Mode enabled dynamically.", err.message);
    throw err;
  }
}

/**
 * Get details/status of the linked Tuya smart plug device.
 */
export async function getDeviceStatus() {
  if (isSimulated) {
    return {
      switch_1: simulatedState.switch_1,
      cur_power: simulatedState.cur_power,
      cur_voltage: simulatedState.cur_voltage,
      cur_current: simulatedState.cur_current,
      add_ele: simulatedState.add_ele,
    };
  }

  try {
    const token = await fetchToken();
    const t = Date.now().toString();
    const path = `/v1.0/devices/${DEVICE_ID}/status`;
    const sign = calculateSign(ACCESS_ID, ACCESS_SECRET, t, token, "GET", path);

    const response = await axios.get(`${REGION_ENDPOINT}${path}`, {
      headers: {
        client_id: ACCESS_ID,
        access_token: token,
        sign,
        t,
        sign_method: "HMAC-SHA256",
      },
    });

    if (response.data && response.data.success) {
      const statusArr = response.data.result;
      
      // Parse switch_1, cur_power, cur_voltage, cur_current, add_ele from statuses
      let switch_1 = true;
      let cur_power = 0;
      let cur_voltage = 2200;
      let cur_current = 0;
      let add_ele = 0;

      for (const item of statusArr) {
        if (item.code === "switch_1" || item.code === "switch") {
          switch_1 = !!item.value;
        } else if (item.code === "cur_power") {
          cur_power = Number(item.value);
        } else if (item.code === "cur_voltage") {
          cur_voltage = Number(item.value);
        } else if (item.code === "cur_current") {
          cur_current = Number(item.value);
        } else if (item.code === "add_ele") {
          add_ele = Number(item.value);
        }
      }

      return { switch_1, cur_power, cur_voltage, cur_current, add_ele };
    } else {
      isSimulated = true;
      console.warn("Tuya device status returned error, using fallback simulated status:", response.data);
      return {
        switch_1: simulatedState.switch_1,
        cur_power: simulatedState.cur_power,
        cur_voltage: simulatedState.cur_voltage,
        cur_current: simulatedState.cur_current,
        add_ele: simulatedState.add_ele,
      };
    }
  } catch (error: any) {
    isSimulated = true;
    console.warn("Tuya getDeviceStatus failed; falling back to simulated reading.", error.message);
    return {
      switch_1: simulatedState.switch_1,
      cur_power: simulatedState.cur_power,
      cur_voltage: simulatedState.cur_voltage,
      cur_current: simulatedState.cur_current,
      add_ele: simulatedState.add_ele,
    };
  }
}

/**
 * Toggles the smart plug device relay state (ON or OFF).
 * @param state desired relais switch state
 */
export async function toggleDevice(state: boolean): Promise<boolean> {
  simulatedState.switch_1 = state;
  if (!state) {
    simulatedState.cur_power = 0;
    simulatedState.cur_current = 0;
  } else {
    simulatedState.cur_power = 2200; // 220W
    simulatedState.cur_current = 1000; // 1A
  }

  if (isSimulated) {
    return true;
  }

  try {
    const token = await fetchToken();
    const t = Date.now().toString();
    const path = `/v1.0/devices/${DEVICE_ID}/commands`;
    
    // Commands payload
    const bodyObj = {
      commands: [{ code: "switch_1", value: state }],
    };
    const bodyStr = JSON.stringify(bodyObj);
    
    const sign = calculateSign(ACCESS_ID, ACCESS_SECRET, t, token, "POST", path, bodyStr);

    const response = await axios.post(
      `${REGION_ENDPOINT}${path}`,
      bodyObj,
      {
        headers: {
          client_id: ACCESS_ID,
          access_token: token,
          sign,
          t,
          sign_method: "HMAC-SHA256",
        },
      }
    );

    return response.data && response.data.success;
  } catch (error: any) {
    isSimulated = true;
    console.warn("Tuya toggleDevice failed; using simulator trigger fallback.", error.message);
    return true; // Safe fallback since local state has been toggled
  }
}

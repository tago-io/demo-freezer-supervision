/*
 * TagoIO (https://tago.io/)
 * TagoIO Builder V3.0.1 (https://git.io/JJ8Si)
 * -------------------
 * Generated by     :: guilhermeco
 * Generated at     :: Monday, October 25, 2021, 6:36 PM Coordinated Universal Time
 * Machine          :: MacBook-Pro-de-Guilherme.local <darwin> - Node.js v14.17.6
 * Origin file      :: src/deviceCheckinAlert.ts <Typescript>
 * Destination file :: ./build/deviceCheckinAlert.tago.js
 * -------------------
*/

var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __markAsModule = (target) => __defProp(target, "__esModule", { value: true });
var __export = (target, all) => {
  __markAsModule(target);
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __reExport = (target, module2, desc) => {
  if (module2 && typeof module2 === "object" || typeof module2 === "function") {
    for (let key of __getOwnPropNames(module2))
      if (!__hasOwnProp.call(target, key) && key !== "default")
        __defProp(target, key, { get: () => module2[key], enumerable: !(desc = __getOwnPropDesc(module2, key)) || desc.enumerable });
  }
  return target;
};
var __toModule = (module2) => {
  return __reExport(__markAsModule(__defProp(module2 != null ? __create(__getProtoOf(module2)) : {}, "default", module2 && module2.__esModule && "default" in module2 ? { get: () => module2.default, enumerable: true } : { value: module2, enumerable: true })), module2);
};

// src/deviceCheckinAlert.ts
__export(exports, {
  default: () => deviceCheckinAlert_default
});
var import_sdk3 = __toModule(require("@tago-io/sdk"));

// src/analysis/deviceCheckinAlert.ts
var import_sdk2 = __toModule(require("@tago-io/sdk"));
var import_moment_timezone = __toModule(require("moment-timezone"));

// src/lib/getDevice.ts
var import_sdk = __toModule(require("@tago-io/sdk"));
async function getDevice(account, device_id) {
  const customer_token = await import_sdk.Utils.getTokenByName(account, device_id);
  const customer_dev = new import_sdk.Device({ token: customer_token });
  return customer_dev;
}
var getDevice_default = getDevice;

// src/analysis/deviceCheckinAlert.ts
async function updateSensorStatus(account, config_dev, dev, tags, status) {
  const building_id = tags.find((x) => x.key === "building_id").value;
  const [device_name_settings] = await config_dev.getData({ variables: "device_name", series: dev.id });
  const building_dev = await getDevice_default(account, building_id);
  const [device_name_building] = await building_dev.getData({ variables: "device_name", series: dev.id });
  if (device_name_settings.metadata && device_name_building.metadata) {
    await config_dev.deleteData({ variables: "device_name", series: dev.id });
    await building_dev.deleteData({ variables: "device_name", series: dev.id });
    await config_dev.sendData({ ...device_name_settings, metadata: { ...device_name_settings.metadata, status, color: "" } });
    await building_dev.sendData({ ...device_name_building, metadata: { ...device_name_building.metadata, status, color: "" } });
  }
}
async function resolveCheckinSensor(account, config_dev, dev, checkin_time, company_id) {
  const sensor_dev = await getDevice_default(account, dev.id);
  const { last_input: lastcheckin, tags, name: sensor_name } = await sensor_dev.info();
  const diff = (0, import_moment_timezone.default)().diff((0, import_moment_timezone.default)(lastcheckin), "hours");
  console.log(diff);
  console.log(checkin_time);
  const sensor_params = await account.devices.paramList(dev.id);
  const checkin_param = sensor_params.find((x) => x.key === "checkin");
  if (Number(checkin_time) < Number(diff) && checkin_time && !checkin_param?.sent) {
    const building_id = tags.find((x) => x.key === "building_id").value;
    const { name: company_name } = await account.devices.info(company_id);
    const { name: building_name } = await account.devices.info(building_id);
    await account.devices.paramSet(dev.id, { ...checkin_param, sent: true });
    config_dev.sendData({
      variable: "alert_history",
      value: `Device "${sensor_name}" inactivity warning. Located on: ${company_name} - ${building_name}`,
      metadata: { color: "moccasin", company: company_id, bldg: building_id, sensor: sensor_name }
    });
    await updateSensorStatus(account, config_dev, dev, tags, "inactive");
    return "checkin warning";
  } else if (Number(checkin_time) > Number(diff) && checkin_param?.sent) {
    await account.devices.paramSet(dev.id, { ...checkin_param, sent: false });
    await updateSensorStatus(account, config_dev, dev, tags, "No data");
    return "back to normal";
  }
  return "Device is normal";
}
async function resolveCompanySensors(account, config_dev, company_id) {
  const params = await account.devices.paramList(company_id);
  const checkin_time = params.find((x) => x.key === "checkin")?.value;
  if (!checkin_time)
    return;
  const device_list = await account.devices.list({
    page: 1,
    fields: ["id", "name", "tags", "last_input"],
    filter: {
      tags: [
        { key: "device_type", value: "freezer" },
        { key: "company_id", value: company_id }
      ]
    },
    amount: 1e4
  });
  device_list.forEach(async (dev) => {
    await resolveCheckinSensor(account, config_dev, dev, checkin_time, company_id);
  });
}
async function handler(context, scope) {
  context.log("Running Analysis");
  const environment = import_sdk2.Utils.envToJson(context.environment);
  if (!environment) {
    return;
  } else if (!environment.config_token) {
    throw "Missing config_token environment var";
  } else if (!environment.account_token) {
    throw "Missing account_token environment var";
  }
  const config_dev = new import_sdk2.Device({ token: environment.config_token });
  const account = new import_sdk2.Account({ token: environment.account_token });
  const company_devices = await account.devices.list({
    page: 1,
    fields: ["id", "name", "tags", "last_input"],
    filter: { tags: [{ key: "device_type", value: "company" }] },
    amount: 1e4
  });
  company_devices.map(async (company) => {
    await resolveCompanySensors(account, config_dev, company.id);
  });
}
async function startAnalysis(context, scope) {
  try {
    await handler(context, scope);
    context.log("Analysis finished");
  } catch (error) {
    console.log(error);
    context.log(error.message || JSON.stringify(error));
  }
}

// src/deviceCheckinAlert.ts
var deviceCheckinAlert_default = new import_sdk3.Analysis(startAnalysis, { token: "731a761e-4018-433f-9db9-c621a7806111" });
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {});

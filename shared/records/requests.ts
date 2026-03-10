import { defineRecord } from "../lib/record-def";

export const requestRecord = defineRecord({
  key: "request",
  label: "配車依頼",
  tableName: "requests",

  fields: {
    passengerName: {
      type: "text",
      label: "利用者名",
      required: true,
      maxLength: 100,
    },
    pickupDate: { type: "date", label: "乗車日", required: true },
    passengers: {
      type: "number",
      label: "人数",
      required: true,
      min: 1,
      max: 10,
      defaultValue: 1,
    },
    vehicleType: {
      type: "select",
      label: "車種",
      options: ["sedan", "van"] as const,
    },
    notes: { type: "text", label: "備考", multiline: true },
  },

  status: {
    field: "status",
    label: "ステータス",
    options: ["受付", "配車済", "完了", "取消"] as const,
    defaultValue: "受付",
  },

  listView: {
    columns: ["passengerName", "pickupDate", "vehicleType", "status"],
    defaultSort: { field: "pickupDate", direction: "desc" },
  },

  formView: {
    sections: [
      { label: "利用者情報", fields: ["passengerName", "passengers"] },
      { label: "行程", fields: ["pickupDate", "vehicleType"] },
      { label: "備考", fields: ["notes"] },
    ],
  },
});

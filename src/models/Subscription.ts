import { Schema, model } from "mongoose";

const SubscriptionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    keys: { p256dh: { type: String, required: true }, auth: { type: String, required: true } },
  },
  { timestamps: true, versionKey: false },
);

export const Subscription = model("Subscription", SubscriptionSchema);

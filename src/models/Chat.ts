import { Schema, model, type InferSchemaType } from "mongoose";

const MessageSchema = new Schema(
  {
    sender: { type: String, enum: ["origin", "response"], required: true },
    message: { type: String, required: true, maxlength: 4000 },
    /** formato legado do app: "DD/MM/YYYY-HH:mm" */
    timestamp: { type: String, maxlength: 32 },
  },
  { _id: false },
);

/**
 * user_origin/user_response continuam como listas (com um usuário só)
 * para o front existente seguir funcionando sem mudança de contrato.
 */
const ChatSchema = new Schema(
  {
    user_origin: [{ type: Schema.Types.ObjectId, ref: "User", index: true }],
    user_response: [{ type: Schema.Types.ObjectId, ref: "User", index: true }],
    chatData: { type: [MessageSchema], default: [] },
    status: { type: String, enum: ["new", "reported", "expired", "canceled"], default: "new" },
  },
  { timestamps: true, versionKey: false },
);

export type ChatDoc = InferSchemaType<typeof ChatSchema>;
export const Chat = model("Chat", ChatSchema);

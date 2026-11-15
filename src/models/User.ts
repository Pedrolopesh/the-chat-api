import { Schema, model, type InferSchemaType } from "mongoose";

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    img_profile: { type: String, default: "" },
    password: { type: String, required: true, select: false },
    /** recuperação de senha: só o hash do código, com validade e limite de tentativas */
    passwordReset: {
      type: { codeHash: String, expiresAt: Date, attempts: { type: Number, default: 0 } },
      select: false,
      default: undefined,
    },
    chats: [{ type: Schema.Types.ObjectId, ref: "Chat" }],
    status: { type: String, enum: ["active", "blocked", "inative"], default: "active" },
  },
  { timestamps: true, versionKey: false },
);

export type UserDoc = InferSchemaType<typeof UserSchema>;
export const User = model("User", UserSchema);

/** Campos que outros usuários podem ver (sem e-mail, senha, códigos). */
export const PUBLIC_USER_FIELDS = "_id name img_profile";

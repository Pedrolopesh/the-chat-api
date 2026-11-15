import { Schema, model, type InferSchemaType } from "mongoose";

/**
 * Sem senha: a pessoa entra com um código de 6 dígitos enviado ao e-mail.
 * A conta nasce "pendente" no primeiro pedido de código e vira confirmada
 * (emailVerifiedAt) quando o código é usado pela primeira vez.
 */
const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    img_profile: { type: String, default: "" },
    emailVerifiedAt: { type: Date, default: null },
    /** código de acesso atual: só o hash, com validade, tentativas e envio mais recente */
    loginCode: {
      type: { codeHash: String, expiresAt: Date, attempts: { type: Number, default: 0 }, sentAt: Date },
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

/** Campos que outros usuários podem ver (sem e-mail nem código). */
export const PUBLIC_USER_FIELDS = "_id name img_profile";

import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { features } from "../config/env.js";
import { badRequest, forbidden, HttpError, notFound } from "../lib/http-error.js";
import { ALLOWED_IMAGE_TYPES, deleteObject, keyFromUrl, sniffImage, uploadAvatar } from "../lib/storage.js";
import { logger } from "../lib/logger.js";
import { auth, me } from "../middlewares/auth.js";
import { body, idParam } from "../middlewares/validate.js";
import { PUBLIC_USER_FIELDS, User } from "../models/User.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, ALLOWED_IMAGE_TYPES.includes(file.mimetype)),
});

/** Só o próprio usuário pode alterar o próprio cadastro. */
function assertSelf(paramId: string, userId: string) {
  if (paramId !== userId) throw forbidden("You can only change your own profile");
}

/** Avatar só de URL https (evita javascript:, data: etc. no <img>). */
const imageUrl = z
  .string()
  .url()
  .max(2048)
  .refine((u) => u.startsWith("https://"), "must be https");

export const usersRouter = Router();
usersRouter.use(auth);

usersRouter.get("/list/users", async (req, res) => {
  const users = await User.find({ status: { $ne: "blocked" }, emailVerifiedAt: { $ne: null } })
    .select(PUBLIC_USER_FIELDS)
    .sort({ name: 1 })
    .limit(500)
    .lean();
  res.json(users);
});

usersRouter.get("/user/:id", idParam, async (req, res) => {
  const self = req.params.id === me(req);
  const user = await User.findById(req.params.id)
    .select(self ? "-chats" : PUBLIC_USER_FIELDS)
    .lean();
  if (!user) throw notFound("User not found");
  res.status(200).send({ success: true, sucess: true, content: user });
});

usersRouter.put(
  "/update/user/:id",
  idParam,
  body(z.object({ name: z.string().trim().min(1).max(80) })),
  async (req, res) => {
    assertSelf(String(req.params.id), me(req));
    const user = await User.findByIdAndUpdate(req.params.id, { name: req.body.name }, { new: true }).lean();
    if (!user) throw notFound("User not found");
    res.send({ success: true, message: "succes on update user", data: user });
  },
);

usersRouter.patch("/update/user/image/:id", idParam, body(z.object({ img_profile: imageUrl })), async (req, res) => {
  assertSelf(String(req.params.id), me(req));
  const user = await User.findByIdAndUpdate(req.params.id, { img_profile: req.body.img_profile }, { new: true }).lean();
  if (!user) throw notFound("User not found");
  res.send({ success: true, message: "succes on update user", data: user });
});

/** Upload do avatar: sempre do usuário logado (o user_id do corpo é ignorado). */
usersRouter.patch("/upload/user/image", upload.single("photo"), async (req, res) => {
  if (!features.storage) throw new HttpError(503, "Upload unavailable");
  const file = req.file;
  if (!file) throw badRequest("photo must be a jpeg, png or webp image");
  const type = sniffImage(file.buffer);
  if (!type) throw badRequest("photo must be a jpeg, png or webp image");

  const url = await uploadAvatar(me(req), file.buffer, type);
  const previous = await User.findByIdAndUpdate(me(req), { img_profile: url }).select("img_profile").lean();
  // apaga o avatar anterior do bucket (só se for um gerado por nós)
  const oldKey = previous?.img_profile ? keyFromUrl(previous.img_profile) : null;
  if (oldKey) void deleteObject(oldKey).catch((err) => logger.warn({ err }, "falha ao apagar avatar antigo"));
  const user = await User.findById(me(req)).lean();
  res.send({ success: true, sucess: true, message: "succes on update user image profile", data: user });
});

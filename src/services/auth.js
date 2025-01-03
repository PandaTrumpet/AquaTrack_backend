import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import handlebars from "handlebars";
import createHttpError from "http-errors";
import jwt from "jsonwebtoken";
import fs from "node:fs/promises";
import path from "node:path";
import {
  FIFTEEN_MINUTES,
  ONE_DAY,
  SMTP,
  TEMPLATES_DIR,
} from "../constans/index.js";
import { SessionCollection } from "../db/models/session.js";
import { UserCollection } from "../db/models/users.js";
import { env } from "../utils/env.js";
import {
  getFullNameFromGoogleTokenPayload,
  validateCode,
} from "../utils/googleOAuth2.js";
import { comparePassword, hashPassword } from "../utils/hash.js";
import { sendEmail } from "../utils/sendMail.js";
export const registerUser = async (payload) => {
  const user = await UserCollection.findOne({ email: payload.email });

  if (user) {
    throw createHttpError(409, "Email in use");
  }

  const encryptedPassword = await hashPassword(payload.password);
  return await UserCollection.create({
    ...payload,
    password: encryptedPassword,
  });
};

export const loginUser = async (payload) => {
  const user = await UserCollection.findOne({ email: payload.email });
  if (!user) {
    throw createHttpError(404, "User not found");
  }

  const isEqual = await comparePassword(payload.password, user.password);
  if (!isEqual) {
    throw createHttpError(401, "Password invalid");
  }

  await SessionCollection.deleteOne({ userId: user._id });
  const accessToken = randomBytes(30).toString("base64");
  const refreshToken = randomBytes(30).toString("base64");
  return await SessionCollection.create({
    userId: user._id,
    accessToken,
    refreshToken,
    accessTokenValidUntil: new Date(Date.now() + FIFTEEN_MINUTES),
    refreshTokenValidUntil: new Date(Date.now() + ONE_DAY),
  });
};

export const logoutUser = async (sessionId) => {
  await SessionCollection.deleteOne({ _id: sessionId });
};

const createSession = (userId) => {
  const accessToken = randomBytes(30).toString("base64");
  const refreshToken = randomBytes(30).toString("base64");
  return {
    userId,
    accessToken,
    refreshToken,
    accessTokenValidUntil: new Date(Date.now() + FIFTEEN_MINUTES),
    refreshTokenValidUntil: new Date(Date.now() + ONE_DAY),
  };
};

export const refreshUserSession = async ({ sessionId, refreshToken }) => {
  const session = await SessionCollection.findOne({
    _id: sessionId,
    refreshToken,
  });

  if (!session) {
    throw createHttpError(401, "Session not found!");
  }
  const isSessionTokenExpired =
    new Date() > new Date(session.refreshTokenValidUntil);
  if (isSessionTokenExpired) {
    throw createHttpError(401, "Session token expired!");
  }

  const newSession = createSession(session.userId);
  await SessionCollection.deleteOne({ _id: sessionId, refreshToken });
  return await SessionCollection.create({
    userId: session.userId,
    ...newSession,
  });
};

export const requestResetToken = async (email) => {
  const user = await UserCollection.findOne({ email });
  if (!user) {
    throw createHttpError(404, "User not found!");
  }
  const resetToken = jwt.sign(
    {
      sub: user._id,
      email,
    },
    env("JWT_SECRET"),
    { expiresIn: "15m" }
  );

  const resetPasswordTemplatePath = path.join(
    TEMPLATES_DIR,
    "reset-password-email.html"
  );
  const templateSource = (
    await fs.readFile(resetPasswordTemplatePath)
  ).toString();
  const template = handlebars.compile(templateSource);
  const html = template({
    name: user.name,
    link: `${env("APP_DOMAIN")}/reset-password?token=${resetToken}`,
  });
  await sendEmail({
    from: env(SMTP.SMTP_FROM),
    to: email,
    subject: "Reset your password",
    html,
  });
};

export const resetPassword = async (payload) => {
  let entries;
  try {
    entries = jwt.verify(payload.token, env("JWT_SECRET"));
  } catch (error) {
    if (error instanceof Error) throw createHttpError(401, error.message);
    throw error;
  }

  const user = await UserCollection.findOne({
    email: entries.email,
    _id: entries.sub,
  });
  if (!user) {
    throw createHttpError(401, "User not found");
  }
  const encryptedPassword = await bcrypt.hash(payload.password, 10);
  await UserCollection.updateOne(
    {
      _id: user._id,
    },
    { password: encryptedPassword }
  );
};

export const loginOrSignupWithGoogle = async (code) => {
  const loginTicket = await validateCode(code);
  const payload = loginTicket.getPayload();
  if (!payload) {
    throw createHttpError(401, "Unauthorized");
  }
  let user = await UserCollection.findOne({ email: payload.email });
  if (!user) {
    const password = await bcrypt.hash(randomBytes(10), 10);
    user = await UserCollection.create({
      email: payload.email,
      name: getFullNameFromGoogleTokenPayload(payload),
      password,
    });
  }
  const newSession = createSession(user._id);
  return await SessionCollection.create({
    userId: user._id,
    ...newSession,
  });
};

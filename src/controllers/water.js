import createHttpError from "http-errors";
import {
  createWater,
  deleteWater,
  getAllWater,
  getWaterById,
  updateWater,
} from "../services/water.js";

export const getWaterController = async (req, res) => {
  const water = await getAllWater();
  res.status(200).json({
    status: 200,
    message: "All water",
    data: water,
  });
};
export const getWaterByIdController = async (req, res) => {
  const { waterId } = req.params;
  const water = await getWaterById(waterId);
  if (!water) {
    throw createHttpError(404, "Water not found!");
  }

  res.status(200).json({
    satus: 200,
    message: `Successfully found water with id ${waterId}`,
    data: water,
  });
};
export const createWaterController = async (req, res) => {
  const water = await createWater(req.body);

  res.status(200).json({
    status: 200,
    message: "Successfully created water!",
    data: water,
  });
};

export const deleteWaterController = async (req, res, next) => {
  const { waterId } = req.params;
  const water = await deleteWater(waterId);
  if (!water) {
    next(createHttpError(404, "Water not found!"));
    return;
  }
  res.status(204).send();
};
export const upsertWaterController = async (req, res, next) => {
  const { waterId } = req.params;
  const result = await updateWater(waterId, req.body, { upsert: true });
  if (!result) {
    next(createHttpError(404, "Water not found!"));
    return;
  }
  const status = result.isNew ? 201 : 200;
  res.status(status).json({
    status,
    message: `Successfully upserted a water with id ${waterId}! `,
    data: result,
  });
};
export const patchWaterController = async (req, res, next) => {
  const { waterId } = req.params;
  const water = await updateWater(waterId, req.body);
  if (!water) {
    next(createHttpError(404, "Water not found!"));
    return;
  }
  res.status(200).json({
    status: 200,
    message: `Successfully patched a water with id ${waterId}`,
    data: water,
  });
};
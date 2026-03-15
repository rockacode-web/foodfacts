import {
  deleteStoredScanForUser,
  getStoredScanForUser,
  listScansForUser
} from "../services/scanPersistenceService.js";

function parseScanId(value) {
  const scanId = Number(value);
  if (!Number.isInteger(scanId) || scanId <= 0) {
    return null;
  }
  return scanId;
}

export async function getScanHistory(req, res, next) {
  try {
    const scans = await listScansForUser(req.auth.userId);
    return res.json({
      status: "success",
      scans
    });
  } catch (error) {
    return next(error);
  }
}

export async function getStoredScan(req, res, next) {
  try {
    const scanId = parseScanId(req.params.id);
    if (!scanId) {
      return res.status(404).json({
        status: "error",
        message: "Scan not found."
      });
    }

    const scan = await getStoredScanForUser(scanId, req.auth.userId);
    return res.json({
      status: "success",
      scan
    });
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        status: "error",
        message: error.message
      });
    }
    return next(error);
  }
}

export async function deleteStoredScan(req, res, next) {
  try {
    const scanId = parseScanId(req.params.id);
    if (!scanId) {
      return res.status(404).json({
        status: "error",
        message: "Scan not found."
      });
    }

    const result = await deleteStoredScanForUser(scanId, req.auth.userId);
    return res.json({
      status: "success",
      ...result
    });
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        status: "error",
        message: error.message
      });
    }
    return next(error);
  }
}

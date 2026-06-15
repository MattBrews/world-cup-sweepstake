import { getDb } from '../../db/connection.js';
import { getV2Db } from '../db/connection.js';

export function dbRouter(req, res, next) {
  const useV2 = req.query.db === 'v2' || process.env.ACTIVE_DB === 'v2';
  req.db = useV2 ? getV2Db() : getDb();
  req.isV2 = useV2;
  next();
}

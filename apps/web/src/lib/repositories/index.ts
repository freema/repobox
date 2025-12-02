// Redis key patterns
export { REDIS_KEYS, TTL } from "./keys";

// Serialization helpers
export {
  toHash,
  fromHash,
  camelToSnake,
  snakeToCamel,
  type FieldSchema,
  type FieldType,
} from "./serialization";

// User repository
export {
  createUser,
  getUser,
  updateUser,
  updateUserLastLogin,
  deleteUser,
  userExists,
} from "./user";

// Session repository
export {
  createSession,
  getSession,
  extendSession,
  deleteSession,
  sessionExists,
  generateSessionId,
  createUserSession,
} from "./session";

// Job repository
export {
  createJob,
  getJob,
  updateJobStatus,
  getUserJobs,
  getUserJobCount,
  deleteJob,
  generateJobId,
  appendJobOutput,
  getJobOutput,
  getJobOutputCount,
  enqueueJob,
  ensureConsumerGroup,
  getPendingJobs,
  type JobStreamMessage,
} from "./job";

/**
 * Validates that all required environment variables are set.
 * Throws a descriptive error if any are missing.
 * 
 * @throws {Error} If one or more required environment variables are missing.
 */
const REQUIRED_ENV_VARS = [
  'MONGODB_URI',
  'JWT_SECRET',
  'ACCESS_TOKEN_EXPIRES_IN',
  'REFRESH_TOKEN_EXPIRES_IN',
  'PORT'
];

/**
 * Checks for missing required environment variables and throws an error if any are not set.
 */
function validateEnv() {
  const missingVars = REQUIRED_ENV_VARS.filter((envVar) => {
    // Treat empty strings and undefined as missing
    return !process.env[envVar] || process.env[envVar].trim() === '';
  });

  if (missingVars.length > 0) {
    const errorMsg = [
      'Environment validation error:',
      `Missing required environment variable(s): ${missingVars.join(', ')}`,
      'Please check your .env file or environment configuration.'
    ].join(' ');
    throw new Error(errorMsg);
  }
}

export default validateEnv;
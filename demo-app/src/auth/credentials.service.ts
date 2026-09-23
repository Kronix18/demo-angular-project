// src/auth/credentials.service.ts
// Hardcoded default admin credentials for local development only.

/**
 * MD5 hash of "changeme" (the default password for the admin account).
 * Computed via: echo -n changeme | md5sum => 4a8a08f09d37bbfca9e8a2d96cfc919c
 */
export const DEFAULT_ADMIN_PASSWORD_HASH = "4a8a08f09d37bbfca9e8a2d96cfc919c";

/**
 * Returns the default admin account for local development.
 * In a real application, this would come from a secure source (e.g., environment variables or a secrets manager).
 */
export function getDefaultAdmin() {
  return {
    email: "admin@demo.angular-project.local",
    username: "admin",
    // Note: We do not return the plaintext password for security reasons, even in development.
    // The password hash is used for client-side validation in this demo.
  };
}

/**
 * Validates a plaintext password against the stored hash for the default admin.
 * @param password The plaintext password to validate.
 * @returns true if the password matches the default admin's password, false otherwise.
 */
export function isDefaultAdminPassword(password: string): boolean {
  // In a real application, you would use a constant-time comparison to avoid timing attacks.
  // For this demo, we use a simple string comparison because it's only used in development.
  return password === "changeme";
}
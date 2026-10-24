'use strict';

/**
 * Raised when the login is rejected and the user has to sign in (again)
 * with an emailed code. Retrying will not help.
 */
export class AuthError extends Error {

  /** New Cognito session when the code was wrong but the user may retry. */
  session?: string;

  constructor(message: string, session?: string) {
    super(message);
    this.name = 'AuthError';
    this.session = session;
  }

}

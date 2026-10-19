/** Shared settings of the end-to-end test server and the tests. */
export const E2E = {
  port: 8790,
  origin: 'http://localhost:8790',
  mockPort: 8799,
  persistDir: '.wrangler/e2e',
  salt: 'e2e-test-salt',
  /** The mock siteverify endpoint accepts this token and rejects every other one, except: */
  passToken: 'test-pass',
  /** …and answers this one with a server error, as if Turnstile were down. */
  downToken: 'test-down',
  /** …and passes this one, but for a widget on another site (wrong hostname). */
  foreignHostToken: 'test-foreign-host',
};

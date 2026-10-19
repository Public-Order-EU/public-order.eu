/** Shared settings of the end-to-end test server and the tests. */
export const E2E = {
  port: 8790,
  origin: 'http://localhost:8790',
  mockPort: 8799,
  persistDir: '.wrangler/e2e',
  salt: 'e2e-test-salt',
  /** The mock siteverify endpoint accepts this token and rejects every other one. */
  passToken: 'test-pass',
};

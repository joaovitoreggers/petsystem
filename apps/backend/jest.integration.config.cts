/* eslint-disable */
const { readFileSync } = require('fs');

// Reading the SWC compilation config for the spec files
const swcJestConfig = JSON.parse(readFileSync(`${__dirname}/.spec.swcrc`, 'utf-8'));
swcJestConfig.swcrc = false;

/**
 * Config separada de `jest.config.cts` de propósito: testes de integração
 * batem num Postgres de verdade (ver setup-test-database.ts) e por isso não
 * entram no alvo `test` normal (`nx run backend:test`), que continua sem
 * depender de banco — ver test.sh. Rode com `npm run backend:test:integration`
 * (o script já define as variáveis DB_HOST/DB_PORT/etc. do banco de teste).
 */
module.exports = {
  displayName: '@org/backend-integration',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  testMatch: ['<rootDir>/src/integration/**/*.integration-spec.ts'],
  globalSetup: '<rootDir>/src/integration/setup-test-database.ts',
  transformIgnorePatterns: [
    'node_modules/(?!(@nestjs/jwt|@nestjs/config|@nestjs/passport|@nestjs/typeorm)/)',
  ],
  testTimeout: 30000,
};

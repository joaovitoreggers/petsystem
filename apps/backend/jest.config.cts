/* eslint-disable */
const { readFileSync } = require('fs');

// Reading the SWC compilation config for the spec files
const swcJestConfig = JSON.parse(
  readFileSync(`${__dirname}/.spec.swcrc`, 'utf-8'),
);

// Disable .swcrc look-up by SWC core because we're passing in swcJestConfig ourselves
swcJestConfig.swcrc = false;

module.exports = {
  displayName: '@org/backend',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: 'test-output/jest/coverage',
  // Testes de integração (Postgres de verdade) vivem à parte — ver
  // jest.integration.config.cts — e não devem rodar aqui: este alvo (`nx
  // run backend:test`) precisa continuar funcionando sem banco nenhum.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/src/integration/'],
  // @nestjs/jwt, @nestjs/config, @nestjs/passport and @nestjs/typeorm ship
  // ESM-only builds; transform them too instead of leaving them out of
  // Jest's default node_modules exclusion. @nestjs/typeorm only started
  // getting pulled into unit-test specs once TenancyReferenceGuardService
  // (tenancy-reference-guard.service.ts) started using @InjectRepository
  // directly — every other service in this codebase sits behind a
  // repository-interface a unit test can mock without ever importing the
  // real ORM decorators.
  transformIgnorePatterns: [
    'node_modules/(?!(@nestjs/jwt|@nestjs/config|@nestjs/passport|@nestjs/typeorm)/)',
  ],
};

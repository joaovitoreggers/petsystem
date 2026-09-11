module.exports = {
  displayName: 'frontend',
  preset: '../../jest.preset.js',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  coverageDirectory: 'test-output/jest/coverage',
  transform: {
    '^.+\\.(ts|mjs|js|html)$': [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        stringifyContentPathRegex: '\\.(html|svg)$',
      },
    ],
  },
  transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$)'],
  // @vladmandic/face-api precisa de WebGL/TF.js de navegador de verdade —
  // sob Jest, resolve pro build de Node (que exige @tensorflow/tfjs-node,
  // não instalado, já que o alvo real é o navegador) e nem carregaria.
  // Ver src/test-mocks/face-api.mock.ts.
  moduleNameMapper: {
    '^@vladmandic/face-api$': '<rootDir>/src/test-mocks/face-api.mock.ts',
  },
  snapshotSerializers: [
    'jest-preset-angular/build/serializers/no-ng-attributes',
    'jest-preset-angular/build/serializers/ng-snapshot',
    'jest-preset-angular/build/serializers/html-comment',
  ],
};

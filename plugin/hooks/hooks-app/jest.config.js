module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: false,
        tsconfig: {
          module: 'commonjs',
          target: 'ES2020',
          lib: ['ES2020'],
          strict: true,
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
          resolveJsonModule: true,
        },
      },
    ],
    '^.+\\.js$': [
      'ts-jest',
      {
        useESM: false,
        tsconfig: {
          module: 'commonjs',
        },
      },
    ],
  },
  // Transpile ESM-only packages
  transformIgnorePatterns: [
    'node_modules/(?!(mdast|unist|micromark|decode-named-character-reference|character-entities))',
  ],
};

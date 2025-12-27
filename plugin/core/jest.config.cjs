module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  // Map .js imports to .ts files for ESM compatibility
  // Map @turboshovel/shared to TypeScript source for testing
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@turboshovel/shared$': '<rootDir>/../../packages/shared/src/index.ts',
  },
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
  // Transpile ESM-only packages (including @turboshovel/shared)
  transformIgnorePatterns: [
    'node_modules/(?!(@turboshovel|mdast|unist|micromark|decode-named-character-reference|character-entities))',
  ],
};

module.exports = {
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }]
  },
  moduleFileExtensions: ['js', 'ts', 'json'],
  testMatch: ['**/test/**/*.test.(ts|js)'],
  testEnvironment: 'node',
  setupFilesAfterEnv: ['jest-extended/all'],
  preset: 'ts-jest'
};
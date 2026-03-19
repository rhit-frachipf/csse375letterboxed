module.exports = {
  testMatch: ['**/tests/**/*.js', '**/?(*.)+(spec|test).js'],
  testEnvironment: 'jsdom',
  collectCoverageFrom: [
    'public/scripts/**/*.js',
    '!**/node_modules/**'
  ]
};

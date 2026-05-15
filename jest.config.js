module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup/miniprogram-env.js"],
  collectCoverageFrom: [
    "utils/**/*.js",
    "pages/**/*.js",
    "package-courses/**/*.js",
    "!**/*.json"
  ],
  coveragePathIgnorePatterns: ["/node_modules/"],
  testMatch: ["**/*.test.js"]
}

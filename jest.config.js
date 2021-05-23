module.exports = {
    // transform: { "\\.ts$": ['ts-jest'] },
    modulePathIgnorePatterns: [
        "packages/.*/dist"
    ],
    "moduleNameMapper": {
        "mediakitchen-server": "<rootDir>/packages/mediakitchen-server/src"
    },
};
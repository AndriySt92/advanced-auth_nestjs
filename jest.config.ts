module.exports = {
    moduleFileExtensions: ['js', 'json', 'ts'],
    testRegex: '.*\\.spec\\.ts$',
    transform: {
        '^.+\\.(t|j)s$': 'ts-jest',
    },
    collectCoverageFrom: ['src/**/*.(t|j)s'],
    coverageDirectory: 'coverage',
    testEnvironment: 'node',
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
        '^@test/(.*)$': '<rootDir>/test/$1',
        '^@/(.*)$': '<rootDir>/src/$1',
    },
};

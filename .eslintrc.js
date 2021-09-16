module.exports = {
    "extends": "airbnb-base",
    "rules": {
        // "space-before-function-paren": 0,
        // "quote-props": ["error", "consistent"],
        // "indent": 0
        "max-len": ["error", { "code": 300 }],
        // "allowForLoopAfterthoughts": "warn", // 0 = off, 1 = warn, 2 = error
        "newline-per-chained-call": ["error", { "ignoreChainWithDepth": 10 }],
        "guard-for-in": "warn",
        "no-plusplus": 0,
        "linebreak-style": 0,
    }
};
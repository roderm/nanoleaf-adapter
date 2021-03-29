'use-strict'

const { Extension } = require('gateway-addon');

class NanoleafPanels extends Extension {
    constructor(addonManager, errorCallback) {
        super(addonManager, manifest.id, manifest.id);
        addonManager.addExtenstion(this);
    }
}

module.exports = {
    NanoleafPanels
}
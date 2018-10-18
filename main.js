'use strict';

const { NanoleafAdapter } = require('./lib/nanoleaf-adapter');

module.exports = function(adapterManager, manifest, errorCallback) {
  new NanoleafAdapter(adapterManager, manifest, errorCallback);
};
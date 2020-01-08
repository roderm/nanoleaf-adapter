'use strict';

const { NanoleafAdapter } = require('./lib/nanoleaf-adapter');

module.exports = function(adapterManager, _, errorCallback) {
  new NanoleafAdapter(adapterManager, errorCallback);
};

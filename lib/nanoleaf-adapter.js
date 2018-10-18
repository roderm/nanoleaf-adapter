'use-strict'

const { Adapter, Device } = require('gateway-addon');
const { NanoleafDevice, RegisterDevice } = require('./nanoleaf-device');
const { NanoleafDatabase } = require('./nanoleaf-db');
const { NanoleafScanner } = require('./nanoleaf-scanner');

class NanoleafAdapter extends Adapter {
  /**
* Initialize the object.
*
* @param {Object} addonManager - AddonManagerProxy object
* @param {Object} manifest - Package manifest
* @param {function(string, string)} errorCallback - returns an error 
*/
  constructor(addonManager, manifest, errorCallback) {
    super(addonManager, manifest.name, manifest.name);
    addonManager.addAdapter(this);
    this.db = new NanoleafDatabase(this.packageName)
    this.scanner = new NanoleafScanner()
    this.scanner
      .found()
      .subscribe((service) => { 
        RegisterDevice(service)
        .then((auth) => {
          service["auth"] = auth.auth_token;
          this.db.insertDevice(service).then(() => {
            this.handleDeviceAdded(new NanoleafDevice(this, service))
          })
        })
        .catch((err) => {
          console.log("Failed receiving auth_token", err);
        })
      })
    this.loadKnownDevices()
  }

  loadKnownDevices(){
    this.db.getDevices()
      .then((devices) => {
        for(const d of devices) {
          console.log(d);
          this.handleDeviceAdded(new NanoleafDevice(this, d.service));
        }
      });
  }

  startPairing(timeout) {
    super.startPairing(timeout)
    this.scanner.start()
  }
  cancelPairing() {
    this.scanner.unload()
  }
  removeThing(device){
    this.handleDeviceRemoved(device)
    this.db.removeDevice(device.id)
  }
}

module.exports = {
  NanoleafAdapter
}
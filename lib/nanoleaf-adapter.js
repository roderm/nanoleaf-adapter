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

    this.loadKnownDevices()
      .then(() =>   {this.scanner = new NanoleafScanner()})
      .catch(() =>  {this.scanner = new NanoleafScanner()})
  }

  loadKnownDevices(){
    return new Promise((resolve, reject) => {
      this.db.getDevices()
      .then((devices) => {
        for(const d of devices) {
          this.handleDeviceAdded(new NanoleafDevice(this, d.service));
        }
        resolve(this.devices)
      }).catch(reject)
    })

    
  }

  startPairing(timeout) {
    super.startPairing(timeout)
    if(this.scanner){
      this.scanner
      .found()
      .subscribe((service) => {
        // skip if already in DB
        if(this.devices[service.id]){
          return;
        }
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
    this.scanner.start()
    }
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
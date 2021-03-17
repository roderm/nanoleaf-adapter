'use-strict'

const { Adapter } = require('gateway-addon');
const { NanoleafDevice, RegisterDevice } = require('./nanoleaf-device');
const { NanoleafDatabase } = require('./nanoleaf-db');
const { NanoleafScanner } = require('./nanoleaf-scanner');
const manifest = require('../manifest.json');

class NanoleafAdapter extends Adapter {
  /**
* Initialize the object.
*
* @param {Object} addonManager - AddonManagerProxy object
* @param {function(string, string)} errorCallback - returns an error 
*/
  constructor(addonManager, errorCallback) {
    super(addonManager, manifest.id, manifest.id);
    addonManager.addAdapter(this);
    this.db = new NanoleafDatabase(this.packageName)
    this.scannedDevices = new Array();
    this.loadKnownDevices()
      .then(this.startScanning())
      .catch(this.startScanning())
  }

  startScanning(){
    this.scanner = new NanoleafScanner()
    this.scanner
      .found()
      .subscribe((service) => {
        this.scannedDevices.push(service)
      })
    this.scanner.start(3000)

    // Push devices from Adapter-Config
    this.db.open().then(() => {
      this.db.loadConfig().then(config => {
        console.log("got config", config)
        var devices = config.manualDevices.map((devConf) => {
          var port = devConf.port != '' ? devConf.port : 16021;
          var ip = devConf.ipAddress;
          return {
            address: ip,
            port: port,
            api: 'http://' + ip + ':' + port,
            id: ip,
            name: ip
          }
        })
        devices.forEach(dev => {
          this.scanner.addManual(dev)
        })
      })
    })
  }

  loadKnownDevices(){
    return new Promise((resolve, reject) => {
      this.db.getDevices()
      .then((devices) => {
        for(const d of devices) {
          this.handleDeviceAdded(new NanoleafDevice(this, d));
        }
        resolve(this.devices)
      }).catch(reject)
    })
  }

  startPairing(timeout) {
    super.startPairing(timeout)
    for(let nd of this.scannedDevices){
      if(this.devices[nd.id]){
        console.error("device already exists: ", nd.id)
        return;
      }
      RegisterDevice(nd)
      .then((auth) => {
        nd["auth"] = auth.auth_token;
        this.db.insertDevice(nd).then(() => {
          this.handleDeviceAdded(new NanoleafDevice(this, nd))
        })
      })
      .catch((err) => {
        console.log("Failed receiving auth_token", err);
      })
    }
  }

  removeThing(device){
    this.handleDeviceRemoved(device)
    this.db.removeDevice(device.id)
  }
}

module.exports = {
  NanoleafAdapter
}

'use-strict'

const { Subject } = require('rxjs');
const manifest = require('../manifest.json');

var ssdp = require('node-ssdp').Client

class NanoleafScanner {
    constructor() {
        this.client = new ssdp({})
        this.client.on('response', (headers, code, rinfo) => {
            this._checkAdd(headers, code, rinfo)
        })
        this.Services = new Array();
        this.serviceUp = new Subject();
        this.interval = null;
    }
    _checkAdd(headers, code, rinfo) {
        if (!this.Services.includes(headers['NL-DEVICEID'])) {
            this.Services.push(headers['NL-DEVICEID']);
            this.serviceUp.next({
                address: rinfo.address,
                port: rinfo.port,
                api: headers["LOCATION"],
                id: manifest.id + '-' + headers["NL-DEVICEID"],
                name: headers["NL-DEVICENAME"]
            })
        }
    }
    scanOnce() {
        this.client.search('st:nanoleaf_aurora:light')
        this.client.search('st:nanoleaf:nl29')
    }
    start(interval) {
        this.interval = setInterval(() => {
            this.scanOnce()
        }, interval)
    }
    found() {
        return this.serviceUp
    }
    unload() {
        this.Services = new Array();
        this.serviceUp.complete()
        clearInterval(this.interval)
    }
    addManual(dev) {
        this.Services.push(dev.id);
        this.serviceUp.next(dev);
        console.log("added manual device with ip", dev.address);
    }
}

module.exports = {
    NanoleafScanner
}
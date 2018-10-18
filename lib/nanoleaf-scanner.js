'use-strict'

const {Subject} = require('rxjs');
var ssdp = require('node-ssdp').Client

class NanoleafScanner{
    constructor(){
        this.client = new ssdp({})
        this.client.on('response', (headers, code, rinfo) => {
            this._checkAdd(headers, code, rinfo)
        })
        this.Services = new Array();
        this.serviceUp = new Subject();
        this.interval = null;
    }
    _checkAdd(headers, code, rinfo){
        if(!this.Services.includes(headers['NL-DEVICEID'])){
            this.Services.push(headers['NL-DEVICEID']);
            this.serviceUp.next({
                address: rinfo.address,
                port:  rinfo.port,
                api: headers["LOCATION"],
                id: headers["NL-DEVICEID"],
                name: headers["NL-DEVICENAME"]
            })
        }
    }
    start(){
        this.interval = setInterval(() => {
            this.client.search('st:nanoleaf_aurora:light')
        }, 3000)
    }
    found(){
        return this.serviceUp
    }
    unload(){
        this.serviceUp.complete()
        clearInterval(this.interval)
    }
}

module.exports = {
    NanoleafScanner
}
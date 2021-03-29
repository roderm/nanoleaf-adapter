'use-strict'

const { Subject } = require('rxjs');
const manifest = require('../manifest.json');

const mdns = require('mdns-js');

class NanoleafMdns {
    constructor() {
        this.client = mdns.createBrowser();
        this.client.on('update', function (data) {
            _checkAdd(service)
            data.type.forEach(type => {
                if (type.name == 'nanoleafapi') {
                    console.log('data:', data);
                }
            });
        });
        this.Services = new Array();
        this.serviceUp = new Subject();
        this.interval = null;
    }
    _checkAdd(service) {
        console.log('received service:', service);
        let type = service.type.find((type) => type.name === 'nanoleafapi')
        if (!type) {
            return
        }
        var address = service.addresses.shift();
        var port = service.port ? service.port : 16021;
        return {
            address: address,
            port: port,
            api: `http://${address}:${port}`,
            // id: `${manifest.id}-${port}`,
            // name: ip
        }
    }
    start() {
        this.browser.start()
    }
    found() {
        return this.serviceUp
    }
    unload() {
        this.browser.stop()
        this.Services = new Array();
        this.serviceUp.complete()
        clearInterval(this.interval)
    }
    addManual(dev) {

    }
}

module.exports = {
    NanoleafMdns
}
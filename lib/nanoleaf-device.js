'use-strict'

const { Device, Property } = require('gateway-addon');
const request = require('request');
const convert = require('color-convert');
const { Subject } = require('rxjs')
const { skip } = require('rxjs/operators')

const RegisterDevice = (service) => {
    return new Promise((resolve, reject) => {
        request.post(service.api + '/api/v1/new', (error, response, body) => {
            if (error) {
                reject(error)
                return
            }
            switch (response.statusCode) {
                case 200:
                    resolve(JSON.parse(body))
                    return
                default:
                    reject(response.statusCode)
            }
        })
    })
};

class PowerProperty extends Property {
    constructor(dev, name) {
        const descr = { "@type": "OnOffProperty", "type": "boolean" }
        super(dev, name, descr)
        setInterval(() => {
            this.getValue().then((value) => {
                this.value = value;
                this.device.notifyPropertyChanged(this)
            })
        }, 60 * 1000)
    }
    getValue() {
        return new Promise((resolve, reject) => {
            this.device.get('/state/on')
                .then((response) => {
                    this.value = !!response["value"];
                    this.device.notifyPropertyChanged(this);
                    resolve(this.value)
                })
                .catch((err) => {
                    console.error(err)
                    reject(err)
                })
        })
    }
    setValue(value) {
        return new Promise((resolve, reject) => {
            this.device.put('/state', { "on": { "value": value } })
                .then(() => { resolve(!!value) })
                .catch((err) => {
                    console.error(err)
                    reject(err)
                })
        })
    }
}

class BrightnessProperty extends Property {
    constructor(dev, name) {
        const descr = { "@type": "BrightnessProperty", "type": "number" }
        super(dev, name, descr)
        this._updateMyValue()
        setInterval(() => {
            this._updateMyValue()
        }, 60 * 1000)
    }
    _updateMyValue() {
        this.getValue().then((value) => {
            this.value = value;
            this.device.notifyPropertyChanged(this)
        })
    }
    getValue() {
        return new Promise((resolve, reject) => {
            this.device.get('/state/brightness')
                .then((response) => {
                    this.device.notifyPropertyChanged(this);
                    resolve(response["value"])
                })
                .catch((err) => {
                    console.error(err)
                    reject(err)
                })
        })
    }
    setValue(value) {
        return new Promise((resolve, reject) => {
            this.device.put('/state', { "brightness": { "value": value } })
                .then(() => { resolve(value) })
                .catch((err) => {
                    console.error(err)
                    reject(err)
                })
        })
    }
}

class ColorProperty extends Property {
    constructor(dev, name) {
        const descr = { "@type": "ColorProperty", "type": "string", "label": name }
        super(dev, name, descr)

        this.value;
        this._updateMyValue()
        setInterval(() => {
            this._updateMyValue()
        }, 60 * 1000)
    }
    _updateMyValue() {
        this.getValue().then((value) => {
            this.value = value
            this.device.notifyPropertyChanged(this)
        })
    }
    getValue() {
        return new Promise((resolve, reject) => {
            let obs = new Subject();
            let color = {
                h: 0,
                s: 0,
                l: 0
            };
            this.device.get('/state/hue')
                .then((h) => {
                    color.h = h.value;
                    obs.next();
                })
                .catch(reject)
            this.device.get('/state/sat')
                .then((s) => {
                    color.s = s.value
                    obs.next();
                })
                .catch(reject)
            this.device.get('/state/brightness')
                .then((l) => {
                    color.l = l.value
                    obs.next();
                })
                .catch(reject)
            obs.pipe(skip(2))
                .subscribe(() => {
                    resolve("#" + convert.hsl.hex(color.h, color.s, color.l))
                })
        })
    }
    setValue(value) {
        return new Promise((resolve, reject) => {
            let obs = new Subject();
            if (!value) {
                reject("Can't set null")
                return
            }
            let hsl = convert.hex.hsl(value)
            console.log(hsl);
            this.device.put('/state', { "hue": { "value": hsl[0] } })
                .then(() => {
                    obs.next();
                })
                .catch((err) => { reject({src: "hue", err: err }) })
            this.device.put('/state', { "sat": { "value": hsl[1] } })
                .then(() => {
                    obs.next();
                })
                .catch((err) => { reject({src: "sat", err: err }) })
            this.device.put('/state', { "brightness": { "value": hsl[2] } })
                .then(() => {
                    obs.next();
                })
                .catch((err) => { reject({src: "brightness", err: err }) })
            obs.pipe(skip(2))
                .subscribe(() => {
                    resolve(value)
                })
        })
    }
}
class NanoleafDevice extends Device {
    constructor(adapter, service) {
        super(adapter, service.id)
        this.name = service.name;
        this.api = service.api;
        this['@type'] = ["Light", "OnOffSwitch"],

            this.apiVers = '/api/v1/';
        this.auth = service.auth;
        this.properties.set("On", new PowerProperty(this, "On"))
        this.properties.set("Brightness", new BrightnessProperty(this, "Brightness"))
        this.properties.set("Color", new ColorProperty(this, "Color"))
    }
    actionNotify(action) {
        console.log("Devices new action: ", action)
    }
    eventNotify(event) {
        console.log("Devices new event: ", event)
    }
    get(_path) {
        return new Promise((resolve, reject) => {
            let uri = this.api + this.apiVers + this.auth + _path;
            request.get(
                uri,
                {},
                (err, response, body) => {
                    if (err) {
                        reject({ err: err, responseCode: response.statusCode, req: { uri: uri } })
                        return
                    }
                    switch (response.statusCode) {
                        case 200:
                            resolve(JSON.parse(body))
                            return
                        default:
                            reject({ responseCode: response.statusCode, req: { uri: uri } })
                    }
                }
            )
        })
    }
    put(_path, body) {
        return new Promise((resolve, reject) => {
            let uri = this.api + this.apiVers + this.auth + _path;
            request({
                url: uri,
                method: 'PUT',
                json: body
            },
                (err, response, body) => {
                    if (err) {
                        reject({ err: err, responseCode: response.statusCode, req: { uri: uri, body: body } })
                        return
                    }
                    switch (response.statusCode) {
                        case 204:
                            resolve()
                            return
                        default:
                            reject({ responseCode: response.statusCode, req: { uri: uri, body: body } })
                    }
                })
        })
    }
}

module.exports = {
    NanoleafDevice,
    RegisterDevice
}
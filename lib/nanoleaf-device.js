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
    }
    notifyNewState(state) {
        if (state.on.value != this.value) {
            this.value = !!state.on.value
            this.device.notifyPropertyChanged(this)
        }
    }
    setValue(value) {
        return new Promise((resolve, reject) => {
            this.device.put('/state', { "on": { "value": value } })
                .then(() => {
                    this.value = !!value;
                    this.device.setState('on', this.value)
                    resolve(!!value)
                })
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
    }
    
    notifyNewState(lv) {
        if (lv.brightness.value != this.value) {
            this.value = lv.brightness.value
            this.device.notifyPropertyChanged(this)
        }
    }
    setValue(value) {
        return new Promise((resolve, reject) => {
            this.device.put('/state', { "brightness": { "value": value } })
                .then(() => {
                    this.value = value;
                    this.device.setState('brightness', this.value)
                    resolve(value)
                })
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
    }
    notifyNewState(lv) {
        let color = {
            h: lv.hue.value,
            s: lv.sat.value,
            l: lv.brightness.value
        };
        let newValue = "#" + convert.hsl.hex(color.h, color.s, color.l)
        if (newValue != this.value) {
            this.value = newValue
            this.device.notifyPropertyChanged(this)
        }
    }

    setValue(value) {
        return new Promise((resolve, reject) => {
            let obs = new Subject();
            if (!value) {
                reject("Can't set null")
                return
            }
            let hsl = convert.hex.hsl(value)
            this.device.put('/state', { "hue": { "value": hsl[0] } })
                .then(() => {
                    this.device.setState("hue", hsl[0]);
                    obs.next();
                })
                .catch((err) => { reject({ src: "hue", err: err }) })
            this.device.put('/state', { "sat": { "value": hsl[1] } })
                .then(() => {
                    this.device.setState("sat", hsl[1]);
                    obs.next();
                })
                .catch((err) => { reject({ src: "sat", err: err }) })
            this.device.put('/state', { "brightness": { "value": hsl[2] } })
                .then(() => {
                    this.device.setState("brightness", hsl[2]);
                    obs.next();
                })
                .catch((err) => { reject({ src: "brightness", err: err }) })
            obs.pipe(skip(2))
                .subscribe(() => {
                    this.value = value;
                    resolve(this.value)
                })
        })
    }
}

class NanoleafDevice extends Device {
    constructor(adapter, service) {
        super(adapter, service.id)
        this.name = service.name;
        this.api = service.api;
        this['@type'] = ["Light", "OnOffSwitch", "ColorControl"],
            this.apiVers = '/api/v1/';
        this.auth = service.auth;

        this.State = {};
        this.getQueue = new Queue(20);
        this._solveGet();
        this.putQueue = new Queue(10);
        this._solvePut();
        this._pullValues()
        this.properties.set("On", new PowerProperty(this, "On"))
        this.properties.set("Brightness", new BrightnessProperty(this, "Brightness"))
        this.properties.set("Color", new ColorProperty(this, "Color"))
        setInterval(this._pullValues.bind(this), 30*1000);
    }
    _valuesChanged(state){
        this.properties.forEach(prop => {
            prop.notifyNewState(state)
        });
    }
    setState(prop, value){
        this.State[prop].value = value;
        this._valuesChanged(this.State)
    }
    getState(){
        return this.State;
    }
    _pullValues() {
        return new Promise((resolve, reject) => {
            this.get('/')
                .then((val) => {
                    this.State = val["state"]
                    this._valuesChanged(this.State)
                    resolve(this.LightValues)
                })
                .catch(reject)
        })
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
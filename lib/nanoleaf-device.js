'use-strict'

const { Device, Property, Action } = require('gateway-addon');
const request = require('request');
const convert = require('color-convert');
const { Subject } = require('rxjs')
const { skip } = require('rxjs/operators')

class Queue {
    constructor(_timeout) {
        this.timeout = _timeout;
        this.queue = new Array();
    }
    _sleep(time) {
        return new Promise(resolve => setTimeout(resolve, time));
    }
    next() {
        return new Promise((resolve, reject) => {
            let wait_next = async () => {
                let next
                do {
                    await (this._sleep(this.timeout))
                    next = this.queue.pop()
                } while (!next)
                resolve(next)
            }
            wait_next();
        })
    }
    push(val) {
        this.queue.push(val)
    }
}
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
            this.maximum = lv.brightness.max;
            this.minimum = lv.brightness.min;
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

class BrightnessFadeAction extends Action {
    start() {
        return this.device.put("/state", {
            "brightness": {
                "value": this.input.level,
                "duration": this.input.duration
            }
        })
    }
}

class EffectProperty extends Property {
    constructor(dev, name) {
        const descr = { "type": "string", "label": name }
        super(dev, name, descr)
        this.enum = [];
    }
    notifyNewState(_) {
        let effects = this.device.getEffects()
        if (this.value != effects.select){
            this.value = effects.select;
            this.device.notifyPropertyChanged(this);
        }
        if (this.enum != effects.effectsList 
            && effects.effectsList.length > 0 
        ){
            this.enum = effects.effectsList;
            this.device.notifyPropertyChanged(this);
        }
    }
    setValue(value) {
        return new Promise((resolve, reject) => {
            this.device.put('/effects',{"select" : value})
                .then(() => {
                    this.value = value;
                    this.device.notifyPropertyChanged(this);
                    resolve(value)
                })
                .catch((err) => {
                    console.error(err)
                    reject(err)
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
        this.Effects = {};
        this.getQueue = new Queue(20);
        this._solveGet();
        this.putQueue = new Queue(10);
        this._solvePut();
        this._pullValues()
        this.properties.set("On", new PowerProperty(this, "On"))
        this.properties.set("Brightness", new BrightnessProperty(this, "Brightness"))
        this.properties.set("Color", new ColorProperty(this, "Color"))
        this.properties.set("Effect", new EffectProperty(this, "Effect"))
        this.actions.set("Brightness", {
            input: {
                "type": "object",
                "properties": {
                    level: {
                        "type": "number",
                        "unit": "percent",
                        "minimum": 0,
                        "maximum": 100
                    },
                    duration: {
                        "type": "number",
                        "unit": "second"
                    }
                }
            }
        })
        setInterval(this._pullValues.bind(this), 30 * 1000);
    }
    
    _valuesChanged(state) {
        this.properties.forEach(prop => {
            prop.notifyNewState(state)
        });
    }

    requestAction(actionId, actionName, input) {
        switch (actionName) {
            case "Brightness":
                return (new BrightnessFadeAction(actionId, this, actionName, input)).start()
        }
        return this.Effects;
    }
    getEffects() {
        return this.Effects;
    }
    getEffects() {
        return this.Effects;
    }
    setState(prop, value) {
        this.State[prop].value = value;
        this._valuesChanged(this.State)
    }
    getState() {
        return this.State;
    }
    _pullValues() {
        return new Promise((resolve, reject) => {
            this.get('/')
                .then((val) => {
                    this.State = val["state"]
                    this.Effects = val["effects"]
                    this._valuesChanged(this.State)
                    resolve(this.LightValues)
                })
                .catch(reject)
        })
    }

    get(_path) {
        return new Promise((resolve, reject) => {
            this.getQueue.push(
                (_continue) => {
                    let uri = this.api + this.apiVers + this.auth + _path;
                    request.get(
                        uri,
                        {},
                        (err, response, body) => {
                            if (err) {
                                reject({ err: err, req: { uri: uri } })
                            } else {
                                switch (response.statusCode) {
                                    case 200:
                                        resolve(JSON.parse(body))
                                        break;
                                    default:
                                        reject({ responseCode: response.statusCode, req: { uri: uri } })
                                }
                            }
                            _continue()
                        }
                    )
                }
            )
        })
    }
    _solveGet() {
        this.getQueue.next()
            .then((fn) => (fn(this._solveGet.bind(this))))
    }
    put(_path, body) {
        return new Promise((resolve, reject) => {
            this.putQueue.push((_continue) => {
                let uri = this.api + this.apiVers + this.auth + _path;
                request({
                    url: uri,
                    method: 'PUT',
                    json: body
                },
                    (err, response, body) => {
                        if (err) {
                            reject({ err: err, req: { uri: uri, body: body } })

                            return
                        } else {
                            switch (response.statusCode) {
                                case 204:
                                    resolve()
                                    break;
                                default:
                                    reject({ responseCode: response.statusCode, req: { uri: uri, body: body } })
                            }
                        }
                        _continue()
                    })
            })
        })
    }
    _solvePut() {
        this.putQueue.next()
            .then((fn) => (fn(this._solvePut.bind(this))))
    }
}

module.exports = {
    NanoleafDevice,
    RegisterDevice
}
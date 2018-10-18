'use-strict'

const { Device } = require('gateway-addon');
const request = require('request');

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
                default:
                    reject(response.statusCode)
            }
        })
    })
};
class NanoleafDevice extends Device {
    constructor(adapter, service) {
        super(adapter, service.id)
        this.name = service.name;
    }

    actionNotify(action) {
        console.log("Devices new action: ", action)
    }
    eventNotify(event) {
        console.log("Devices new event: ", event)
    }
}

module.exports = {
    NanoleafDevice,
    RegisterDevice
}
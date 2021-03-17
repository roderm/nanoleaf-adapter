'use-strict'

const { Database } = require('gateway-addon');

class NanoleafDatabase extends Database {
	
	getConfig() {
		return new Promise((resolve, reject) => {
			this.open().then(() => {
				resolve(this.loadConfg());
			}).catch(reject);
		});
	}

    getDevices() {
        return new Promise((resolve, reject) => {
            this.open().then(() => {
                if (!this.conn) {
                    reject('Database not open');
                    return;
                }
                const key = `addons.${this.packageName}.nanoLeafDeviceSetup`;
                this.conn.get(
                    'SELECT value FROM settings WHERE key = ?',
                    [key],
                    (error, row) => {
                        if (error) {
                            reject(error);
                        } else if (!row) {
                            resolve([]);
                        } else {
                            const data = JSON.parse(row.value);
                            resolve(data);
                        }
                    }
                );
            })
        })
    }

    insertDevice(Config) {
        return new Promise((resolve, reject) => {
            this.open().then(() => {
                if (!this.conn) {
                    reject('Database not open');
                    return;
                }
                const insert = (devs) => {
                    devs.push(Config);
                    this._update(devs)
                        .then(resolve)
                        .catch(reject)
                }
                this.getDevices()
                    .then(insert)
                    .catch(() => {insert({})})
            }).catch(reject)
        });
    }

    removeDevice(devID){
        return new Promise((resolve, reject) => {
            this.getDevices().then((devs) => {
                for(let i of devs){
                    if(devs[i].id == devID){
                        devs.splice(i, 1);
                    }
                }
                this._update(devs)
                    .then(resolve)
                    .catch(reject)
            }).catch(reject)
        })
    }

    _update(dev_config){
        return new Promise((resolve, reject) => {
            const key = `addons.${this.packageName}.nanoLeafDeviceSetup`;
                    this.conn.run(
                        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
                        [key, JSON.stringify(dev_config)],
                        (error) => {
                            if (error) {
                                reject(error);
                            } else {
                                resolve();
                            }
                        }
                    );
        })
    }
}

module.exports = {
    NanoleafDatabase
}
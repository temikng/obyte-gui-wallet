class CloudStorages extends EventEmitter {
  constructor (options) {
    super();
    this.log = options.log || function () {};
    this._storagesSet = {};
    this._arrKeys = [];
    this._authorizationWindow = null;
    this._initPromise = null;
    this._options = options;
    this._isCordova = options.isCordova;
    this._handleSaveData = options.handleSaveData;
    this.isInited = false;
  }

  getSet() {
    return this._storagesSet;
  }

  get(key) {
    return this._storagesSet[key];
  }

  getKeys() {
    return this._arrKeys;
  }

  add(cloudStorage) {
    const key = cloudStorage.getKey();
    if (this._arrKeys.indexOf(key) >= 0) {
      throw new Error(`CloudStorage with key "${key}" already added`);
    }
    this._arrKeys.push(key);
    this._storagesSet[key] = cloudStorage;
    cloudStorage.on('event:close_window', () => {
      this.closeAllAuthorizationWindows();
    });
  }
  
  _startServer() {
    const http = require('http');
    const url = require('url');
    this._server = http.createServer((req, res) => {
      if (!req.url.startsWith('/auth/')) {
        return res.end();
      }
      const parsedUrl = url.parse(req.url, true);
      console.log('server req', req.url, parsedUrl);
      const pathname = parsedUrl.pathname;
      const splitedPathname = pathname.split('/');

      var type = splitedPathname[splitedPathname.length - 1];
      console.log('CloudStorages handle auth req start', type);
      var cloudStorage = this.get(type);
      if (!cloudStorage) {
        res.write('Unknown storage type! Please contact support');
        res.end();
      }
      Promise.resolve(cloudStorage.handleServerAuthReq(parsedUrl))
        .then(() => {
          res.write(`<html><body><script>window.close();</script><h1>Authorization with "${cloudStorage.getTitle()}" ended. Please, close the window</h1></body></html>`);
          res.end();
          console.log('CloudStorages handle auth req end', type)
        });
    }).listen(3000);
  }

  _setInited() {
    this.isInited = true;
    this.emit(CloudStorageEvents.Inited);
  }
  
  init() {
    if (this._initPromise) {
      return this._initPromise;
    }
    if (!this._isCordova) {
      this._startServer();
    }

    return this._initPromise = this.getKeys().reduce((previousPromise, key) => {
      return previousPromise.then(() => {
        const cloudStorage = this.get(key);
        cloudStorage.on(CloudStorageEvents.DataChanged, this.saveData.bind(this));
        return cloudStorage.init(this._options);
      });
    }, Promise.resolve())
      .then(() => {
        this._setInited();
      });
  }

  saveData() {
    if (this._handleSaveData) {
      let data = {};
      this._arrKeys.forEach((key) => {
        data[key] = this._storagesSet[key].getDataToSave();
      });
      console.log('CloudStorages saveData', data);
      this._handleSaveData(data);
    }
  }

  closeAllAuthorizationWindows() {
    console.log('CloudStorages closeAllAuthorizationWindows', this._storagesSet);
    this.getKeys().forEach((key) => {
      this.get(key).closeAuthorizationWindow();
    });
  }

  closeWindows() {
    this.closeAllAuthorizationWindows();
  }
}

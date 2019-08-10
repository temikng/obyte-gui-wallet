class RestoreWalletCloudCordova extends AbstractRestoreWallet {
  constructor (options, services) {
    super(options, services);
    this.zipModule = new require('jszip')();
  }

  loadFile(cb) {
    console.log('RestoreWalletCloudCordova loadFile', this._file);

    new Promise((resolve, reject) => {
      let blob = this._file.fileBlob;
          blob.name = this._file.name;
      const reader = new FileReader();
      reader.onerror = (event) => {
        reader.abort();
        console.log('RestoreWalletCloudCordova loadFile onerror', event);
        reject(event);
      };
      // This fires after the blob has been read/loaded.
      reader.onloadend = (e) => {
        const fileBuffer = Buffer.from(new Uint8Array(e.srcElement.result));
        console.log('RestoreWalletCloudCordova loadFile onloadend', e);
        resolve(fileBuffer);
      };
      reader.readAsArrayBuffer(blob);
    })
      .then((fileBuffer) => this.zipModule.loadAsync(this._decrypt(fileBuffer, this._password)))
      .then((zip) => {
        console.log('RestoreWalletCloudCordova loadFile zip', zip);
        if (!zip.file('light')) {
          throw Error('Mobile version supports only light wallets.');
        }
        this.zip = zip;
        cb();
      })
      .catch(cb);
  }

  restoreFileData(cb) {
    const zip = this.zip;
    const async = require('async');
    const fileSystemService = this._services.fileSystem;
    const storageService = this._services.storage;
    const dbDirPath = fileSystemService.getDatabaseDirPath() + '/';
    console.log('RestoreWalletCloudCordova restoreFileData', dbDirPath);

    async.forEachOfSeries(zip.files, (objFile, key, callback) => {
      if (key == 'profile') {
        zip.file(key).async('string').then((data) => {
          storageService.storeProfile(Profile.fromString(data), callback);
          storageService.storeProfile = () => {};
        });
      }
      else if (key == 'config') {
        zip.file(key).async('string').then((data) => {
          storageService.storeConfig(data, callback);
          storageService.storeConfig = () => {};
        });
      }
      else if (/\.sqlite/.test(key)) {
        zip.file(key).async('nodebuffer').then((data) => {
          fileSystemService.cordovaWriteFile(dbDirPath, null, key, data, callback);
        });
      }
      else {
        callback();
      }
    }, (err) => {
      if (err) return cb(err);
      return cb();
    });
  }

  _decrypt(buffer, password) {
    password = Buffer.from(password);
    const decipher = this._getDecipher();
    const CHUNK_LENGTH = 2003;
    let arrChunks = [];
    for (let offset = 0; offset < buffer.length; offset += CHUNK_LENGTH) {
      arrChunks.push(decipher.update(buffer.slice(offset, Math.min(offset + CHUNK_LENGTH, buffer.length)), 'utf8'));
    }
    arrChunks.push(decipher.final());
    return Buffer.concat(arrChunks);
  }
}

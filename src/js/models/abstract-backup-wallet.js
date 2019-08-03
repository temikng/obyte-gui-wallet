class AbstractBackupWallet {
  constructor (options, services) {
    this._services = services;
    this._filename = options.filename;
    this._bCompression = options.bCompression;
    this._bLight = options.bLight;
    this._keyHash = options.keyHash;
    this.fileData = {
      files: {},
    };
  }

  createFileData(cb) {
    this._services.storage.getProfile((err, profile) => {
      if (err) {
        return cb(err);
      }
      this._services.storage.getConfig((err, config) => {
        if (err) {
          return cb(err);
        }
        this.fileData.profile = JSON.stringify(profile);
        this.fileData.config = config;
        this._getDBAndConfFilesData(cb);
      });
    });
  }

  getSpecifyFileData(pathToFile, cb) {
    cb('not implemented');
  }

  saveFile(cb) {
    cb('not implemented');
  }

  _getCipher() {
    return this._services.crypto.createCipher(
      'aes-256-ctr',
      this._keyHash
    );
  }

  _getDBAndConfFilesData(cb) {
    var dbDirPath = this._services.fileSystem.getDatabaseDirPath() + '/';
    this._services.fileSystem.readdir(dbDirPath, (err, listFilenames) => {
      if (err) return cb(err);
      listFilenames = listFilenames.filter((name) => {
        return (name == 'conf.json' || /\.sqlite/.test(name));
      });
      require('async').forEachSeries(listFilenames, (filename, callback) => {
        this.getSpecifyFileData(dbDirPath + '/' + filename, (err, path) => {
          if (err) return callback(err);
          this.fileData.files[filename] = path;
          callback();
        });
      }, cb);
    });
  }
}

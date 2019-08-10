class RestoreWalletPC extends AbstractRestoreWallet {
  constructor (options, services) {
    super(options, services);
  }

  loadFile(cb) {
    var fs = require('fs');
    var path = require('path');
    var pathToFile = path.resolve(this._file.path);
    var data = fs.createReadStream(pathToFile);

    var unzip = require('unzip');
    data.pipe(this._getDecipher())
      .pipe(
        unzip.Extract({ path: this._services.fileSystem.getDatabaseDirPath() + '/temp/' })
      )
      .on('error', (err) => {
        if (err.message === "Invalid signature in zip file") {
          cb('Incorrect password or file');
        } else {
          cb(err);
        }
      })
      .on('finish', () => {
        setTimeout(cb, 100);
      });
  }
  restoreFileData(cb) {
    var async = require('async');
    var conf = require('ocore/conf');
    var fileSystemService = this._services.fileSystem;
    var storageService = this._services.storage;
    var dbDirPath = fileSystemService.getDatabaseDirPath() + '/';
    var tempDirPath = dbDirPath + 'temp/';
    async.series([
      (callback) => {
        fileSystemService.readFile(tempDirPath + 'profile', (err, data) => {
          if(err) return callback(err);
          storageService.storeProfile(Profile.fromString(data.toString()), callback)
          storageService.storeProfile = () => {};
        });
      },
      (callback) => {
        fileSystemService.readFile(tempDirPath + 'config', (err, data) => {
          if(err) return callback(err);
          storageService.storeConfig(data.toString(), callback);
          storageService.storeConfig = () => {};
        });
      },
      (callback) => {
        fileSystemService.readdir(tempDirPath, (err, fileNames) => {
          if(err) return callback(err);
          fileNames = fileNames.filter((name) => /\.sqlite/.test(name));
          async.forEach(fileNames, (name, callback2) => {
            fileSystemService.nwMoveFile(tempDirPath + name, dbDirPath + name, callback2);
          }, (err) => {
            if(err) return callback(err);
            callback();
          })
        });
      },
      (callback) => {
        var existsConfJson = fileSystemService.nwExistsSync(tempDirPath + 'conf.json');
        var existsLight = fileSystemService.nwExistsSync(tempDirPath + 'light');
        if (existsConfJson) {
          fileSystemService.nwMoveFile(tempDirPath + 'conf.json', dbDirPath + 'conf.json', callback);
        } else if(existsLight && !existsConfJson) {
          fileSystemService.nwWriteFile(dbDirPath + 'conf.json', JSON.stringify({bLight: true}, null, '\t'), callback);
        } else if(!existsLight && conf.bLight) {
          var _conf = require(dbDirPath + 'conf.json');
          _conf.bLight = false;
          fileSystemService.nwWriteFile(dbDirPath + 'conf.json', JSON.stringify(_conf, null, '\t'), callback);
        } else {
          callback();
        }
      },
      (callback) => {
        fileSystemService.readdir(tempDirPath, (err, fileNames) => {
          if(err) return callback(err);
          async.forEach(fileNames, (name, callback2) => {
            fileSystemService.nwUnlink(tempDirPath + name, callback2);
          }, (err) => {
            if(err) return callback(err);
            fileSystemService.nwRmDir(tempDirPath, () => {
              callback();
            });
          })
        });
      }
    ], (err) => {
      cb(err);
    });
  }
}

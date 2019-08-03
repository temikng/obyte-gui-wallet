class ContinuousBackupWalletController {
  constructor (options) {
    this._crypto = options.crypto;
    this._backup = {
      keyHash: null,
    };
  }

  setBackupPrivateKey(key) {
    this._createBackupKeyHash(key);
  };
  getCachedBackupKeyHash() {
    return this._backup.keyHash;
  }

  doBackup(backupWallet, cb) {
    if (!cb) {
      cb = () => {};
    }

    var db = require('ocore/db');
    db.takeConnectionFromPool((dbConnection) => {
      backupWallet.createFileData((err) => {
        if (err) {
          dbConnection.release();
          return cb(err);
        }
        dbConnection.release();
        backupWallet.saveFile(cb);
      });
    });
  }

  doRestore(restoreWallet, cb) {
    if (!cb) {
      cb = () => {};
    }

    restoreWallet.loadFile((err) => {
      if (err) {
        return cb(err);
      }

      var db = require('ocore/db');
      db.close(() => {
        restoreWallet.restoreFileData(cb);
      });
    });
  }

  _createBackupKeyHash(key) {
    this._backup.keyHash = this._crypto
      .createHash('sha256')
      .update(key, 'utf8')
      .digest();
  }
}

class AbstractRestoreWallet {
  constructor (options, services) {
    this._services = services;
    this._file = options.file;
    this._password = options.password;
  }

  loadFile(cb) {
    cb('not implemented');
  }

  restoreFileData(cb) {
    cb('not implemented');
  }

  _getDecipher() {
    return this._services.crypto.createDecipher(
      'aes-256-ctr',
      this._services.crypto
        .createHash("sha256")
        .update(this._password, "utf8")
        .digest()
    );
  }
}

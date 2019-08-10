class BackupWalletPC extends AbstractBackupWallet {
  constructor (options, services) {
    super(options, services);
  }

  getSpecifyFileData(pathToFile, cb) {
    this._services.fileSystem.getPath(pathToFile, cb);
  }
  
  saveFile(cb) {
    var path = require('path');
    var pathToFile = path.resolve(this._filename);
    var zipOptions = {
      compressed: this._bCompression ? 6 : 0
    };
    zipOptions.cipher = this._getCipher();
    console.log('BackupWalletPC saveFile', pathToFile, zipOptions);
    var zip = new require('zip')(pathToFile, zipOptions);
    zip.text('profile', this.fileData.profile);
    zip.text('config', this.fileData.config);
    if (this._bLight) zip.text('light', 'true');
    var filesData = this.fileData.files;
    for (var key in filesData) {
      zip.file(key, filesData[key]);
    }
    zip.end(cb);
  }
}

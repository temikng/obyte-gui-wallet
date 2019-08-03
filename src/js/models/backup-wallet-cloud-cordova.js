class BackupWalletCordova extends AbstractBackupWallet {
  constructor (options, services) {
    super(options, services);
  }

  getSpecifyFileData(pathToFile, cb) {
    this._services.fileSystem.readFile(pathToFile, cb);
  };

  saveFile(cb) {
    var zip = new require("jszip")();
    zip.file('profile', this.fileData.profile);
    zip.file('config', this.fileData.config);
    zip.file('light', 'true');
    var filesData = this.fileData.files;
    for (var key in filesData) {
      zip.file(key, filesData[key]);
    }

    var zipParams = {type: "nodebuffer", compression: 'DEFLATE', compressionOptions: {level: 9}};
    zip.generateAsync(zipParams)
      .then(
        (zipFile) => {
          var file = this._encrypt(zipFile);
          var pathToFile = this._filename;
          this._services.fileSystem.cordovaWriteFile(
            (this._services.isMobile.iOS() ? window.cordova.file.cacheDirectory : window.cordova.file.externalRootDirectory),
            'Obyte', pathToFile, file, cb
          );
        },
        (err) => {
          cb(err);
        }
      );
  }

  _encrypt(buffer) {
    var cipher = this._getCipher();
    var arrChunks = [];
    var CHUNK_LENGTH = 2003;
    for (var offset = 0, buffLen = buffer.length; offset < buffLen; offset += CHUNK_LENGTH) {
      arrChunks.push(
        cipher.update(
          buffer.slice(offset, Math.min(offset + CHUNK_LENGTH, buffLen)),
          'utf8'
        )
      );
    }
    arrChunks.push(cipher.final());
    return Buffer.concat(arrChunks);
  }
}

'use strict';
angular.module('copayApp.services')
	.factory('continuousBackupService', ContinuousBackupServiceFactory);
	
function ContinuousBackupServiceFactory(
	configService,
	storageService, fileSystemService,
	isCordova, isMobile,
	lodash, cloudsStoragesService
) {
	var path = require('path');
	var crypto = require('crypto');
	var Mnemonic = require('bitcore-mnemonic');
	var conf = require('ocore/conf');
	var eventBus = require('ocore/event_bus.js');
	var device = require('ocore/device.js');
	var config = configService.getSync();
	var backupCong = config.continuousBackup;
	var continuousBackupWalletCtrl = new ContinuousBackupWalletController({
		crypto: crypto
	});
	var root = {};

	eventBus.on('backup_needed', function (sLog) {
		root.doBackupInBackground(sLog);
	});

	root.getUniqueFilename = function () {
		return 'ObyteBackup-' + device.getMyDeviceAddress() + '.encrypted';
	};
	
	root.setBackupPrivateKey = function (key) {
		console.log('ContinuousBackupServiceFactory setBackupPrivateKey', key);
		continuousBackupWalletCtrl.setBackupPrivateKey(key);
	}

	root.doRestoreByMnemonic = function (sMnemonic, filename, cb) {
		sMnemonic = sMnemonic.toLowerCase();
		if ((sMnemonic.split(' ').length % 3 === 0) && Mnemonic.isValid(sMnemonic)) {
			var xPrivKey = new Mnemonic(sMnemonic).toHDPrivateKey();
			this.doRestore(xPrivKey.xprivkey, filename, cb);
		} else {
			return cb('Seed is not valid');
		}
	}

	root.doRestore = function (password, filename, cb) {
		if (!cb) {
			cb = function () {};
		}

		var sLogLabel = 'ContinuousBackupServiceFactory doRestore: ' + filename + '_' + password + '_' + Date.now();;
		console.log(sLogLabel, 'start');
		console.time(sLogLabel);
		var restoreWallet;
		var restoreWalletOptions = {
			filename: filename,
			password: password,
		};
		var restoreWalletServices = {
			storage: storageService,
			fileSystem: fileSystemService,
			isMobile: isMobile,
			crypto: crypto
		}
		if (isCordova) {
			restoreWallet = new RestoreWalletCloudCordova(restoreWalletOptions, restoreWalletServices);
		} else {
			restoreWallet = new RestoreWalletCloudPC(restoreWalletOptions, restoreWalletServices);
		}
		continuousBackupWalletCtrl.doRestore(restoreWallet, function (err) {
			console.timeEnd(sLogLabel);
			if (err) {
				console.error(err);
			}
			
			cb(err);
		});
	}

	root.doFileRestore = function (password, file, cb) {
		if (!cb) {
			cb = function () {};
		}

		var sLogLabel = 'ContinuousBackupServiceFactory doRestore: ' + file.name + '_' + password + '_' + Date.now();;
		console.log(sLogLabel, 'start');
		console.time(sLogLabel);
		var restoreWallet;
		var restoreWalletOptions = {
			file: file,
			password: password,
		};
		var restoreWalletServices = {
			storage: storageService,
			fileSystem: fileSystemService,
			isMobile: isMobile,
			crypto: crypto
		}
		if (isCordova) {
			restoreWallet = new RestoreWalletCordova(restoreWalletOptions, restoreWalletServices);
		} else {
			restoreWallet = new RestoreWalletPC(restoreWalletOptions, restoreWalletServices);
		}
		continuousBackupWalletCtrl.doRestore(restoreWallet, function (err) {
			console.timeEnd(sLogLabel);
			if (err) {
				console.error(err);
			}
			
			cb(err);
		});
	}

	root.doBackupInBackground = lodash.throttle(function (sLog) {
		config = configService.getSync();
		backupCong = config.continuousBackup;
		console.log('ContinuousBackupServiceFactory doBackupInBackground', backupCong);

		if (!backupCong.type) {
			return;
		}
		// if (backupCong.type === 'storage') {
		// 	root.doBackup(sLog);
		// } else {
			root.doCloudBackup(sLog);
		// }
		
	}, 2000);

	root.doBackup = function (sLog, cb) {
		if (!backupCong.dirPath) {
			return;
		}
		if (typeof sLog === 'function') {
			cb = sLog;
			sLog = null;
		}
		if (!cb) {
			cb = function () {};
		}

		sLog = (sLog || 'backup') + '_' + Date.now();
		var sLogLabel = 'ContinuousBackupServiceFactory _doBackup: ' + sLog;
		console.log(sLogLabel, 'start');
		console.time(sLogLabel);

		var backupWallet;
		var backupWalletOptions = {
			filename: path.join(backupCong.dirPath, root.getUniqueFilename()),
			keyHash: continuousBackupWalletCtrl.getCachedBackupKeyHash(),
			bCompression: false,
			bLight: conf.bLight,
		};
		var backupWalletServices = {
			storage: storageService,
			fileSystem: fileSystemService,
			isMobile: isMobile,
			crypto: crypto
		}
		if (isCordova) {
			backupWallet = new BackupWalletCloudCordova(backupWalletOptions, backupWalletServices);
		} else {
			backupWallet = new BackupWalletCloudPC(backupWalletOptions, backupWalletServices);
		}
		continuousBackupWalletCtrl.doBackup(backupWallet, function (err) {
			console.timeEnd(sLogLabel);
			if (err) {
				console.error(err);
			}
			
			cb(err);
		});
	};

	root.doCloudBackup = function (sLog, cb) {
		if (typeof sLog === 'function') {
			cb = sLog;
			sLog = null;
		}
		if (!cb) {
			cb = function () {};
		}

		sLog = (sLog || 'backup') + '_' + Date.now();
		var sLogLabel = 'ContinuousBackupServiceFactory doCloudBackup: ' + sLog;
		console.log(sLogLabel, 'start');
		console.time(sLogLabel);

		var cloudStorage = cloudsStoragesService.get(backupCong.type)
		var backupWalletOptions = {
			// filename: path.join(backupCong.dirPath, root.getUniqueFilename()),
			filename: root.getUniqueFilename(),
			keyHash: continuousBackupWalletCtrl.getCachedBackupKeyHash(),
			bCompression: false,
			bLight: conf.bLight,
		};
		var backupWalletServices = {
			storage: storageService,
			fileSystem: fileSystemService,
			isMobile: isMobile,
			crypto: crypto,
			cloudStorage: cloudStorage
		};
		var backupWallet = new BackupWalletCloudPC(backupWalletOptions, backupWalletServices);
	
		continuousBackupWalletCtrl.doBackup(backupWallet, function (err) {
			console.timeEnd(sLogLabel);
			if (err) {
				console.error(err);
			}
			
			cb(err);
		});
	};

	return root;
}

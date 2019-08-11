'use strict';
angular.module('copayApp.services')
	.factory('continuousBackupService', ContinuousBackupServiceFactory);
	
function ContinuousBackupServiceFactory(
	configService,
	storageService, fileSystemService,
	isCordova, isMobile,
	lodash, cloudsStoragesService
) {
	var crypto = require('crypto');
	var eventBus = require('ocore/event_bus.js');
	var continuousBackupWalletCtrl = new ContinuousBackupWalletController({
		crypto: crypto
	});
	var root = {};
	var backupCong = {};

	eventBus.on('backup_needed', function (sLog) {
		root.doBackupInBackground(sLog);
	});

	root.getUniqueFilename = function () {
		var device = require('ocore/device.js');
		return 'ObyteBackup-' + device.getMyDeviceAddress() + '.encrypted';
	};
	
	root.setBackupPrivateKey = function (key) {
		console.log('ContinuousBackupServiceFactory setBackupPrivateKey', key);
		continuousBackupWalletCtrl.setBackupPrivateKey(key);
	}

	root.doLocalRestore = function (password, file, cb) {
		if (!cb) {
			cb = function () {};
		}

		var sLogLabel = 'ContinuousBackupServiceFactory doLocalRestore: ' + file.name + '_' + password + '_' + Date.now();;
		console.log(sLogLabel, 'start');
		console.time(sLogLabel);
		var restoreWalletOptions = {
			file: file,
			password: password,
		};
		var restoreWalletServices = {
			storage: storageService,
			fileSystem: fileSystemService,
			isMobile: isMobile,
			crypto: crypto
		};
		var restoreWallet = new RestoreWalletPC(restoreWalletOptions, restoreWalletServices);
		continuousBackupWalletCtrl.doRestore(restoreWallet, function (err) {
			console.timeEnd(sLogLabel);
			if (err) {
				console.error(err);
			}
			
			cb(err);
		});
	}

	root.doCloudRestore = function (password, file, cb) {
		if (!cb) {
			cb = function () {};
		}

		var sLogLabel = 'ContinuousBackupServiceFactory doCloudRestore: ' + file.name + '_' + password + '_' + Date.now();;
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
		};
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

	root.doBackupInBackground = lodash.throttle(function (sLog, cb) {
		root.doBackup(sLog, cb);
	}, 2000);

	root.doBackup = function (sLog, cb) {
		var config = configService.getSync();
		backupCong = config.continuousBackup;

		if (typeof sLog === 'function') {
			cb = sLog;
			sLog = null;
		}
		if (!cb) {
			cb = function () {};
		}

		console.log('ContinuousBackupServiceFactory doBackup: ', JSON.stringify(backupCong));
		if (!backupCong.type) {
			return cb();
		}

		sLog = (sLog || 'backup') + '_' + Date.now();
		var sLogLabel = 'ContinuousBackupServiceFactory doBackup: ' + sLog;
		console.log(sLogLabel, 'start');
		console.time(sLogLabel);

		if (backupCong.type === 'local') {
			root._doLocalBackup(handleCallback);
		} else {
			root._doCloudBackup(handleCallback);
		}

		function handleCallback(err) {
			console.timeEnd(sLogLabel);
			if (err) {
				console.error(err);
			}
			
			cb(err);
		}
	}

	root._doLocalBackup = function (cb) {
		if (isCordova || !backupCong.localPath) {
			backupCong.type = null;
			return cb('Wrong local continuous backup config');
		}

		var path = require('path');
		var conf = require('ocore/conf');
		var backupWalletOptions = {
			filename: path.join(backupCong.localPath, root.getUniqueFilename()),
			keyHash: continuousBackupWalletCtrl.getCachedBackupKeyHash(),
			bCompression: true,
			bLight: conf.bLight,
		};
		var backupWalletServices = {
			storage: storageService,
			fileSystem: fileSystemService,
			isMobile: isMobile,
			crypto: crypto
		}
		var backupWallet = new BackupWalletPC(backupWalletOptions, backupWalletServices);

		continuousBackupWalletCtrl.doBackup(backupWallet, cb);
	};

	root._doCloudBackup = function (cb) {
		var cloudStorage = cloudsStoragesService.get(backupCong.type);
		if (!cloudStorage) {
			backupCong.type = null;
			return cb('Wrong cloud continuous backup config');
		}
		if (!cloudStorage.isInited) {
			return cb(`CloudStorage ${backupCong.type} does not inited yet`);
		}

		var conf = require('ocore/conf');
		var backupWallet;
		var backupWalletOptions = {
			// filename: path.join(backupCong.localPath, root.getUniqueFilename()),
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
		if (isCordova) {
			backupWallet = new BackupWalletCloudCordova(backupWalletOptions, backupWalletServices);
		} else {
			backupWallet = new BackupWalletCloudPC(backupWalletOptions, backupWalletServices);
		}
	
		console.log('ContinuousBackupServiceFactory _doCloudBackup: ', backupWallet.constructor);
		continuousBackupWalletCtrl.doBackup(backupWallet, cb);
	};

	return root;
}

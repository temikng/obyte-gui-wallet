'use strict';

angular.module('copayApp.controllers')
	.controller('continuousBackupCtrl', ContinuousBackupCtrl);

function ContinuousBackupCtrl(
	$rootScope, $scope, $timeout, configService,
	isCordova,
	cloudsStoragesService
) {
	const config = configService.getSync();

	$scope.error = null;
	$scope.exporting = false;
	$scope.turnOnBackup = config.continuousBackup.backgroundTurnedOn;
	$scope.dirPath = config.continuousBackup.data;
	$scope.isCordova = isCordova;

	$scope.activeCloudStorageKey = config.continuousBackup.type;
	$scope.cloudStorages = cloudsStoragesService.getSet();
	console.log('ContinuousBackupCtrl init');

	for (const key in $scope.cloudStorages) {
		const cloudStorage = $scope.cloudStorages[key];
		cloudStorage.on(CloudStorageEvents.ChangedAuthStatus, handleCloudStorageChangedAuthStatus);
		cloudStorage.on(CloudStorageEvents.Inited, function () {
			$scope.$apply();
		});
	}

	$scope.$on('$destroy', function () {
		for (const key in $scope.cloudStorages) {
			const cloudStorage = $scope.cloudStorages[key];
			cloudStorage.removeListener(CloudStorageEvents.ChangedAuthStatus, handleCloudStorageChangedAuthStatus);
		}
	});

	function handleCloudStorageChangedAuthStatus() {
		console.log('ContinuousBackupCtrl handleCloudStorageChangedAuthStatus');
		$scope.$apply();
		saveConfig();
	}

	$scope.checkCloudStorageActive = function (key) {
		return $scope.activeCloudStorageKey === key;
	}

	$scope.setActiveCloudStorage = function (key) {
		if ($scope.activeCloudStorageKey === key) {
			return;
		}
		console.log('ContinuousBackupCtrl onChange activeCloudStorageKey', key);
		if (key === null) {
			$scope.activeCloudStorageKey = key;
			saveConfig();
			return;
		}

		const cloudStorage = $scope.cloudStorages[key];
		if (cloudStorage.isAuthenticated()) {
			$scope.activeCloudStorageKey = key;
			saveConfig();
			return;
		}
		return cloudStorage.authorizationAccount()
			.then(function (bIsAuthenticated) {
				console.log('ContinuousBackupCtrl onChange authorizationAccount', key, bIsAuthenticated);
				if (bIsAuthenticated) {
					$scope.activeCloudStorageKey = key;
				} else {
					$scope.activeCloudStorageKey = null;
				}
			})
			.catch(function (err) {
				console.error(err);
				$scope.activeCloudStorageKey = null;
			})
			.then(function () {
				handleCloudStorageChangedAuthStatus();
			});
	};

	$scope.checkCloudStorageLogedIn = function (key) {
		const cloudStorage = $scope.cloudStorages[key];
		return cloudStorage.isAuthenticated() && cloudStorage.isInited;
	}

	$scope.logoutCloudStorage = function (key) {
		console.log('ContinuousBackupCtrl logoutCloudStorage', key);
		const cloudStorage = $scope.cloudStorages[key];
		cloudStorage.clearAuthData();
		if ($scope.activeCloudStorageKey === key) {
			$scope.activeCloudStorageKey = null;
			saveConfig();
		}
	}

	$scope.$watch('$viewContentLoaded', function () {
		console.log('ContinuousBackupCtrl viewContentLoaded');
		var elDirSelector = document.querySelector('#dirSelector');
		var elDirOutput = document.querySelector('#dirOutput');
		if (!elDirSelector) {
			return;
		}

		elDirSelector.addEventListener('change', function (event) {
			var dir = (event.srcElement || event.target).files[0];
			console.log('ContinuousBackupCtrl getFile', dir, event);
			if (!dir) {
				return;
			}
			elDirOutput.innerHTML = $scope.dirPath = dir.path;

			saveConfig();
			$timeout(function () {
				$rootScope.$apply();
			});
		});

		elDirOutput.innerHTML = $scope.dirPath || '';
		console.log('ContinuousBackupCtrl dirChanged', elDirSelector);
	});
	
	$scope.isBackupDisabled = function () {
		return $scope.exporting || !$scope.dirPath;
	};

	$scope.isTurnOnBackupBtnDisabled = function () {
		return !$scope.dirPath || $scope.exporting;
	};

	$scope.cordovaChooseFolder = function () {}

	$scope.walletExport = function () {
		if ($scope.isBackupDisabled()) {
			return;
		}

		$scope.error = '';
		$scope.exporting = true;

		// continuousBackupService.doBackup('export-now', function (err) {
		// 	$scope.exporting = false;
		// 	if (err) {
		// 		$scope.error = err;
		// 		return;
		// 	}

		// 	$timeout(function () {
		// 		$rootScope.$apply();
		// 		notification.success(
		// 			gettextCatalog.getString('Success'),
		// 			gettextCatalog.getString('Export completed successfully', {})
		// 		);
		// 	});
		// });
	}

	function saveConfig(cb) {
		if (!cb) {
			cb = function () {};
		}
		var opts = {
			continuousBackup: {
				backgroundTurnedOn: $scope.turnOnBackup,
				type: $scope.activeCloudStorageKey,
			},
		}

		console.log('ContinuousBackupCtrl saveConfig', opts);
		configService.set(opts, function (err) {
			if (err) {
				console.error(err);
				$scope.$emit('Local/DeviceError', err);
				return cb(err);
			}

			cb();
		});
	}
}

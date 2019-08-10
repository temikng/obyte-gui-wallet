'use strict';

angular.module('copayApp.controllers')
	.controller('continuousBackupCtrl', ContinuousBackupCtrl);

function ContinuousBackupCtrl(
	$rootScope, $scope, $timeout, configService,
	isCordova, gettextCatalog, notification,
	cloudsStoragesService, continuousBackupService
) {
	const config = configService.getSync();
	var elDirSelector;

	$scope.error = null;
	$scope.exporting = false;
	$scope.isCordova = isCordova;

	$scope.localPath = config.continuousBackup.localPath;
	$scope.activeStorageKey = config.continuousBackup.type;
	$scope.cloudStorages = cloudsStoragesService.getSet();
	console.log('ContinuousBackupCtrl init');

	for (const key in $scope.cloudStorages) {
		const cloudStorage = $scope.cloudStorages[key];
		cloudStorage.on(CloudStorageEvents.ChangedAuthStatus, handleCloudStorageChangedAuthStatus);
		cloudStorage.once(CloudStorageEvents.Inited, handleUpdateScope);
	}

	$scope.$on('$destroy', function () {
		for (const key in $scope.cloudStorages) {
			const cloudStorage = $scope.cloudStorages[key];
			cloudStorage.removeListener(CloudStorageEvents.ChangedAuthStatus, handleCloudStorageChangedAuthStatus);
			cloudStorage.removeListener(CloudStorageEvents.Inited, handleUpdateScope);
		}
	});

	function handleUpdateScope() {
    console.log('RecoveryCloudFileChooserCtrl handleUpdateScope');
		$scope.$apply();
	}

	function handleCloudStorageChangedAuthStatus() {
		handleUpdateScope();
		console.log('ContinuousBackupCtrl handleCloudStorageChangedAuthStatus', $scope.activeStorageKey);
		saveConfig();
	}

	$scope.isLocalStorageAvailable = function () {
		return !isCordova && elDirSelector;
	};

	$scope.checkStorageActive = function (key) {
		return $scope.activeStorageKey === key;
	};

	$scope.setActiveStorage = function (key) {
		if ($scope.exporting || $scope.activeStorageKey === key) {
			return;
		}

		console.log('ContinuousBackupCtrl setActiveStorage', key);
		if (key === null) {
			$scope.activeStorageKey = key;
			saveConfig();
			return;
		}

		if (key === 'local') {
			if (!elDirSelector) {
				return;
			}
			console.log('ContinuousBackupCtrl setActiveStorage local', elDirSelector);
			if ($scope.localPath) {
				$scope.activeStorageKey = key;
				return;
			}
			elDirSelector.click();
			return;
		}

		const cloudStorage = $scope.cloudStorages[key];
		if (!cloudStorage) {
			return;
		}
		if (cloudStorage.isAuthenticated()) {
			$scope.activeStorageKey = key;
			saveConfig();
			return;
		}

		return cloudStorage.authorizationAccount()
			.then(function (bIsAuthenticated) {
				console.log('ContinuousBackupCtrl onChange authorizationAccount', key, bIsAuthenticated);
				if (bIsAuthenticated) {
					$scope.activeStorageKey = key;
				} else {
					$scope.activeStorageKey = null;
				}
			})
			.catch(function (err) {
				console.error(err);
				$scope.activeStorageKey = null;
			})
			.then(function () {
				handleCloudStorageChangedAuthStatus();
			});
	};

	$scope.checkCloudStorageLogedIn = function (key) {
		const cloudStorage = $scope.cloudStorages[key];
		if (!cloudStorage) {
			return false;
		}
		return cloudStorage.isAuthenticated() && cloudStorage.isInited;
	};

	$scope.logoutCloudStorage = function (key) {
		console.log('ContinuousBackupCtrl logoutCloudStorage', key);
		if ($scope.exporting) {
			return;
		}
		const cloudStorage = $scope.cloudStorages[key];
		cloudStorage.clearAuthData();
		if ($scope.activeStorageKey === key) {
			$scope.activeStorageKey = null;
			saveConfig();
		}
	};

	$scope.isLocalPathActive = function () {
		return $scope.activeStorageKey === 'local';
	};

	$scope.isLocalPathSelected = function () {
		return !!$scope.localPath;
	}

	$scope.getLocalPath = function () {
		return $scope.localPath || '';
	};

	$scope.chooseLocalPath = function () {
		if (!elDirSelector) {
			return;
		}
		elDirSelector.click();
	};

	$scope.removeLocalPath = function () {
		if ($scope.activeStorageKey === 'local') {
			$scope.activeStorageKey = null;
		}
		if (elDirSelector) {
			elDirSelector.value = '';
		}
		$scope.localPath = null;
		saveConfig();
	}

	$scope.$watch('$viewContentLoaded', function () {
		$timeout(function () {
			elDirSelector = document.querySelector('#dirSelector');
			console.log('ContinuousBackupCtrl viewContentLoaded', elDirSelector);
			if (!elDirSelector) {
				return;
			}

			elDirSelector.addEventListener('change', function (event) {
				var dir = (event.srcElement || event.target).files[0];
				console.log('ContinuousBackupCtrl getFile', dir, event);
				if (!dir) {
					return;
				}
				var dirPath = dir.path;
				if (dirPath) {
					$scope.localPath = dirPath;
					$scope.activeStorageKey = 'local';
				} else {
					$scope.localPath = null;
					$scope.activeStorageKey = null;
				}

				saveConfig();
				$timeout(function () {
					$rootScope.$apply();
				});
			});

			console.log('ContinuousBackupCtrl dirChanged', elDirSelector);
		});
	});
	
	$scope.isBackupDisabled = function () {
		return $scope.exporting || !$scope.activeStorageKey;
	};

	$scope.walletExport = function () {
		if ($scope.isBackupDisabled()) {
			return;
		}

		$scope.error = '';
		$scope.exporting = true;

		continuousBackupService.doBackup('export-now', function (err) {
			console.log('ContinuousBackupCtrl walletExport doBackup: err ' + (err && err.message || err));
			$scope.exporting = false;
			if (err) {
				$scope.error = err;
				return;
			}

			$timeout(function () {
				$rootScope.$apply();
				notification.success(
					gettextCatalog.getString('Success'),
					gettextCatalog.getString('Export completed successfully', {})
				);
			});
		});
	}

	function saveConfig(cb) {
		if (!cb) {
			cb = function () {};
		}
		var opts = {
			continuousBackup: {
				localPath: $scope.localPath,
				type: $scope.activeStorageKey,
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
